<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign Up | NeuroVikas</title>
<link rel="stylesheet" href="login.css">
</head>

<body>

<div class="login-container" id="main-container">

  <!-- LEFT: Brand Panel -->
  <div class="brand-panel">
    <div class="brand-content">
      <h1>Neuro<span>Vikas</span></h1>
      <p id="typing-text"></p>
    </div>


  </div>



  <!-- RIGHT: Form Panel -->
  <div class="form-panel">
    <div class="form-wrapper">

      <div class="mobile-logo">NeuroVikas</div>

      <h2>Create Account</h2>
      <p class="subtitle">Sign up to start your learning journey.</p>

      <form id="signup-form">

        <div class="input-group">
          <label>Username</label>
          <input type="text" id="su-username" placeholder="Choose a username" required>
        </div>

        <div class="input-group">
          <label>Email Address</label>
          <input type="email" id="su-email" placeholder="you@example.com" required>
        </div>

        <div class="input-group">
          <label>Password</label>
          <div class="password-wrapper">
            <input type="password" id="su-password" placeholder="Create a password" required autocomplete="new-password">
            <button type="button" class="pwd-toggle" onclick="togglePwd('su-password', this)" tabindex="-1" aria-label="Show password">
                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg class="eye-off-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full" style="margin-top:0.5rem;">
          Create Account
        </button>

      </form>

      <div class="divider"><span>or</span></div>

      <a href="login.html" class="btn btn-outline btn-full">I already have an account</a>
      <a href="index.html" class="btn btn-outline btn-full" style="opacity:0.6; margin-top:0.6rem;">Continue as Guest</a>


    </div>
  </div>

</div>

<script>
/* ── API URL ── */
const getApiUrl = () => {
  const h = window.location.hostname;
  if (h === '127.0.0.1' || h === 'localhost') return 'http://127.0.0.1:5000';
  if (h.includes('app.github.dev')) return `https://${h.replace(/-\d+/, '-5000')}`;
  return window.location.origin;
};
const API_URL = getApiUrl();

/* ── Signup submit ── */
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('su-username').value;
  const email    = document.getElementById('su-email').value;
  const password = document.getElementById('su-password').value;
  try {
    const res  = await fetch(`${API_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message + ' Please login now.');
      window.location.href = 'login.html';
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Could not connect to server.');
  }
});

/* ── Password toggle ── */
function togglePwd(inputId, btn) {
    const input      = document.getElementById(inputId);
    const eyeIcon    = btn.querySelector('.eye-icon');
    const eyeOffIcon = btn.querySelector('.eye-off-icon');
    const showing    = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    eyeIcon.style.display    = showing ? 'none' : '';
    eyeOffIcon.style.display = showing ? ''     : 'none';
    btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
}

/* ── Typing effect ── */
const phrases = [
 'Learn your way.',
 'Adaptive tools for neurodivergent learners.',
 'Smarter, calmer, better learning.'
];
let pi = 0, ci = 0, deleting = false;
const typEl = document.getElementById('typing-text');

function type() {
  const word = phrases[pi];
  if (!deleting) {
    typEl.textContent = word.slice(0, ++ci);
    if (ci === word.length) { deleting = true; setTimeout(type, 1800); return; }
  } else {
    typEl.textContent = word.slice(0, --ci);
    if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
  }
  setTimeout(type, deleting ? 42 : 70);
}
window.onload = type;

/* ── Blue bubbles across full page ── */
const bubbles = [
  /* size, left%, neg-delay, duration, opacity-max, blur */
  [110, 4,   0,  22, 0.55, 0],
  [60,  11,  3,  16, 0.45, 0],
  [80,  19,  7,  20, 0.50, 0],
  [40,  27,  1,  13, 0.40, 0],
  [130, 35,  9,  25, 0.40, 0],
  [55,  44,  5,  17, 0.50, 0],
  [90,  52,  2,  21, 0.45, 0],
];

const container = document.getElementById('main-container');
bubbles.forEach(([size, left, delay, dur, opa]) => {
  const el = document.createElement('div');
  el.className = 'bubble';

  /* alternating fill styles for depth */
  const style = Math.random();
  let bg, border;
  if (style < 0.33) {
    bg = `rgba(45,125,210,${(opa * 0.55).toFixed(2)})`;
    border = `1.5px solid rgba(45,125,210,${(opa * 0.7).toFixed(2)})`;
  } else if (style < 0.66) {
    bg = `rgba(91,163,245,${(opa * 0.40).toFixed(2)})`;
    border = `1.5px solid rgba(91,163,245,${(opa * 0.65).toFixed(2)})`;
  } else {
    bg = `transparent`;
    border = `1.5px solid rgba(45,125,210,${(opa * 0.55).toFixed(2)})`;
  }

  el.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    `left:${left}%`,
    `animation-duration:${dur}s`,
    `animation-delay:-${delay}s`,
    `background:${bg}`,
    `border:${border}`,
  ].join(';');

  container.appendChild(el);
});
</script>

</body>
</html>
