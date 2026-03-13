// ==========================================
// CONFIGURATION & STATE
// ==========================================

// Dynamic URL Configuration
const getApiUrl = () => {
    // 1. Local VS Code Development or Direct File Access
    if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.hostname === '') {
        return "http://127.0.0.1:5000";
    }

    // 2. GitHub Codespaces Logic
    if (window.location.hostname.includes('app.github.dev')) {
        let host = window.location.hostname;
        return `https://${host.replace(/-\d+/, '-5000')}`; 
    }

    // 3. Fallback (if deployed normally)
    return window.location.origin;
};
const API_URL = getApiUrl();

let currentUser = localStorage.getItem('currentUser') || 'Guest';
let startTime = Date.now();

// DOM Elements - lazy getters so they're always resolved after DOM is ready
const body = document.body;
let focusMaskTop, focusMaskBottom, distressModal;

function getEl(id) { return document.getElementById(id); }

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Resolve DOM elements now that the DOM is fully ready
    focusMaskTop    = getEl('focus-mask-top');
    focusMaskBottom = getEl('focus-mask-bottom');
    distressModal   = getEl('distress-modal');

    // --- Load User & History FIRST so it always renders ---
    const user = localStorage.getItem('currentUser');
    if (user) {
        const sidebarUser = getEl('sidebar-username');
        if (sidebarUser) sidebarUser.innerText = user;
    }
    loadHistory();

    // Apply the user's saved mode
    const savedMode = localStorage.getItem('preferredMode') || 'default';
    setMode(savedMode);

    // Catch history redirects from result page
    const historyTextToLoad = sessionStorage.getItem('loadedHistoryText');
    if (historyTextToLoad) {
        const inputEl = getEl('user-input');
        if (inputEl) inputEl.value = historyTextToLoad;
        sessionStorage.removeItem('loadedHistoryText');
    }
});

// ==========================================
// CORE PROCESSING & REDIRECT
// ==========================================
async function processText() {
    const rawText = document.getElementById('user-input').value.trim();
    if (!rawText) return alert("Please enter some text first!");

    // Check Guest Limit
    const user = localStorage.getItem('currentUser') || 'Guest';
    if (user === 'Guest') {
        let guestUsageCount = parseInt(localStorage.getItem('guestUsageCount') || '0');
        if (guestUsageCount >= 3) {
            alert("You have reached your limit of 3 free uploads. Please log in or create an account to continue!");
            return;
        }
        localStorage.setItem('guestUsageCount', guestUsageCount + 1);
    }

    // 1. UI Loading State
    document.querySelector('.input-actions').innerHTML = "Analyzing...";

    try {
        // 3. Analyze
        const analyzeRes = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text: rawText })
        });
        const analysisData = await analyzeRes.json();

        // 4. Simplify
        const simplifyRes = await fetch(`${API_URL}/api/simplify`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text: rawText })
        });
        const simplifyData = await simplifyRes.json();

        // 5. Save data to Session Storage
        const resultPayload = {
            originalText: rawText,
            summaryPoints: simplifyData.summary,
            wordCount: analysisData.wordCount,
            complexity: analysisData.complexity,
            recommendedMode: analysisData.recommendedMode
        };
        
        // 5. Save history NOW with the full result, then redirect
        saveToHistory(rawText, resultPayload);

        sessionStorage.setItem('currentResult', JSON.stringify(resultPayload));

        // 6. Redirect to Result Page
        window.location.href = "result.html";

    } catch (error) {
        console.error("Backend connection failed", error);
        alert("Error connecting to Python Backend.");
        document.querySelector('.input-actions').innerHTML = '<button class="btn btn-primary" onclick="processText()">Adapt & Transform</button>';
    }
}

// ==========================================
// FILE UPLOAD
// ==========================================
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Check Guest Limit
    const user = localStorage.getItem('currentUser') || 'Guest';
    if (user === 'Guest') {
        let guestUsageCount = parseInt(localStorage.getItem('guestUsageCount') || '0');
        if (guestUsageCount >= 3) {
            alert("You have reached your limit of 3 free uploads. Please log in or create an account to continue!");
            input.value = ''; // clear input
            return;
        }
        localStorage.setItem('guestUsageCount', guestUsageCount + 1);
    }

    document.getElementById('user-input').value = "Processing file...";
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('user-input').value = data.text;
            alert("File processed! Click 'Adapt & Transform' to continue.");
        } else {
            alert("Error: " + data.message);
            document.getElementById('user-input').value = "";
        }
    } catch (err) {
        console.error(err);
        alert("Upload failed. Is the backend running?");
    }
}

// ==========================================
// SPEECH TO TEXT (Dictation)
// ==========================================
let recognition;
let isDictating = false;

