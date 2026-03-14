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
        except Exception as e: return jsonify({"success": False, "message": str(e)}), 500
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

@app.route('/api/simplify', methods=['POST'])
def simplify():
    text = request.json.get('text', '')
    summary = [s.strip() for s in re.split(r'[.!?]', text) if s.strip()][:3]
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
