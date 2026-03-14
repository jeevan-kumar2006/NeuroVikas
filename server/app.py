import os
import re
import io
import sqlite3
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Check for optional libraries
try:
    from PIL import Image
    import pytesseract
    if os.name == 'nt':
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    OCR_SUPPORT = True
except ImportError:
    OCR_SUPPORT = False

try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

try:
    from fpdf import FPDF
    PDF_EXPORT = True
except ImportError:
    PDF_EXPORT = False

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
DB_NAME = 'users.db'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

# --- DATABASE SETUP ---
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # UPDATED: Added 'email' column
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password TEXT,
                streak INTEGER DEFAULT 0,
                total_time_seconds INTEGER DEFAULT 0,
                last_login_date TEXT,
                session_token TEXT
            )
        ''')
        # Safely add the chat_history column to existing databases
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN chat_history TEXT DEFAULT '[]'")
        except sqlite3.OperationalError:
            pass # Column already exists
        
        conn.commit()
        print(">>> Database initialized successfully.")
    except Exception as e:
        print(f"!!! DB Init Error: {e}")
    finally:
        if conn: conn.close()

init_db()

# --- VALIDATION ---
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_valid_username(username):
    # Only letters, numbers, underscores, dots
    if not username or len(username) < 3 or len(username) > 20: return False
    return re.match(r'^[a-zA-Z0-9_.-]+$', username) is not None

def is_valid_email(email):
    # Simple email regex
    if not email: return False
    return re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email) is not None

def get_user_from_token(token):
    if not token: return None
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE session_token = ?", (token,)).fetchone()
    conn.close()
    return user

# --- STREAK LOGIC ---
def calculate_streak(last_login_str):
    today = datetime.now().date()
    if not last_login_str: return 1
    try:
        last_login = datetime.strptime(last_login_str, "%Y-%m-%d").date()
    except ValueError: return 1
    if last_login == today: return None
    elif last_login == today - timedelta(days=1): return 1
    else: return 0

# --- ROUTES ---

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"success": False, "message": "All fields are required"}), 400
    
    if not is_valid_username(username):
        return jsonify({"success": False, "message": "Invalid username (letters/numbers only)"}), 400
    
    if not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid email format"}), 400

    conn = None
    try:
        conn = get_db_connection()
        # Check if email or username exists
        existing = conn.execute("SELECT id FROM users WHERE email = ? OR username = ?", (email, username)).fetchone()
        if existing:
            return jsonify({"success": False, "message": "Email or Username already taken"}), 409

        conn.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, password))
        conn.commit()
        return jsonify({"success": True, "message": "Account created!"}), 201
    except Exception as e:
        print(f"!!! Signup Error: {e}")
        return jsonify({"success": False, "message": "Server error"}), 500
    finally:
        if conn: conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    login_id = data.get('username') # Frontend sends 'username', but it can be email
    password = data.get('password')

    conn = None
    try:
        conn = get_db_connection()
        # Allow login with EITHER email OR username
        user = conn.execute("SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?", 
                           (login_id, login_id, password)).fetchone()

        if user:
            user_id = user['id']
            current_streak = user['streak'] if user['streak'] else 0
            
            streak_action = calculate_streak(user['last_login_date'])
            today_str = datetime.now().strftime("%Y-%m-%d")

            if streak_action == 1: new_streak = current_streak + 1
            elif streak_action == 0: new_streak = 1
            elif streak_action is None: new_streak = current_streak
            else: new_streak = 1

            token = secrets.token_hex(16)
            
            conn.execute("UPDATE users SET streak = ?, last_login_date = ?, session_token = ? WHERE id = ?", 
                         (new_streak, today_str, token, user_id))
            conn.commit()
            
            return jsonify({
                "success": True, 
                "user": user['username'],   # Return Username
                "email": user['email'],     # Return Email
                "streak": new_streak,
                "total_time": user['total_time_seconds'] or 0,
                "token": token,
                "chat_history": user['chat_history'] or '[]' # Return History
            })
        else:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401
    except Exception as e:
        print(f"!!! Login Error: {e}")
        return jsonify({"success": False, "message": "Server error"}), 500
    finally:
        if conn: conn.close()

@app.route('/api/update_time', methods=['POST'])
def update_time():
    token = request.json.get('token')
    user = get_user_from_token(token)
    if not user: return jsonify({"success": False, "message": "Unauthorized"}), 401

    seconds_spent = request.json.get('seconds', 0)
    if not isinstance(seconds_spent, int) or seconds_spent < 0 or seconds_spent > 60:
         return jsonify({"success": False, "message": "Invalid time"}), 400

    conn = None
    try:
        conn = get_db_connection()
        conn.execute("UPDATE users SET total_time_seconds = total_time_seconds + ? WHERE id = ?", (seconds_spent, user['id']))
        conn.commit()
        updated_user = conn.execute("SELECT total_time_seconds FROM users WHERE id=?", (user['id'],)).fetchone()
        return jsonify({"success": True, "total_time": updated_user['total_time_seconds']})
    finally:
        if conn: conn.close()

@app.route('/api/sync_history', methods=['POST'])
def sync_history():
    data = request.json
    token = data.get('token')
    chat_history = data.get('chat_history', '[]')
    
    user = get_user_from_token(token)
    if not user: return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    conn = None
    try:
        conn = get_db_connection()
        conn.execute("UPDATE users SET chat_history = ? WHERE id = ?", (chat_history, user['id']))
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"!!! Sync History Error: {e}")
        return jsonify({"success": False, "message": "Server error"}), 500
    finally:
        if conn: conn.close()

# --- FILE UPLOAD ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({"success": False, "message": "No file"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"success": False, "message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        extracted_text = ""
        try:
            if filename.lower().endswith('.pdf') and PDF_SUPPORT:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages: extracted_text += page.extract_text() + "\n"
            elif filename.lower().endswith(('.png', '.jpg', '.jpeg')) and OCR_SUPPORT:
                img = Image.open(file)
                extracted_text = pytesseract.image_to_string(img)
            else:
                return jsonify({"success": False, "message": "Unsupported file type"}), 400
            
            extracted_text = re.sub(r'\s+', ' ', extracted_text).strip()
            if not extracted_text: return jsonify({"success": False, "message": "Empty content"}), 400
            return jsonify({"success": True, "text": extracted_text})
        except Exception as e:
            if "tesseract" in str(e).lower() or "not in your path" in str(e).lower():
                return jsonify({"success": False, "message": "Tesseract OCR is not installed on this system. Please install Tesseract to use image uploads."}), 400
            return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": False, "message": "Invalid file"}), 400

# --- ANALYSIS & EXPORT ---
def analyze_text_logic(text):
    words = text.split()
    wc = len(words)
    if wc == 0: return {"wordCount": 0, "recommendedMode": "default", "complexity": "Empty"}
    avg = sum(len(w) for w in words) / wc
    mode = "default"
    if avg > 6: mode = "dyslexia"
    if wc > 150: mode = "adhd"
    return {"wordCount": wc, "recommendedMode": mode, "complexity": "Standard"}

@app.route('/api/analyze', methods=['POST'])
def analyze():
    return jsonify(analyze_text_logic(request.json.get('text', '')))

# --- KEYWORD & ACTION ITEM EXTRACTION ---
# Common English stop-words to filter out
STOP_WORDS = set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','was','are','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall',
    'it','its','this','that','these','those','i','we','you','he','she','they',
    'me','us','him','her','them','my','our','your','his','our','their',
    'what','which','who','how','when','where','why','if','so','as','not',
    'also','then','than','into','can','just','more','about','after','before',
    'up','out','all','any','some','such','other','new','because','through'
])

# Action-item signal words (imperative verbs common in academic/study text)
ACTION_VERBS = [
    'analyze','analyse','compare','contrast','define','describe','discuss',
    'evaluate','examine','explain','identify','illustrate','interpret',
    'justify','list','outline','prove','review','state','summarize',
    'assess','calculate','classify','create','demonstrate','determine',
    'develop','differentiate','distinguish','estimate','investigate',
    'justify','measure','observe','predict','present','propose',
    'recommend','relate','select','show','solve','support','trace'
]

def extract_keywords(text, top_n=10):
    """Extract top-N important keywords using word frequency (stop-word filtered)."""
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    freq = {}
    for w in words:
        if w not in STOP_WORDS:
            freq[w] = freq.get(w, 0) + 1
    sorted_words = sorted(freq, key=lambda x: freq[x], reverse=True)
    return sorted_words[:top_n]

def extract_action_items(text):
    """Find sentences that start with or contain action verbs."""
    sentences = re.split(r'[.!?।]', text)
    action_phrases = []
    pattern = re.compile(r'\b(' + '|'.join(ACTION_VERBS) + r')\b', re.IGNORECASE)
    for sent in sentences:
        sent = sent.strip()
        if sent and pattern.search(sent):
            # Grab the matched verb + surrounding words as a short phrase
            match = pattern.search(sent)
            start = max(0, match.start() - 0)
            phrase = sent[start:start+60].strip()
            if len(phrase) > 5:
                action_phrases.append(phrase)
    return action_phrases[:8]  # Return max 8 action items

@app.route('/api/keywords', methods=['POST'])
def keywords():
    text = request.json.get('text', '')
    if not text:
        return jsonify({"keywords": [], "action_items": []})
    kw = extract_keywords(text, top_n=12)
    ai = extract_action_items(text)
    return jsonify({"keywords": kw, "action_items": ai})

@app.route('/api/simplify', methods=['POST'])
def simplify():
    text = request.json.get('text', '')
    summary = [s.strip() for s in re.split(r'[.!?।]', text) if s.strip()][:3]
    return jsonify({"summary": summary})

@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    if not PDF_EXPORT: return jsonify({"success": False, "message": "PDF lib missing"}), 500
    data = request.json
    text = data.get('text', '')
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        clean_text = text.encode('latin-1', 'ignore').decode('latin-1')
        pdf.multi_cell(0, 10, txt=clean_text)
        buffer = io.BytesIO()
        pdf_bytes = pdf.output(dest='S').encode('latin-1')
        buffer.write(pdf_bytes)
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name="notes.pdf", mimetype='application/pdf')
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    # host='0.0.0.0' is required for GitHub Codespaces to see the app
    app.run(host='0.0.0.0', debug=True, port=5000)