function initSTT() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Speech to text is not supported in this browser. Please use Chrome or Edge.");
        return false;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = function() {
        isDictating = true;
        const sttBtn = document.getElementById('stt-btn');
        if (sttBtn) {
            sttBtn.classList.add('recording');
            sttBtn.innerHTML = "🛑 Stop Dictating";
        }
    };

    recognition.onresult = function(event) {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        
        const userInput = document.getElementById('user-input');
        if (finalTranscript) {
            // Append with a space if needed
            userInput.value = userInput.value + (userInput.value && !userInput.value.endsWith(' ') ? ' ' : '') + finalTranscript;
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            alert("Microphone permission denied.");
            stopSTT();
        }
    };

    recognition.onend = function() {
        if (isDictating) {
            // It stopped automatically (timeout, silence), update UI
            stopSTT();
        }
    };
    return true;
}

function stopSTT() {
    isDictating = false;
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }
    const sttBtn = document.getElementById('stt-btn');
    if (sttBtn) {
        sttBtn.classList.remove('recording');
        sttBtn.innerHTML = "🎤 Dictate";
    }
}

function toggleSTT(event) {
    if (event) event.preventDefault();
    if (!recognition) {
        const initialized = initSTT();
        if (!initialized) return;
    }
    
    if (isDictating) {
        stopSTT();
    } else {
        try {
            recognition.start();
        } catch(e) {
            console.error("Failed to start speech recognition", e);
            stopSTT();
        }
    }
}

// ==========================================
// HISTORY & PROFILE FUNCTIONS
// ==========================================

function getHistoryKey() {
    const email = localStorage.getItem('userEmail');
    return email ? 'chatHistory_' + email : 'chatHistory';
}

function saveToHistory(text, resultPayload) {
    if (!text || text.length < 20) return;

    const user = localStorage.getItem('currentUser') || 'Guest';
    if (user === 'Guest') return; // No history for guests

    let history = JSON.parse(localStorage.getItem(getHistoryKey())) || [];
    
    // Avoid exact duplicate of most recent item
    if (!history.length || history[0].text !== text) {
        history.unshift({ text: text, result: resultPayload || null });
        if (history.length > 5) history.pop();
        localStorage.setItem(getHistoryKey(), JSON.stringify(history));

        let sessionKey = 'userSessions_' + (localStorage.getItem('userEmail') || 'unknown');
        let sessions = parseInt(localStorage.getItem(sessionKey) || '0');
        localStorage.setItem(sessionKey, sessions + 1);

        loadHistory();
        syncHistoryToDB();
    }
}

async function syncHistoryToDB() {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
        await fetch(`${API_URL}/api/sync_history`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                token: token, 
                chat_history: localStorage.getItem(getHistoryKey()) || '[]' 
            })
        });
    } catch(e) { console.log('History sync failed', e); }
}

function loadHistory() {
    const list = getEl('history-list');
    if (!list) return;

    const user = localStorage.getItem('currentUser') || 'Guest';
    if (user === 'Guest') {
        list.innerHTML = '<li class="history-empty" style="font-style: italic;">Log in to save history</li>';
        return;
    }

    const history = JSON.parse(localStorage.getItem(getHistoryKey())) || [];

    if (history.length === 0) {
        list.innerHTML = '<li class="history-empty">No history yet.</li>';
        return;
    }

    list.innerHTML = history.map((item, index) => {
        // Support both old format (string) and new format (object)
        const text = typeof item === 'string' ? item : item.text;
        const displayText = text.substring(0, 30) + '...';
        return `
            <li class="history-item" style="display:flex; justify-content:space-between; align-items:center;">
                <span onclick="loadFromHistory(${index})" title="${text.substring(0, 80)}" style="cursor:pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayText}</span>
                <span onclick="deleteHistoryItem(${index}); event.stopPropagation();" title="Delete chat" style="cursor:pointer; font-size:1.2rem; padding-left:10px; opacity:0.6;">🗑️</span>
            </li>
        `;
    }).join('');
}

function deleteHistoryItem(index) {
    if (confirm("Delete this specific chat?")) {
        let history = JSON.parse(localStorage.getItem(getHistoryKey())) || [];
        history.splice(index, 1);
        localStorage.setItem(getHistoryKey(), JSON.stringify(history));
        loadHistory();
        syncHistoryToDB();
    }
}

function loadFromHistory(index) {
    const history = JSON.parse(localStorage.getItem(getHistoryKey())) || [];
    const item = history[index];
    if (!item) return;

    // Support both old string format and new object format
    const result = typeof item === 'string' ? null : item.result;
    const text   = typeof item === 'string' ? item  : item.text;

    if (result) {
        // We have the saved result — navigate directly to the result page
        sessionStorage.setItem('currentResult', JSON.stringify(result));
        window.location.href = 'result.html';
    } else {
        // Older entry without saved result — just populate the textarea
        const inputEl = getEl('user-input');
        if (inputEl) inputEl.value = text;
        window.scrollTo(0, 0);
    }
}

