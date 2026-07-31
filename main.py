import os
import json
import base64
import requests
import html
import re
import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Sarvam AI Multilingual Voice & Text Chatbot")

# Request schemas for JSON endpoints
class ChatTextRequest(BaseModel):
    message: str
    voice: Optional[str] = "ritu"
    model: Optional[str] = "sarvam-30b"
    api_key: Optional[str] = None
    grounding: Optional[bool] = True
    history: Optional[str] = None
    language_code: Optional[str] = "en-IN"

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "ritu"
    language_code: Optional[str] = "en-IN"
    api_key: Optional[str] = None


# Create directories if they do not exist
os.makedirs("temp", exist_ok=True)
os.makedirs("static", exist_ok=True)

# Mount static files (will hold index.html, styles, and js)
app.mount("/static", StaticFiles(directory="static"), name="static")

SARVAM_API_BASE = "https://api.sarvam.ai"
TAVILY_API_BASE = "https://api.tavily.com/search"


def get_search_results(query: str) -> str:
    """
    Query Tavily Search API to retrieve real-time web context, complete
    with source titles and publish dates, for use in RAG-style prompt
    injection. Returns an empty string on any failure (network error,
    missing API key, no results, etc.) so the caller can fall back
    gracefully.
    """
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        print("[get_search_results] TAVILY_API_KEY not set in .env — skipping live search")
        return ""

    payload = {
        "api_key": tavily_key,
        "query": query,
        "search_depth": "advanced",
        "max_results": 5,
        "include_answer": False
    }

    try:
        r = requests.post(TAVILY_API_BASE, json=payload, timeout=10)
        if r.status_code != 200:
            print(f"[get_search_results] Tavily returned status {r.status_code}: {r.text}")
            return ""

        results = r.json().get("results", [])
        if not results:
            print(f"[get_search_results] No search results found for query: '{query}'")
            return ""

        snippets = []
        for res in results:
            title = res.get("title", "").strip()
            content = res.get("content", "").strip()
            published = res.get("published_date") or "date unknown"
            if content:
                snippets.append(f"[{title}] (Published: {published})\n{content}")

        return "\n\n".join(snippets)

    except Exception as e:
        print(f"[get_search_results] Exception while querying Tavily: {e}")
        return ""


def get_api_key(client_api_key: str = None) -> str:
    """
    Retrieve API key prioritising the client-provided key over the environment variable.
    """
    load_dotenv(override=True)
    api_key = client_api_key or os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Sarvam AI API Key is missing. Please configure it in the settings or set it in the .env file."
        )
    return api_key


def normalize_lang_code(code: str) -> str:
    """
    Normalize BCP-47 language codes to ones supported by Sarvam Bulbul TTS.
    """
    if not code:
        return "en-IN"

    code = code.lower().strip()

    # Map prefixes to standard Indian language BCP-47 formats supported by Bulbul v3
    if code.startswith("en"):
        return "en-IN"
    elif code.startswith("hi"):
        return "hi-IN"
    elif code.startswith("ml"):
        return "ml-IN"
    elif code.startswith("ta"):
        return "ta-IN"
    elif code.startswith("te"):
        return "te-IN"
    elif code.startswith("kn"):
        return "kn-IN"
    elif code.startswith("mr"):
        return "mr-IN"
    elif code.startswith("gu"):
        return "gu-IN"
    elif code.startswith("bn"):
        return "bn-IN"
    elif code.startswith("pa"):
        return "pa-IN"
    elif code.startswith("or"):
        return "or-IN"

    # Fallback to English (Indian)
    return "en-IN"


@app.get("/")
async def read_index():
    """Serves the main page of the chatbot."""
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(status_code=404, content={"message": "Frontend files not created yet."})


