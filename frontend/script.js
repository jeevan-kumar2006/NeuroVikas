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

// DOM Elements
const body = document.body;
const inputView = document.getElementById('input-view');
const focusMaskTop = document.getElementById('focus-mask-top');
const focusMaskBottom = document.getElementById('focus-mask-bottom');
const distressModal = document.getElementById('distress-modal');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setMode('default');
    
    // --- Load User & History ---
    const user = localStorage.getItem('currentUser');
    if (user) {
        // Update Sidebar Username
        const sidebarUser = document.getElementById('sidebar-username');
        if (sidebarUser) sidebarUser.innerText = user;
    }
    
    loadHistory();
});

// ==========================================
// CORE PROCESSING & REDIRECT
// ==========================================
async function processText() {
    const rawText = document.getElementById('user-input').value.trim();
    if (!rawText) return alert("Please enter some text first!");

    // 1. Save to History first
    saveToHistory(rawText);

    // 2. UI Loading State
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
// HISTORY & PROFILE FUNCTIONS
// ==========================================

function saveToHistory(text) {
    if (!text || text.length < 20) return; // Don't save very short texts

    let history = JSON.parse(localStorage.getItem('chatHistory')) || [];
    
    // Avoid duplicates
    if (history[0] !== text) {
        // Add to start of array
        history.unshift(text);
        
        // Keep only last 5 items
        if (history.length > 5) history.pop();
        
        localStorage.setItem('chatHistory', JSON.stringify(history));
        loadHistory(); // Refresh UI
    }
}

function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) return; // Safety check

    const history = JSON.parse(localStorage.getItem('chatHistory')) || [];

    if (history.length === 0) {
        list.innerHTML = '<li class="history-empty">No history yet.</li>';
        return;
    }

    list.innerHTML = history.map(item => {
        // Truncate for display
        const displayText = item.substring(0, 30) + "...";
        // Safe quote escaping for onclick
        const safeText = item.replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `<li onclick="loadFromHistory('${safeText}')">${displayText}</li>`;
    }).join('');
}

function loadFromHistory(text) {
    document.getElementById('user-input').value = text;
    window.scrollTo(0, 0);
}

function clearHistory() {
    if (confirm("Are you sure you want to delete your chat history?")) {
        localStorage.removeItem('chatHistory');
        loadHistory();
    }
}

// ==========================================
// MODE SWITCHING
// ==========================================
function setMode(mode) {
    body.classList.remove('mode-dyslexia', 'mode-adhd');
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${mode}`).classList.add('active');

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

function toggleFocusMask(isActive) {
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
function triggerBreak() { distressModal.classList.remove('hidden'); }
function closeBreak() { distressModal.classList.add('hidden'); }

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
