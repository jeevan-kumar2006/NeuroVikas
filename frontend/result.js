// ==========================================
// RESULT PAGE LOGIC
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

let state = { mode: 'default', bionicActive: false };

// Elements
const body = document.body;
const focusMaskTop = document.getElementById('focus-mask-top');
const focusMaskRuler = document.getElementById('focus-mask-ruler');
const focusMaskBottom = document.getElementById('focus-mask-bottom');
const distressModal = document.getElementById('distress-modal');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const resultData = sessionStorage.getItem('currentResult');
    
    // --- Load User & History ---
    const user = localStorage.getItem('currentUser');
    if (user) {
        // Update Sidebar Username
        const sidebarUser = document.getElementById('sidebar-username');
        if (sidebarUser) sidebarUser.innerText = user;
    }
    loadHistory();

    if (!resultData) {
        alert("No text data found. Redirecting...");
        window.location.href = "index.html";
        return;
    }

    const data = JSON.parse(resultData);
    
    // Render UI
    document.getElementById('meta-time').innerText = Math.ceil(data.wordCount / 200) + " min read";
    document.getElementById('meta-complexity').innerText = data.complexity;
    renderContent(data.originalText, data.summaryPoints);
    
    // Apply User's Preferred Mode instead of forcing Recommendations
    const savedMode = localStorage.getItem('preferredMode') || 'default';
    setMode(savedMode);
});

// ==========================================
// CONTENT RENDERING
// ==========================================
function renderContent(text, summaryPoints) {
    const academicDiv = document.getElementById('content-academic');
    academicDiv.innerHTML = '';
    const paragraphs = text.split(/\n\n+/);
    paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.textContent = p;
        academicDiv.appendChild(para);
    });

    const simplifiedDiv = document.getElementById('content-simplified');
    let listItems = summaryPoints.map(s => `<li>${s}</li>`).join('');
    simplifiedDiv.innerHTML = '<h3>AI Generated Summary</h3><ul>' + listItems + '</ul>';
}

