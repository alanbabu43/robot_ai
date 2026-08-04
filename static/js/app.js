// State variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let conversationHistory = [];

// Audio context & analysis for visualizer
let audioCtx = null;
let analyser = null;
let micSource = null;
let ttsSource = null;
let dataArray = null;

// DOM Elements
const recordButton = document.getElementById('recordButton');
const ttsAudio = document.getElementById('ttsAudio');
const visualizerCanvas = document.getElementById('visualizerCanvas');
const chatHistory = document.getElementById('chatHistory');
const interactionStatus = document.getElementById('interactionStatus');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const chatModelSelect = document.getElementById('chatModel');
const ttsVoiceSelect = document.getElementById('ttsVoice');
const ttsLanguageSelect = document.getElementById('ttsLanguage');
const clearChatBtn = document.getElementById('clearChat');
const enableGroundingCheckbox = document.getElementById('enableGrounding');

const textInput = document.getElementById('textInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const speakTextBtn = document.getElementById('speakTextBtn');


// Setup Visualizer Canvas
const canvasCtx = visualizerCanvas.getContext('2d');
let animId = null;

// Initialize layout size
function resizeCanvas() {
    visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
    visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Toggle API Key visibility (if present)
if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener('click', () => {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        const icon = toggleApiKeyBtn.querySelector('i');
        icon.className = type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
    });
}

// Clear Chat history
clearChatBtn.addEventListener('click', () => {
    conversationHistory = [];
    // Keep only welcome box or clear all
    chatHistory.innerHTML = `
        <div class="welcome-box glass">
            <div class="welcome-icon">
                <i class="fa-solid fa-comments"></i>
            </div>
            <h2>Welcome to Sarvam Voice Assistant!</h2>
            <p>This assistant utilizes **Sarvam AI's** suite of model capabilities for low-latency Indian language voice interactions:</p>
            <ul class="features-list">
                <li><i class="fa-solid fa-check"></i> **Automatic Language Detection**: Just start speaking, no manual language selector needed!</li>
                <li><i class="fa-solid fa-check"></i> **Multilingual LLM Response**: Returns a coherent conversational answer in the same script.</li>
                <li><i class="fa-solid fa-check"></i> **Expressive Bulbul TTS**: Speaks the reply back aloud in the same language.</li>
            </ul>
            <p class="prompt-hint">Click the microphone button below, allow browser mic access, and ask something like:<br><em>"भारत की राजधानी क्या है?"</em> or <em>"What makes Bangalore famous?"</em></p>
        </div>
    `;
    updateStatus("Ready to talk");
});

// Helper: Update interaction status message
function updateStatus(text, stateClass = '') {
    interactionStatus.innerText = text;
    // Set colors if necessary
    if (text.includes("Recording")) {
        interactionStatus.style.color = "#ef4444"; // red
    } else if (text.includes("Thinking") || text.includes("Transcribing")) {
        interactionStatus.style.color = "#8b5cf6"; // purple
    } else if (text.includes("Speaking")) {
        interactionStatus.style.color = "#06b6d4"; // cyan
    } else {
        interactionStatus.style.color = "#9ca3af"; // default gray
    }
}

// Start visualizer animation
function startVisualizer() {
    if (animId) cancelAnimationFrame(animId);
    
    function draw() {
        animId = requestAnimationFrame(draw);
        
        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        
        canvasCtx.clearRect(0, 0, width, height);
        
        // Background subtle grid/lines
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();

        const status = interactionStatus.innerText;

        if (status.includes("Recording") && analyser && dataArray) {
            // Real voice visualization
            analyser.getByteTimeDomainData(dataArray);
            
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#ef4444'; // Red for recording
            canvasCtx.beginPath();
            
            const sliceWidth = width / analyser.frequencyBinCount;
            let x = 0;
            
            for (let i = 0; i < analyser.frequencyBinCount; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
                
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
            
        } else if (status.includes("Speaking") && analyser && dataArray) {
            // Real playback visualization
            analyser.getByteFrequencyData(dataArray);
            
            canvasCtx.fillStyle = 'rgba(6, 182, 212, 0.1)';
            canvasCtx.strokeStyle = '#06b6d4'; // Cyan for speaking
            canvasCtx.lineWidth = 2;
            canvasCtx.beginPath();
            
            const barWidth = (width / analyser.frequencyBinCount) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < analyser.frequencyBinCount; i++) {
                barHeight = dataArray[i] / 2;
                
                // Draw cool neon bars/wave
                const y = height / 2 - barHeight / 2;
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                
                x += barWidth + 1;
            }
            canvasCtx.stroke();
            
        } else if (status.includes("Thinking") || status.includes("Transcribing")) {
            // Wave animation for processing
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#8b5cf6'; // Purple for thinking
            canvasCtx.beginPath();
            
            const time = Date.now() * 0.01;
            for (let x = 0; x < width; x++) {
                const y = height / 2 + Math.sin(x * 0.05 + time) * 12 * Math.sin(x * 0.01);
                if (x === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            }
            canvasCtx.stroke();
        } else {
            // Idle smooth sine wave
            canvasCtx.lineWidth = 1.5;
            canvasCtx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
            canvasCtx.beginPath();
            
            const time = Date.now() * 0.003;
            for (let x = 0; x < width; x++) {
                const y = height / 2 + Math.sin(x * 0.01 + time) * 4;
                if (x === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            }
            canvasCtx.stroke();
        }
    }
    draw();
}

// Start Visualizer initially
startVisualizer();

// Initialize Web Audio API components
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Connect the <audio> element to our audio context
        try {
            ttsSource = audioCtx.createMediaElementSource(ttsAudio);
            // Route TTS audio to speakers so the user can hear the response
            ttsSource.connect(audioCtx.destination);
            // Route TTS audio to analyser for visualization
            ttsSource.connect(analyser);
            console.log("Web Audio Context initialized: Mic loopback/echo is disabled, and TTS is routed to speakers.");
        } catch (e) {
            console.warn("AudioContext binding warning (usually safe to ignore):", e);
        }
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Recording Controls
recordButton.addEventListener('click', async () => {
    initAudioContext();
    
    // Stop playing any active TTS
    if (!ttsAudio.paused) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
        updateStatus("Ready to talk");
    }

    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
});

async function startRecording() {
    audioChunks = [];
    try {
        // Request user microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        
        // Setup MediaRecorder
        // Check supported codecs (WebM is ideal, fallback to WAV or standard)
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/wav';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser decide
        }
        
        mediaRecorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
        
        // Route mic stream to visualizer
        micSource = audioCtx.createMediaStreamSource(audioStream);
        micSource.connect(analyser);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            sendAudioToBackend();
        };
        
        mediaRecorder.start(100); // Trigger data available every 100ms
        
        isRecording = true;
        recordButton.classList.add('recording');
        updateStatus("Recording... Speak now!");
        
    } catch (err) {
        console.error("Microphone Access Error:", err);
        alert("Could not access your microphone. Please grant microphone permissions and try again.");
        updateStatus("Ready to talk");
    }
}