@app.post("/api/chat-audio")
async def chat_audio(
    file: UploadFile = File(...),
    voice: str = Form("anushka"),
    model: str = Form("sarvam-30b"),
    api_key: str = Form(None),
    grounding: bool = Form(True),
    history: str = Form(None)
):
    """
    Accepts recorded voice audio from the browser, transcribes it,
    generates a response, synthesizes the response in the same language,
    and returns the transcript, text response, and audio.
    """
    # 1. Fetch API Key
    try:
        active_api_key = get_api_key(api_key)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})

    # Save incoming audio file to a temp file
    temp_input_path = os.path.join("temp", f"input_{file.filename}")
    try:
        with open(temp_input_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Failed to save uploaded audio: {str(e)}"})

    # 2. Call Speech-To-Text API
    stt_url = f"{SARVAM_API_BASE}/speech-to-text"
    stt_headers = {
        "api-subscription-key": active_api_key
    }

    try:
        with open(temp_input_path, "rb") as audio_file:
            content_type = file.content_type or "audio/webm"
            if ";" in content_type:
                content_type = content_type.split(";")[0].strip()

            files = {
                "file": (file.filename, audio_file, content_type)
            }
            # Use 'saaras:v3' as standard model for Speech-to-text
            data = {
                "model": "saaras:v3",
                "language_code": "unknown"  # Triggers auto-detection
            }

            stt_response = requests.post(stt_url, headers=stt_headers, files=files, data=data)

            if stt_response.status_code != 200:
                return JSONResponse(
                    status_code=stt_response.status_code,
                    content={"detail": f"Sarvam STT Error: {stt_response.text}"}
                )

            stt_result = stt_response.json()
            user_transcript = stt_result.get("transcript", "").strip()
            detected_lang = stt_result.get("language_code")

            if not user_transcript:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Could not recognize any speech. Please try speaking clearly."}
                )
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Speech-to-text request failed: {str(e)}"})
    finally:
        # Clean up input audio
        if os.path.exists(temp_input_path):
            try:
                os.remove(temp_input_path)
            except Exception:
                pass

    # 3. Call Chat Completions API
    llm_url = f"{SARVAM_API_BASE}/v1/chat/completions"
    llm_headers = {
        "api-subscription-key": active_api_key,
        "Content-Type": "application/json"
    }

    current_date_str = datetime.datetime.now().strftime("%B %d, %Y")

    # We craft a system prompt ensuring response language matches input language and includes temporal reference
    system_prompt = (
        f"Today's date is {current_date_str}. "
        "You are a helpful, concise voice assistant. Keep answers short and conversational (1-2 sentences maximum) since they will be spoken aloud. "
        "Always respond in the EXACT same language/script in which the user spoke to you (e.g. if the user speaks in Hindi, respond in Hindi; if in Malayalam, respond in Malayalam; if in English, respond in English). "
        "CRITICAL REQUIREMENT: Always provide the LATEST and MOST CURRENT up-to-date answer as of today. Do not give outdated or historical information when asked about current office holders, news, scores, or facts."
    )

    # If grounding is enabled, perform real-time search context injection (RAG)
    use_wiki_grounding = grounding
    search_warning = None
    if grounding:
        search_context = get_search_results(user_transcript)
        if search_context:
            system_prompt += (
                f"\n\nCRITICAL REAL-TIME GROUNDING INSTRUCTIONS:\n"
                f"Today is {current_date_str}. Below is live web search context for the user's request. "
                "You MUST prioritize this search context over your pre-trained knowledge. "
                "Compare any dates in the snippets and state who or what is the CURRENT active holder or latest state today.\n"
                f"--- START SEARCH CONTEXT ---\n{search_context}\n--- END SEARCH CONTEXT ---"
            )
            # Disable built-in wiki grounding when we successfully inject up-to-date web search results
            use_wiki_grounding = False
        else:
            # Search failed or returned nothing — fall back to Sarvam's built-in wiki grounding
            use_wiki_grounding = True
            search_warning = "Live web search unavailable — used built-in wiki grounding instead."

    messages = [{"role": "system", "content": system_prompt}]

    # Include recent conversation history if provided
    if history:
        try:
            parsed_history = json.loads(history)
            if isinstance(parsed_history, list):
                # Include up to last 6 messages to keep context concise
                for msg in parsed_history[-6:]:
                    if isinstance(msg, dict) and msg.get("role") in ["user", "assistant"] and msg.get("content"):
                        messages.append({"role": msg["role"], "content": msg["content"]})
        except Exception as e:
            print(f"[chat_audio] Failed to parse history JSON: {e}")

    messages.append({"role": "user", "content": user_transcript})

    llm_payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "wiki_grounding": use_wiki_grounding
    }

    try:
        llm_response = requests.post(llm_url, headers=llm_headers, json=llm_payload)
        if llm_response.status_code != 200:
            return JSONResponse(
                status_code=llm_response.status_code,
                content={"detail": f"Sarvam LLM Error: {llm_response.text}"}
            )

        llm_result = llm_response.json()
        bot_response = llm_result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Chat completion request failed: {str(e)}"})

    # 4. Call Text-to-Speech API
    tts_url = f"{SARVAM_API_BASE}/text-to-speech"
    tts_headers = {
        "api-subscription-key": active_api_key,
        "Content-Type": "application/json"
    }

    target_lang = normalize_lang_code(detected_lang)

    tts_payload = {
        "text": bot_response,
        "speaker": voice,
        "model": "bulbul:v3",
        "target_language_code": target_lang
    }

    try:
        tts_response = requests.post(tts_url, headers=tts_headers, json=tts_payload)
        if tts_response.status_code != 200:
            # We return the texts even if TTS fails, with a warning
            return JSONResponse(
                status_code=200,
                content={
                    "user_transcript": user_transcript,
                    "detected_language": detected_lang,
                    "bot_response": bot_response,
                    "audio_base64": None,
                    "warning": f"TTS synthesis failed: {tts_response.text}",
                    "search_warning": search_warning
                }
            )

        tts_result = tts_response.json()
        audios = tts_result.get("audios", [])
        audio_base64 = audios[0] if audios else None

        return JSONResponse(
            status_code=200,
            content={
                "user_transcript": user_transcript,
                "detected_language": detected_lang,
                "bot_response": bot_response,
                "audio_base64": audio_base64,
                "search_warning": search_warning
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "user_transcript": user_transcript,
                "detected_language": detected_lang,
                "bot_response": bot_response,
                "audio_base64": None,
                "warning": f"TTS synthesis failed due to exception: {str(e)}",
                "search_warning": search_warning
            }
        )