// ==========================================
// TOOLS & MODES
// ==========================================
function setMode(mode) {
    body.classList.remove('mode-dyslexia', 'mode-adhd');
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    const modeBtn = document.getElementById(`btn-${mode}`);
    if (modeBtn) modeBtn.classList.add('active');
    state.mode = mode;

    const bionicToggle = document.getElementById('toggle-bionic');
    const focusToggle  = document.getElementById('toggle-focus');
    const adhdExitBtn  = document.getElementById('adhd-exit-btn');

    // --- Dyslexia Mode ---
    if (mode === 'dyslexia') {
        body.classList.add('mode-dyslexia');
        // Always force Bionic Reading ON
        if (bionicToggle) { bionicToggle.checked = true; }
        toggleBionic(true);
    } else {
        // Turn Bionic Reading OFF when leaving dyslexia
        if (bionicToggle) { bionicToggle.checked = false; }
        toggleBionic(false);
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

function toggleBionic(isActive) {
    state.bionicActive = isActive;
    const container = document.getElementById('content-academic');
    const paragraphs = container.querySelectorAll('p');

    paragraphs.forEach(p => {
        if (isActive) {
            if (!p.dataset.bionic) {
                const text = p.textContent;
                const words = text.split(' ');
                const newHtml = words.map(word => {
                    if (word.length < 3) return word;
                    const half = Math.ceil(word.length / 2);
                    return `<span class="bionic">${word.slice(0, half)}</span>${word.slice(half)}`;
                }).join(' ');
                p.innerHTML = newHtml;
                p.dataset.bionic = "true";
            }
        } else {
            const txt = p.textContent;
            p.innerHTML = txt;
            delete p.dataset.bionic;
        }
    });
}

function changeComplexity(level) {
    const academic = document.getElementById('content-academic');
    const simplified = document.getElementById('content-simplified');
    const bionicToggle = document.getElementById('toggle-bionic');
    const bionicLabel = bionicToggle ? bionicToggle.closest('.toggle-label') : null;

    if (level === 'academic') {
        academic.classList.remove('hidden');
        simplified.classList.add('hidden');
        // Re-enable bionic reading toggle
        if (bionicToggle) bionicToggle.disabled = false;
        if (bionicLabel) {
            bionicLabel.classList.remove('disabled');
            bionicLabel.style.display = 'flex';
        }
    } else {
        academic.classList.add('hidden');
        simplified.classList.remove('hidden');
        // Disable and visually hide bionic reading in simplified mode
        if (bionicToggle) {
            bionicToggle.checked = false;
            bionicToggle.disabled = true;
            toggleBionic(false);
        }
        if (bionicLabel) {
            bionicLabel.classList.add('disabled');
            bionicLabel.style.display = 'none';
        }
    }
}

function toggleFocusMask(isActive) {
    if (isActive) {
        focusMaskTop.classList.add('active');
        focusMaskBottom.classList.add('active');
        if (focusMaskRuler) focusMaskRuler.classList.add('active');
        document.addEventListener('mousemove', moveFocusMask);
    } else {
        focusMaskTop.classList.remove('active');
        focusMaskBottom.classList.remove('active');
        if (focusMaskRuler) focusMaskRuler.classList.remove('active');
        focusMaskTop.style.height = '0';
        focusMaskBottom.style.height = '0';
        if (focusMaskRuler) focusMaskRuler.style.height = '0';
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

    // Highlight area: directly surrounding the cursor
    if (focusMaskRuler) {
        focusMaskRuler.style.top = topH + 'px';
        focusMaskRuler.style.height = rulerHeight + 'px';
    }

    // Bottom dark slab: from (mouseY + halfRuler) to bottom
    const bottomTop = Math.min(windowH, mouseY + halfRuler);
    const bottomH = Math.max(0, windowH - bottomTop);
    focusMaskBottom.style.top = 'auto';
    focusMaskBottom.style.height = bottomH + 'px';
}

// ==========================================
// TTS & EXPORT
// ==========================================
let synth = window.speechSynthesis;
const ttsBtn = document.getElementById('tts-btn');

function toggleSpeech() {
    const content = document.getElementById('content-academic').innerText;

    if (synth.speaking && !synth.paused) {
        synth.pause();
        ttsBtn.innerText = "▶️ Resume";
        return;
    }

    if (synth.paused) {
        synth.resume();
        ttsBtn.innerText = "⏸️ Pause";
        return;
    }

    if (content) {
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.rate = 0.9;
        utterance.onend = () => { ttsBtn.innerText = "🔊 Read Aloud"; };
        synth.speak(utterance);
        ttsBtn.innerText = "⏸️ Pause";
    }
}

function downloadText() {
    const text = document.getElementById('content-academic').innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'notes.txt';
    link.click();
}

async function downloadPDF(event) {
    const text = document.getElementById('content-simplified').innerText || document.getElementById('content-academic').innerText;
    const btn = event ? event.target : document.querySelector('button[onclick*="downloadPDF"]');
    if (btn) btn.innerText = "Generating...";

    try {
        const response = await fetch(`${API_URL}/api/export-pdf`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text: text })
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = 'notes.pdf'; a.click();
        } else {
            alert("PDF generation failed.");
        }
    } catch (err) {
        alert("Error connecting to server.");
    } finally {
        btn.innerText = "📥 Download PDF";
    }
}

// Modal
function triggerBreak() { distressModal.classList.remove('hidden'); }
function closeBreak() { distressModal.classList.add('hidden'); }

// ==========================================
// HISTORY & PROFILE FUNCTIONS
// ==========================================

function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    const user = localStorage.getItem('currentUser') || 'Guest';
    if (user === 'Guest') {
        list.innerHTML = '<li class="history-empty" style="font-style: italic;">Log in to save history</li>';
        return;
    }

    const history = JSON.parse(localStorage.getItem('chatHistory')) || [];

    if (history.length === 0) {
        list.innerHTML = '<li class="history-empty">No history yet.</li>';
        return;
    }

    list.innerHTML = history.map((item, index) => {
        const text = typeof item === 'string' ? item : item.text;
        const displayText = text.substring(0, 30) + '...';
        return `<li onclick="loadFromHistory(${index})" title="${text.substring(0, 80)}">${displayText}</li>`;
    }).join('');
}

function loadFromHistory(index) {
    const history = JSON.parse(localStorage.getItem('chatHistory')) || [];
    const item = history[index];
    if (!item) return;

    const result = typeof item === 'string' ? null : item.result;
    const text   = typeof item === 'string' ? item  : item.text;

    if (result) {
        // Load the saved result directly into the current result page
        sessionStorage.setItem('currentResult', JSON.stringify(result));
        window.location.reload();
    } else {
        // Older entry — go back to index with the text pre-loaded
        sessionStorage.setItem('loadedHistoryText', text);
        window.location.href = 'index.html';
    }
}

function clearHistory() {
    if (confirm("Are you sure you want to delete your chat history?")) {
        localStorage.removeItem('chatHistory');
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
                chat_history: localStorage.getItem('chatHistory') || '[]' 
            })
        });
    } catch(e) { console.log('History sync failed', e); }
}
