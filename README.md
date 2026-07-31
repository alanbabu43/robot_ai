# Sarvam AI Multilingual Voice & Text Chatbot 🎙️🇮🇳

A real-time, voice-first multilingual conversational AI assistant built using **Sarvam AI** platform models and **Tavily Web Search API**.

Speak or type in any major Indian language (or English). The app automatically transcribes speech, retrieves up-to-date real-time web facts via RAG grounding, generates a concise response in the **same language/script**, and speaks it back aloud using expressive Sarvam Bulbul TTS — fully end-to-end voice in, voice out.

---

## 🌟 Key Features

| Feature | Description |
|---------|-------------|
| 🎙️ **Voice Input** | Click mic → speak → app records, transcribes (STT), chats, and speaks the answer back automatically |
| ⌨️ **Text Input** | Type a prompt, press **Send** or **Enter** to get both a text reply and spoken audio response |
| 🔊 **Speak TTS Button** | Convert any typed text directly to speech without sending it as a chat message |
| 🔁 **Per-Bubble Replay** | Every chat bubble (user + bot) has a 🔊 speaker icon to replay or read it aloud on demand |
| 🌐 **Auto Language Detection** | STT auto-detects the spoken language; the LLM and TTS respond in the **exact same language/script** |
| 🔍 **Real-Time Web Grounding** | Tavily Search API injects live web snippets into the prompt for up-to-date answers (RAG) |
| 💬 **Multi-Turn Context** | Last 6 conversation turns are retained across requests for coherent follow-up questions |
| 🎛️ **Configurable Settings** | Choose LLM model, TTS speaker voice (30+ voices), TTS output language, and toggle grounding on/off |
| 🌊 **Live Audio Visualizer** | HTML5 Canvas wave animates differently for Idle / Recording (red) / Processing (purple) / Speaking (cyan) |
| 💎 **Glassmorphism Dark UI** | Premium dark mode with animated gradient blobs, neon glows, and micro-animations |
| 📱 **Responsive Design** | Adapts from full desktop two-column layout to compact single-column on mobile (≤900px) |

---

## 🏗️ Tech Stack

### Backend
| Library | Purpose |
|---------|---------|
| **Python 3.10+** | Core backend language |
| **FastAPI** | REST API framework, static file serving |
| **Uvicorn** | ASGI server (with `--reload` for development) |
| **Requests** | HTTP client for Sarvam AI & Tavily REST APIs |
| **python-dotenv** | Loads `SARVAM_API_KEY` and `TAVILY_API_KEY` from `.env` |
| **python-multipart** | Handles multipart audio file uploads from browser |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **HTML5** | Semantic page structure |
| **Vanilla CSS3** | Custom dark glassmorphism design with CSS variables, animations |
| **Vanilla JavaScript (ES6+)** | All state management, recording, API calls, audio playback |
| **MediaRecorder API** | Captures browser mic audio as WebM/OGG chunks |
| **Web Audio API** | Routes mic & TTS audio through `AnalyserNode` for visualizer |
| **Fetch API** | Async POSTs (multipart for audio, JSON for text) |
| **HTML5 Canvas** | Real-time audio waveform visualizer |
| **Google Fonts** | *Outfit* (headings) + *Plus Jakarta Sans* (body) |
| **Font Awesome 6.4** | Icons throughout the UI |

### AI & Cloud APIs
| API | Model / Version | Role |
|-----|----------------|------|
| **Sarvam STT** | `saaras:v3` | Speech-to-text with auto language detection |
| **Sarvam LLM** | `sarvam-30b` / `sarvam-105b` | Multilingual chat completions |
| **Sarvam TTS** | `bulbul:v3` | Expressive Indian-language text-to-speech |
| **Tavily Search** | Advanced search | Real-time web context for RAG grounding |

---

## 📁 Project Structure

```
robot - sarvam AI/
├── main.py              # FastAPI server — STT, LLM, TTS endpoints, RAG pipeline
├── run.py               # Launcher: resolves venv Python & starts Uvicorn
├── requirements.txt     # Python dependencies (5 packages)
├── .env                 # API keys (SARVAM_API_KEY, TAVILY_API_KEY)
├── static/
│   ├── index.html       # Single-page web UI
│   ├── css/
│   │   └── style.css    # 933-line glassmorphism stylesheet
│   └── js/
│       └── app.js       # 671-line frontend logic (recording, visualizer, API, audio)
└── temp/                # Transient directory for uploaded audio before STT processing
```

---

## 🔌 API Endpoints

### `GET /`
Serves `static/index.html`.

---

### `POST /api/chat-audio`
**Full voice pipeline** — upload recorded audio → get transcript + text reply + spoken audio.

| Form Field | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | required | Recorded audio blob (WebM/OGG) |
| `voice` | string | `ritu` | Bulbul TTS speaker voice |
| `model` | string | `sarvam-30b` | LLM model |
| `grounding` | bool | `true` | Enable Tavily web search grounding |
| `history` | string | `null` | JSON-encoded conversation history array |
| `api_key` | string | `null` | Override server `.env` API key |

**Response JSON:**
```json
{
  "user_transcript": "भारत की राजधानी क्या है?",
  "detected_language": "hi-IN",
  "bot_response": "भारत की राजधानी नई दिल्ली है।",
  "audio_base64": "<base64-encoded WAV audio>",
  "search_warning": null
}
```

---

### `POST /api/chat-text`
**Text chat with TTS** — send a text message, receive text reply + spoken audio.

**Request JSON** (`ChatTextRequest`):
```json
{
  "message": "What is the capital of India?",
  "voice": "ritu",
  "model": "sarvam-30b",
  "language_code": "en-IN",
  "grounding": true,
  "history": null,
  "api_key": null
}
```

