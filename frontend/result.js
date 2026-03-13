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
    
    // Apply Recommendations
    setMode(data.recommendedMode);
    if (data.recommendedMode === 'dyslexia') {
        document.getElementById('toggle-bionic').checked = true;
        toggleBionic(true);
    }
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
    document.getElementById(`btn-${mode}`).classList.add('active');
    state.mode = mode;

    if (mode === 'dyslexia') {
        body.classList.add('mode-dyslexia');
        const bionicToggle = document.getElementById('toggle-bionic');
        if (bionicToggle && !bionicToggle.checked) {
            bionicToggle.checked = true;
            toggleBionic(true);
        }
    }
    else if (mode === 'adhd') {
        body.classList.add('mode-adhd');
    }
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
