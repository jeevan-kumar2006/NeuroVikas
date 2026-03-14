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

let state = { mode: 'default', bionicActive: false, keywords: [], actionItems: [], chunkActive: false };



// Elements
const body = document.body;
const focusMaskTop = document.getElementById('focus-mask-top');
const focusMaskRuler = document.getElementById('focus-mask-ruler');
const focusMaskBottom = document.getElementById('focus-mask-bottom');
const distressModal = document.getElementById('distress-modal');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const resultData = sessionStorage.getItem('currentResult');
    
    // --- Load User & History ---
    const user = localStorage.getItem('currentUser');
    if (user) {
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

    // Fetch keywords & action items from backend
    try {
        const kwRes = await fetch(`${API_URL}/api/keywords`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.originalText })
        });
        if (kwRes.ok) {
            const kwData = await kwRes.json();
            state.keywords    = kwData.keywords    || [];
            state.actionItems = kwData.action_items || [];
        }
    } catch(e) { console.log('Keyword fetch failed', e); }

    renderContent(data.originalText, data.summaryPoints);
    
    // Apply User's Preferred Mode
    const savedMode = localStorage.getItem('preferredMode') || 'default';
    setMode(savedMode);
});

// ==========================================
// CONTENT RENDERING
// ==========================================
// ==========================================
// KEYWORD HIGHLIGHTING
// ==========================================
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyKeywordHighlights(text) {
    if (!state.keywords.length && !state.actionItems.length) return text;

    // Build action-item regex (green underline)
    let result = text;
    state.actionItems.forEach(phrase => {
        const safe = escapeRegex(phrase.substring(0, 40));
        const re = new RegExp(`(${safe})`, 'gi');
        result = result.replace(re, `<mark class="action-item-highlight" title="Action Item">$1</mark>`);
    });

    // Build keyword regex (yellow highlight) — whole word match
    state.keywords.forEach(kw => {
        const safe = escapeRegex(kw);
        const re = new RegExp(`\\b(${safe})\\b`, 'gi');
        result = result.replace(re, `<mark class="keyword-highlight" title="Key Term: ${kw}">$1</mark>`);
    });
    return result;
}

function buildKeywordLegend() {
    if (!state.keywords.length && !state.actionItems.length) return '';
    const kwList = state.keywords.slice(0, 6).join(', ');
    return `<div class="keyword-legend">
        <span><span class="legend-swatch" style="background:rgba(255,220,60,0.7);"></span><strong>Keywords:</strong> ${kwList}</span>
        <span><span class="legend-swatch" style="background:rgba(100,210,140,0.6);border-bottom:2px solid rgba(50,180,100,0.8);"></span><strong>Action Items</strong></span>
    </div>`;
}

// ==========================================
// ADHD CHUNKING
// ==========================================
function applyAdhdChunking(container) {
    if (state.chunkActive) return;  // already chunked
    state.chunkActive = true;
    const paras = Array.from(container.querySelectorAll('p'));
    if (!paras.length) return;

    // Split each paragraph into 2–3 sentence chunks
    const allChunks = [];
    paras.forEach(para => {
        const text = para.innerHTML;  // keep highlight markup
        const sentences = text.split(/(?<=[.!?])\s+/);
        // Group every 2 sentences into a chunk
        const CHUNK_SIZE = 2;
        for (let i = 0; i < sentences.length; i += CHUNK_SIZE) {
            const chunk = sentences.slice(i, i + CHUNK_SIZE).join(' ').trim();
            if (chunk) allChunks.push(chunk);
        }
    });

    container.innerHTML = `<div class="adhd-chunk-wrapper">${
        allChunks.map((chunk, idx) => `
            <div class="adhd-chunk" tabindex="0">
                <div class="chunk-number">Part ${idx + 1} of ${allChunks.length}</div>
                <p style="margin:0;">${chunk}</p>
            </div>`
        ).join('')
    }</div>`;

    // Highlight chunk on focus/click
    container.querySelectorAll('.adhd-chunk').forEach(card => {
        card.addEventListener('focus', () => {
            container.querySelectorAll('.adhd-chunk').forEach(c => c.classList.remove('active-chunk'));
            card.classList.add('active-chunk');
        });
        card.addEventListener('click', () => card.focus());
    });
}

function removeAdhdChunking(container, text, summaryPoints) {
    if (!state.chunkActive) return;
    state.chunkActive = false;
    // Re-render paragraphs normally
    container.innerHTML = buildKeywordLegend();
    const paragraphs = text ? text.split(/\n\n+/) : [];
    paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.innerHTML = applyKeywordHighlights(p);
        container.appendChild(para);
    });
}