**Response JSON:**
```json
{
  "user_text": "What is the capital of India?",
  "bot_response": "The capital of India is New Delhi.",
  "target_language": "en-IN",
  "audio_base64": "<base64-encoded WAV audio>",
  "search_warning": null
}
```

---

### `POST /api/text-to-speech`
**Standalone TTS** — convert any text directly to speech (no LLM involved).

**Request JSON** (`TTSRequest`):
```json
{
  "text": "नमस्ते! मैं सर्वम् AI हूँ।",
  "voice": "ritu",
  "language_code": "hi-IN",
  "api_key": null
}
```

**Response JSON:**
```json
{
  "text": "नमस्ते! मैं सर्वम् AI हूँ।",
  "language_code": "hi-IN",
  "audio_base64": "<base64-encoded WAV audio>"
}
```

---

## ⚡ How the Voice Pipeline Works

```
User Speaks → MediaRecorder captures WebM audio
      ↓
POST /api/chat-audio (multipart)
      ↓
[1] Sarvam STT (saaras:v3) → transcript + detected_language
      ↓
[2] Tavily Search (if grounding ON) → inject real-time web context into system prompt
      ↓
[3] Sarvam LLM (sarvam-30b / sarvam-105b) → bot_response in same language
      ↓
[4] Sarvam TTS (bulbul:v3) → base64 WAV audio
      ↓
JSON response → browser plays audio via <audio> element + Web Audio API
      ↓
Chat bubbles rendered with per-bubble 🔊 replay buttons
```

---

## 🗣️ Available TTS Speaker Voices (`bulbul:v3`)

> ⚠️ The voice `anushka` is **not** compatible with `bulbul:v3` and will cause TTS to fail silently. Use only the voices listed below.

### Female Voices
`ritu` *(default)* · `priya` · `neha` · `pooja` · `shreya` · `kavya` · `simran` · `ishita` · `roopa` · `suhani` · `niharika` · `rupali` · `shruti` · `tanya` · `kavitha`

### Male Voices
`shubh` · `aditya` · `rahul` · `dev` · `rohan` · `ashutosh` · `amit` · `ratan` · `varun` · `manan` · `sumit` · `kabir` · `aayan` · `advait` · `anand` · `tarun` · `sunny` · `mani` · `gokul` · `vijay` · `mohit` · `rehan` · `soham`

---

## 🌐 Supported Languages

| Language | BCP-47 Code |
|----------|-------------|
| English | `en-IN` |
| Hindi | `hi-IN` |
| Malayalam | `ml-IN` |
| Tamil | `ta-IN` |
| Telugu | `te-IN` |
| Kannada | `kn-IN` |
| Marathi | `mr-IN` |
| Gujarati | `gu-IN` |
| Bengali | `bn-IN` |
| Punjabi | `pa-IN` |
| Odia | `or-IN` |

---

## 🛠️ Setup & Installation

### Prerequisites
- Python **3.10 or higher**
- A [Sarvam AI API key](https://dashboard.sarvam.ai/)
- A [Tavily API key](https://tavily.com/) *(optional — disables live web grounding if absent)*

---

### Step 1 — Navigate to Project

```bash
cd "c:/temporary/robot - sarvam AI"
```

---

### Step 2 — Create & Activate Virtual Environment

```bash
# Create venv
python -m venv env

# Activate (Windows)
.\env\Scripts\activate

# Activate (Linux / macOS)
source env/bin/activate
```

---

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` contains:
```
fastapi
uvicorn
python-dotenv
requests
python-multipart
```

---

### Step 4 — Configure `.env`

Create or edit `.env` in the project root:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

> `TAVILY_API_KEY` is optional. If omitted, the app falls back to Sarvam's built-in wiki grounding.
> You can also enter your Sarvam API key in the **Settings sidebar** in the UI — it takes priority over `.env`.

---

### Step 5 — Run the Server

```bash
# Using the launcher script (auto-detects venv Python)
python run.py

# Or directly with Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Step 6 — Open in Browser

```
http://localhost:8000
```

Grant **microphone access** when prompted by the browser. You are ready to talk!

---

## 🎮 Using the App

| Action | How |
|--------|-----|
| **Record voice** | Click the 🎤 mic button → speak → click again to stop |
| **Send text** | Type in the text box → click **Send** or press **Enter** |
| **Speak typed text** | Type text → click **Speak TTS** (direct TTS, no LLM) |
| **Replay a message** | Click the 🔊 icon on any chat bubble |
| **Change voice** | Select from 30+ voices in the sidebar *TTS Speaker Voice* dropdown |
| **Change language** | Select output language in *TTS Language* dropdown |
| **Switch LLM model** | Toggle between `sarvam-30b` and `sarvam-105b` in sidebar |
| **Toggle grounding** | Use the *Search Grounding* toggle in the sidebar |
| **Clear chat** | Click **Clear Chat** in the top-right header |

---

## 🐛 Known Issues & Fixes

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| Voice responses not playing after voice input | ✅ Fixed | Speaker `anushka` removed; default changed to `ritu` (compatible with `bulbul:v3`) |
| TTS silently failing with HTTP 400 error | ✅ Fixed | All speaker defaults updated across `main.py`, `index.html`, and `app.js` |

---

## 📜 License & Acknowledgments

Built with:
- **[Sarvam AI](https://www.sarvam.ai/)** — Indian language STT, LLM, and TTS APIs
- **[Tavily Search](https://tavily.com/)** — Real-time web retrieval for RAG grounding
- **[FastAPI](https://fastapi.tiangolo.com/)** — Python web framework
- **[Font Awesome](https://fontawesome.com/)** — UI icons
- **[Google Fonts](https://fonts.google.com/)** — Outfit & Plus Jakarta Sans typography