function clearHistory() {
    if (confirm("Are you sure you want to delete your entire chat history?")) {
        localStorage.removeItem(getHistoryKey());
        loadHistory();
        syncHistoryToDB();
    }
}

// ==========================================
// MODE SWITCHING
// ==========================================
function setMode(mode) {
    body.classList.remove('mode-dyslexia', 'mode-adhd');
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    const modeBtn = document.getElementById(`btn-${mode}`);
    if (modeBtn) modeBtn.classList.add('active');

    const bionicToggle = document.getElementById('toggle-bionic');
    const focusToggle  = document.getElementById('toggle-focus');
    const adhdExitBtn  = document.getElementById('adhd-exit-btn');

    // --- Dyslexia Mode ---
    if (mode === 'dyslexia') {
        body.classList.add('mode-dyslexia');
        if (bionicToggle) { bionicToggle.checked = true; }
        // toggleBionic only exists on result.js — guard safely
        if (typeof toggleBionic === 'function') toggleBionic(true);
    } else {
        if (bionicToggle) { bionicToggle.checked = false; }
        if (typeof toggleBionic === 'function') toggleBionic(false);
    }

    // --- ADHD Mode ---
    if (mode === 'adhd') {
        body.classList.add('mode-adhd');
        // Always force Focus Mask ON
        if (focusToggle) { focusToggle.checked = true; }
        toggleFocusMask(true);
        if (adhdExitBtn) adhdExitBtn.classList.remove('hidden');
    } else {
        // Turn Focus Mask OFF when leaving adhd
        if (focusToggle) { focusToggle.checked = false; }
        toggleFocusMask(false);
        if (adhdExitBtn) adhdExitBtn.classList.add('hidden');
    }

    localStorage.setItem('preferredMode', mode);
}

function toggleFocusMask(isActive) {
    // Re-resolve in case they were null at startup
    if (!focusMaskTop)    focusMaskTop    = getEl('focus-mask-top');
    if (!focusMaskBottom) focusMaskBottom = getEl('focus-mask-bottom');
    if (!focusMaskTop || !focusMaskBottom) return; // elements missing, bail out

    if (isActive) {
        focusMaskTop.classList.add('active');
        focusMaskBottom.classList.add('active');
        document.addEventListener('mousemove', moveFocusMask);
    } else {
        focusMaskTop.classList.remove('active');
        focusMaskBottom.classList.remove('active');
        focusMaskTop.style.height = '0';
        focusMaskBottom.style.height = '0';
        document.removeEventListener('mousemove', moveFocusMask);
    }
}

function moveFocusMask(e) {
    const rulerHeight = 120; // bright ruler band height in px
    const halfRuler = rulerHeight / 2;
    const mouseY = e.clientY;
    const windowH = window.innerHeight;

    // Top dark slab: from top to (mouseY - halfRuler)
    const topH = Math.max(0, mouseY - halfRuler);
    focusMaskTop.style.height = topH + 'px';

    // Bottom dark slab: from (mouseY + halfRuler) to bottom
    const bottomTop = Math.min(windowH, mouseY + halfRuler);
    const bottomH = Math.max(0, windowH - bottomTop);
    focusMaskBottom.style.top = 'auto';
    focusMaskBottom.style.height = bottomH + 'px';
}

// ==========================================
// TIME TRACKING (Secure)
// ==========================================
function triggerBreak() {
    if (!distressModal) distressModal = getEl('distress-modal');
    if (distressModal) distressModal.classList.remove('hidden');
}
function closeBreak() {
    if (!distressModal) distressModal = getEl('distress-modal');
    if (distressModal) distressModal.classList.add('hidden');
}

// Index-page stub for Bionic Reading toggle
// (full implementation lives in result.js for the results page)
function toggleBionic(isActive) {
    // On the index/upload page there is no article content to transform,
    // so this is intentionally a no-op. The toggle visual state is managed by CSS.
}

// Stub so the complexity dropdown doesn't throw on pages without it
function changeComplexity(level) {}

async function syncTime() {
    const token = localStorage.getItem('authToken');
    if (!token) return; // Not logged in

    const endTime = Date.now();
    const secondsSpent = Math.round((endTime - startTime) / 1000);
    
    // Security: Only sync if time is reasonable (between 5s and 60s)
    if (secondsSpent > 5 && secondsSpent <= 60) {
        try {
            const res = await fetch(`${API_URL}/api/update_time`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    token: token, 
                    seconds: secondsSpent 
                })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('userTime', data.total_time);
                startTime = Date.now();
            }
        } catch (e) { console.log("Time sync failed"); }
    }
}
setInterval(syncTime, 30000);
window.addEventListener('beforeunload', syncTime);