function renderContent(text, summaryPoints) {
    const academicDiv = document.getElementById('content-academic');
    academicDiv.innerHTML = buildKeywordLegend();
    const paragraphs = text.split(/\n\n+/);
    paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.innerHTML = applyKeywordHighlights(p);
        academicDiv.appendChild(para);
    });

    // Re-apply chunking if already in ADHD mode
    if (state.mode === 'adhd') {
        state.chunkActive = false;
        applyAdhdChunking(academicDiv);
    }

    const simplifiedDiv = document.getElementById('content-simplified');
    let listItems = summaryPoints.map(s => `<li>${applyKeywordHighlights(s)}</li>`).join('');
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

    const prevMode = state.mode;
    state.mode = mode;

    const bionicToggle = document.getElementById('toggle-bionic');
    const focusToggle  = document.getElementById('toggle-focus');
    const adhdExitBtn  = document.getElementById('adhd-exit-btn');
    const academicDiv  = document.getElementById('content-academic');

    // --- Dyslexia Mode ---
    if (mode === 'dyslexia') {
        body.classList.add('mode-dyslexia');
        if (bionicToggle) { bionicToggle.checked = true; }
        toggleBionic(true);
    } else {
        if (bionicToggle) { bionicToggle.checked = false; }
        toggleBionic(false);
    }

    // --- ADHD Mode ---
    if (mode === 'adhd') {
        body.classList.add('mode-adhd');
        if (focusToggle) { focusToggle.checked = true; }
        toggleFocusMask(true);
        if (adhdExitBtn) adhdExitBtn.classList.remove('hidden');
        // Apply text chunking
        if (academicDiv && !state.chunkActive) {
            applyAdhdChunking(academicDiv);
        }
    } else {
        if (focusToggle) { focusToggle.checked = false; }
        toggleFocusMask(false);
        if (adhdExitBtn) adhdExitBtn.classList.add('hidden');
        // Remove chunking if we're leaving ADHD mode
        if (prevMode === 'adhd' && academicDiv && state.chunkActive) {
            const resultData = sessionStorage.getItem('currentResult');
            if (resultData) {
                const data = JSON.parse(resultData);
                removeAdhdChunking(academicDiv, data.originalText, data.summaryPoints);
            }
        }
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

let isMaskTicking = false;
let maskMouseY = 0;

function moveFocusMask(e) {
    maskMouseY = e.clientY;
    if (!isMaskTicking) {
        window.requestAnimationFrame(() => {
            updateFocusMaskPosition();
            isMaskTicking = false;
        });
        isMaskTicking = true;
    }
}

function updateFocusMaskPosition() {
    const rulerHeight = 120; // bright ruler band height in px
    const halfRuler = rulerHeight / 2;
    const windowH = window.innerHeight;

    // Top dark slab: from top to (mouseY - halfRuler)
    const topH = Math.max(0, maskMouseY - halfRuler);
    focusMaskTop.style.height = topH + 'px';

    // Highlight area: directly surrounding the cursor
    if (typeof focusMaskRuler !== 'undefined' && focusMaskRuler) {
        focusMaskRuler.style.top = topH + 'px';
        focusMaskRuler.style.height = rulerHeight + 'px';
    }

    // Bottom dark slab: from (mouseY + halfRuler) to bottom
    const bottomTop = Math.min(windowH, maskMouseY + halfRuler);
    const bottomH = Math.max(0, windowH - bottomTop);
    focusMaskBottom.style.top = 'auto';
    focusMaskBottom.style.height = bottomH + 'px';
}

// ==========================================
// TTS & EXPORT
// ==========================================
let synth = window.speechSynthesis;
let currentUtterance = null;
let ttsResumeInterval = null;

function toggleSpeech() {
    const ttsBtn = document.getElementById('tts-btn');
    if (!ttsBtn) return;

    const academicDiv = document.getElementById('content-academic');
    const simplifiedDiv = document.getElementById('content-simplified');
    
    let content = "";
    if (simplifiedDiv && !simplifiedDiv.classList.contains('hidden')) {
        content = simplifiedDiv.innerText || simplifiedDiv.textContent;
    } else if (academicDiv) {
        content = academicDiv.innerText || academicDiv.textContent;
    }

    // If it is currently playing or paused and button reflects playing state
    if (!ttsBtn.innerText.includes("Read") && (synth.speaking || synth.paused)) {
        if (synth.paused) {
            synth.resume();
            ttsBtn.innerHTML = "⏸️ Pause";
        } else {
            synth.pause();
            ttsBtn.innerHTML = "▶️ Resume";
        }
        return;
    }

    // Force restart if stuck or simply read aloud clicked
    if (content) {
        synth.cancel(); // Clear any stuck state out
        if (ttsResumeInterval) clearInterval(ttsResumeInterval);
        
        setTimeout(() => {
            currentUtterance = new SpeechSynthesisUtterance(content);
            currentUtterance.rate = 0.9;
            currentUtterance.lang = 'en-US';

            currentUtterance.onend = () => { 
                ttsBtn.innerHTML = "🔊 Read Aloud"; 
                clearInterval(ttsResumeInterval);
                currentUtterance = null;
            };
            
            // Handles both error and cancel
            currentUtterance.onerror = () => {
                ttsBtn.innerHTML = "🔊 Read Aloud"; 
                clearInterval(ttsResumeInterval);
                currentUtterance = null;
            };

            synth.speak(currentUtterance);
            ttsBtn.innerHTML = "⏸️ Pause";

            // Workaround for Chrome 15s utterance timeout bug
            ttsResumeInterval = setInterval(() => {
                if (synth.speaking && !synth.paused) {
                    synth.pause();
                    synth.resume();
                }
            }, 10000);
        }, 50); // Small delay to let cancel propagate
    }
}

// Stop speech on page unload
window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
});

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

function getHistoryKey() {
    const email = localStorage.getItem('userEmail');
    return email ? 'chatHistory_' + email : 'chatHistory';
}

function loadHistory() {
    const list = document.getElementById('history-list');
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
    if (confirm("Are you sure you want to delete your entire chat history?")) {
        localStorage.removeItem(getHistoryKey());
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