@app.post("/api/text-to-speech")
async def text_to_speech(req: TTSRequest):
    """
    Synthesizes speech from provided text using Sarvam Bulbul TTS API.
    Returns base64 audio and language code.
    """
    try:
        active_api_key = get_api_key(req.api_key)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})

    if not req.text or not req.text.strip():
        return JSONResponse(status_code=400, content={"detail": "Text for speech synthesis cannot be empty."})

    tts_url = f"{SARVAM_API_BASE}/text-to-speech"
    tts_headers = {
        "api-subscription-key": active_api_key,
        "Content-Type": "application/json"
    }

    target_lang = normalize_lang_code(req.language_code)

    tts_payload = {
        "text": req.text.strip(),
        "speaker": req.voice or "ritu",
        "model": "bulbul:v3",
        "target_language_code": target_lang
    }

    try:
        tts_response = requests.post(tts_url, headers=tts_headers, json=tts_payload)
        if tts_response.status_code != 200:
            return JSONResponse(
                status_code=tts_response.status_code,
                content={"detail": f"Sarvam TTS Error: {tts_response.text}"}
            )

        tts_result = tts_response.json()
        audios = tts_result.get("audios", [])
        audio_base64 = audios[0] if audios else None

        return JSONResponse(
            status_code=200,
            content={
                "text": req.text.strip(),
                "language_code": target_lang,
                "audio_base64": audio_base64
            }
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Text-to-speech request failed: {str(e)}"})


@app.post("/api/chat-text")
async def chat_text(req: ChatTextRequest):
    """
    Accepts text prompt, generates LLM response with real-time web search grounding (RAG),
    and synthesizes the resulting response into speech using Sarvam TTS.
    """
    try:
        active_api_key = get_api_key(req.api_key)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})

    if not req.message or not req.message.strip():
        return JSONResponse(status_code=400, content={"detail": "Message text cannot be empty."})

    user_text = req.message.strip()

    # 1. Call Chat Completions API
    llm_url = f"{SARVAM_API_BASE}/v1/chat/completions"
    llm_headers = {
        "api-subscription-key": active_api_key,
        "Content-Type": "application/json"
    }

    current_date_str = datetime.datetime.now().strftime("%B %d, %Y")

    system_prompt = (
        f"Today's date is {current_date_str}. "
        "You are a helpful, concise voice assistant. Keep answers short and conversational (1-2 sentences maximum) since they will be spoken aloud. "
        "Always respond in the EXACT same language/script in which the user wrote to you (e.g. if the user speaks/writes in Hindi, respond in Hindi; if in English, respond in English). "
        "CRITICAL REQUIREMENT: Always provide the LATEST and MOST CURRENT up-to-date answer as of today. Do not give outdated information."
    )

    use_wiki_grounding = req.grounding if req.grounding is not None else True
    search_warning = None
    if use_wiki_grounding:
        search_context = get_search_results(user_text)
        if search_context:
            system_prompt += (
                f"\n\nCRITICAL REAL-TIME GROUNDING INSTRUCTIONS:\n"
                f"Today is {current_date_str}. Below is live web search context for the user's request. "
                "You MUST prioritize this search context over your pre-trained knowledge. "
                "Compare any dates in the snippets and state who or what is the CURRENT active holder or latest state today.\n"
                f"--- START SEARCH CONTEXT ---\n{search_context}\n--- END SEARCH CONTEXT ---"
            )
            use_wiki_grounding = False
        else:
            use_wiki_grounding = True
            search_warning = "Live web search unavailable — used built-in wiki grounding instead."

    messages = [{"role": "system", "content": system_prompt}]

    if req.history:
        try:
            parsed_history = json.loads(req.history)
            if isinstance(parsed_history, list):
                for msg in parsed_history[-6:]:
                    if isinstance(msg, dict) and msg.get("role") in ["user", "assistant"] and msg.get("content"):
                        messages.append({"role": msg["role"], "content": msg["content"]})
        except Exception as e:
            print(f"[chat_text] Failed to parse history JSON: {e}")

    messages.append({"role": "user", "content": user_text})

    llm_payload = {
        "model": req.model or "sarvam-30b",
        "messages": messages,
        "temperature": 0.7,
        "wiki_grounding": use_wiki_grounding
    }

    try:
        llm_response = requests.post(llm_url, headers=llm_headers, json=llm_payload)
        if llm_response.status_code != 200:
            return JSONResponse(
                status_code=llm_response.status_code,
                content={"detail": f"Sarvam LLM Error: {llm_response.text}"}
            )

        llm_result = llm_response.json()
        bot_response = llm_result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Chat completion request failed: {str(e)}"})

    # 2. Call Text-to-Speech API for the result
    tts_url = f"{SARVAM_API_BASE}/text-to-speech"
    tts_headers = {
        "api-subscription-key": active_api_key,
        "Content-Type": "application/json"
    }

    target_lang = normalize_lang_code(req.language_code)

    tts_payload = {
        "text": bot_response,
        "speaker": req.voice or "ritu",
        "model": "bulbul:v3",
        "target_language_code": target_lang
    }

    try:
        tts_response = requests.post(tts_url, headers=tts_headers, json=tts_payload)
        if tts_response.status_code != 200:
            return JSONResponse(
                status_code=200,
                content={
                    "user_text": user_text,
                    "bot_response": bot_response,
                    "target_language": target_lang,
                    "audio_base64": None,
                    "warning": f"TTS synthesis failed: {tts_response.text}",
                    "search_warning": search_warning
                }
            )

        tts_result = tts_response.json()
        audios = tts_result.get("audios", [])
        audio_base64 = audios[0] if audios else None

        return JSONResponse(
            status_code=200,
            content={
                "user_text": user_text,
                "bot_response": bot_response,
                "target_language": target_lang,
                "audio_base64": audio_base64,
                "search_warning": search_warning
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "user_text": user_text,
                "bot_response": bot_response,
                "target_language": target_lang,
                "audio_base64": None,
                "warning": f"TTS synthesis failed due to exception: {str(e)}",
                "search_warning": search_warning
            }
        )