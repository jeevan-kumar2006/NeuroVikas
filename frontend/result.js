// ==========================================
// RESULT PAGE LOGIC
// ==========================================

// Dynamic URL Configuration
const getApiUrl = () => {
    // 1. Local VS Code Development
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        return "http://127.0.0.1:5000";
    }
    if (window.location.hostname.includes('app.github.dev')) {
        // Replace the port part of the subdomain (e.g., -5500) with the backend port (-5000)
        // This assumes your frontend is running on a different port than 5000 (like Live Server on 5500)
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
const focusMask = document.getElementById('focus-mask');
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

    if (mode === 'dyslexia') body.classList.add('mode-dyslexia');
    else if (mode === 'adhd') body.classList.add('mode-adhd');
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
    if (level === 'academic') {
        academic.classList.remove('hidden');
        simplified.classList.add('hidden');
    } else {
        academic.classList.add('hidden');
        simplified.classList.remove('hidden');
    }
}

function toggleFocusMask(isActive) {
    if (isActive) {
        focusMask.classList.add('active');
        document.addEventListener('mousemove', moveFocusMask);
    } else {
        focusMask.classList.remove('active');
        document.removeEventListener('mousemove', moveFocusMask);
    }
}

function moveFocusMask(e) {
    focusMask.style.clipPath = `ellipse(80% 120px at 50% ${e.clientY}px)`;
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

async function downloadPDF() {
    const text = document.getElementById('content-simplified').innerText || document.getElementById('content-academic').innerText;
    const btn = event.target;
    btn.innerText = "Generating...";

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