function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    
    mediaRecorder.stop();
    
    // Disconnect mic source to avoid visualizer feedback during playback
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }
    
    // Stop all audio tracks to release microphone hardware glow
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    isRecording = false;
    recordButton.classList.remove('recording');
    updateStatus("Transcribing...");
}

// Append messages to conversation UI
function appendMessage(role, text, langCode = null, audioBase64 = null) {
    // Remove welcome box if present
    const welcome = chatHistory.querySelector('.welcome-box');
    if (welcome) {
        welcome.remove();
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerText = text;
    
    wrapper.appendChild(bubble);
    
    // Meta information (time, language tags, audio replay)
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.innerHTML = `<span>${timeStr}</span>`;
    
    if (langCode) {
        const langPill = document.createElement('span');
        langPill.className = 'lang-tag';
        langPill.innerText = langCode;
        meta.appendChild(langPill);
    }
    
    // Add speak / replay audio button to message metadata
    const playBtn = document.createElement('button');
    playBtn.className = 'play-voice-btn';
    playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    playBtn.title = audioBase64 ? "Replay Audio" : "Read Aloud (Text-to-Speech)";
    playBtn.addEventListener('click', () => {
        if (audioBase64) {
            playTtsAudio(audioBase64);
        } else {
            speakTextDirectly(text, langCode);
        }
    });
    meta.appendChild(playBtn);
    
    wrapper.appendChild(meta);
    chatHistory.appendChild(wrapper);
    
    // Scroll chat window to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Append temporary loading placeholder
function appendTypingIndicator() {
    const welcome = chatHistory.querySelector('.welcome-box');
    if (welcome) welcome.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper bot typing-indicator-wrapper';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    
    bubble.appendChild(dots);
    wrapper.appendChild(bubble);
    chatHistory.appendChild(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    return wrapper;
}

// Convert Base64 response to Blob and play it
function playTtsAudio(base64Data) {
    if (!base64Data) return;
    
    initAudioContext();
    
    // Stop current audio if playing
    if (!ttsAudio.paused) {
        ttsAudio.pause();
    }
    
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);
    
    ttsAudio.src = audioUrl;
    ttsAudio.play()
        .then(() => {
            updateStatus("Speaking...");
        })
        .catch(err => {
            console.error("Audio playback failed:", err);
            updateStatus("Ready to talk");
        });
}

// Track TTS audio ending to restore status
ttsAudio.addEventListener('ended', () => {
    updateStatus("Ready to talk");
});

// Call fastapi endpoints
async function sendAudioToBackend() {
    updateStatus("Thinking...");
    const typingIndicator = appendTypingIndicator();
    
    try {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice_input.webm');
        formData.append('voice', ttsVoiceSelect.value);
        formData.append('model', chatModelSelect.value);
        formData.append('grounding', enableGroundingCheckbox.checked);
        if (conversationHistory.length > 0) {
            formData.append('history', JSON.stringify(conversationHistory));
        }
        
        // Pass API key if provided via UI
        if (apiKeyInput && apiKeyInput.value) {
            const key = apiKeyInput.value.trim();
            if (key) {
                formData.append('api_key', key);
            }
        }
        
        const response = await fetch('/api/chat-audio', {
            method: 'POST',
            body: formData
        });
        
        // Remove loading dots
        typingIndicator.remove();
        
        if (!response.ok) {
            const errResult = await response.json();
            throw new Error(errResult.detail || "Server returned an error");
        }
        
        const result = await response.json();
        
        // Save turn into conversation history
        if (result.user_transcript) {
            conversationHistory.push({ role: 'user', content: result.user_transcript });
        }
        if (result.bot_response) {
            conversationHistory.push({ role: 'assistant', content: result.bot_response });
        }
        
        // Append user's speech transcript
        appendMessage('user', result.user_transcript, result.detected_language);
        
        // Append bot text response
        appendMessage('bot', result.bot_response, result.detected_language, result.audio_base64);
        
        // Speak response out loud
        if (result.audio_base64) {
            playTtsAudio(result.audio_base64);
        } else {
            updateStatus("Ready to talk");
            if (result.warning) {
                console.warn(result.warning);
            }
        }
        
    } catch (err) {
        console.error("Chat Error:", err);
        typingIndicator.remove();
        
        // Render system error message
        const errWrapper = document.createElement('div');
        errWrapper.className = 'message-wrapper bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.style.border = '1px solid var(--error)';
        bubble.style.background = 'rgba(239, 68, 68, 0.1)';
        bubble.innerHTML = `<span style="color: #fca5a5;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</span>`;
        
        errWrapper.appendChild(bubble);
        chatHistory.appendChild(errWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        updateStatus("Ready to talk");
    }
}

// Send text prompt to backend (/api/chat-text)
async function sendTextToBackend() {
    const text = textInput ? textInput.value.trim() : '';
    if (!text) return;
    
    initAudioContext();
    
    // Stop active audio
    if (!ttsAudio.paused) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
    }
    
    textInput.value = '';
    
    // Append user message to UI
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    
    updateStatus("Thinking...");
    const typingIndicator = appendTypingIndicator();
    
    try {
        const payload = {
            message: text,
            voice: ttsVoiceSelect ? ttsVoiceSelect.value : 'ritu',
            model: chatModelSelect ? chatModelSelect.value : 'sarvam-30b',
            api_key: (apiKeyInput && apiKeyInput.value) ? apiKeyInput.value.trim() : null,
            grounding: enableGroundingCheckbox ? enableGroundingCheckbox.checked : true,
            history: conversationHistory.length > 0 ? JSON.stringify(conversationHistory) : null,
            language_code: ttsLanguageSelect ? ttsLanguageSelect.value : 'en-IN'
        };
        
        const response = await fetch('/api/chat-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        typingIndicator.remove();
        
        if (!response.ok) {
            const errResult = await response.json();
            throw new Error(errResult.detail || "Server returned an error");
        }
        
        const result = await response.json();
        
        if (result.bot_response) {
            conversationHistory.push({ role: 'assistant', content: result.bot_response });
            appendMessage('bot', result.bot_response, result.target_language, result.audio_base64);
        }
        
        if (result.audio_base64) {
            playTtsAudio(result.audio_base64);
        } else {
            updateStatus("Ready to talk");
            if (result.warning) console.warn(result.warning);
        }
        
    } catch (err) {
        console.error("Text Chat Error:", err);
        typingIndicator.remove();
        
        const errWrapper = document.createElement('div');
        errWrapper.className = 'message-wrapper bot';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.style.border = '1px solid var(--error)';
        bubble.style.background = 'rgba(239, 68, 68, 0.1)';
        bubble.innerHTML = `<span style="color: #fca5a5;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</span>`;
        
        errWrapper.appendChild(bubble);
        chatHistory.appendChild(errWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        updateStatus("Ready to talk");
    }
}

// Convert provided text directly to speech using /api/text-to-speech
async function speakTextDirectly(textToSynthesize = null, targetLang = null) {
    const text = textToSynthesize || (textInput ? textInput.value.trim() : '');
    if (!text) {
        alert("Please enter text in the box to convert to speech.");
        return;
    }
    
    initAudioContext();
    
    if (!ttsAudio.paused) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
    }
    
    updateStatus("Synthesizing TTS...");
    
    try {
        const payload = {
            text: text,
            voice: ttsVoiceSelect ? ttsVoiceSelect.value : 'ritu',
            language_code: targetLang || (ttsLanguageSelect ? ttsLanguageSelect.value : 'en-IN'),
            api_key: (apiKeyInput && apiKeyInput.value) ? apiKeyInput.value.trim() : null
        };
        
        const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errResult = await response.json();
            throw new Error(errResult.detail || "TTS synthesis request failed");
        }
        
        const result = await response.json();
        
        if (result.audio_base64) {
            playTtsAudio(result.audio_base64);
        } else {
            updateStatus("Ready to talk");
            alert("No audio returned from Text-to-Speech API.");
        }
    } catch (err) {
        console.error("Direct TTS Error:", err);
        updateStatus("Ready to talk");
        alert(`Text-to-Speech failed: ${err.message}`);
    }
}

// Event Listeners for Text Input & Buttons
if (sendTextBtn) {
    sendTextBtn.addEventListener('click', sendTextToBackend);
}
if (speakTextBtn) {
    speakTextBtn.addEventListener('click', () => speakTextDirectly());
}
if (textInput) {
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendTextToBackend();
        }
    });
}

