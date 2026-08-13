from flask import Flask, request, jsonify, session, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta
import secrets, string, os

db_url = os.environ.get('DATABASE_URL', 'sqlite:///day_to_day.db')
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'day-to-day-super-secret-key-987654321')
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

db = SQLAlchemy(app)

# ── Models ──────────────────────────────────────────────────────────────────
class User(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

class Task(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(250), nullable=True)
    completed   = db.Column(db.Boolean, default=False)
    priority    = db.Column(db.String(10), default='medium')
    due_date    = db.Column(db.String(20), nullable=True)
    due_time    = db.Column(db.String(10), nullable=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

def task_dict(t):
    return {'id': t.id, 'title': t.title, 'description': t.description,
            'completed': t.completed, 'priority': t.priority,
            'due_date': getattr(t, 'due_date', None),
            'due_time': getattr(t, 'due_time', None)}

def auth_required():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

# ── Pages ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' not in session:
        return render_template('auth.html')
    return render_template('app.html')

@app.route('/sw.js')
def sw():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')

# ── Auth ─────────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    d = request.json or {}
    u = (d.get('username') or '').strip()
    p = d.get('password') or ''
    if not u or not p:
        return jsonify({'error': 'Username and password required'}), 400
    if User.query.filter_by(username=u).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(username=u, password_hash=generate_password_hash(p))
    db.session.add(user); db.session.commit()
    session.permanent = True
    session['user_id'] = user.id
    session['username'] = user.username
    return jsonify({'message': 'Registered', 'username': user.username})

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json or {}
    u = (d.get('username') or '').strip()
    p = d.get('password') or ''
    if not u or not p:
        return jsonify({'error': 'Username and password required'}), 400
    user = User.query.filter_by(username=u).first()
    if user and check_password_hash(user.password_hash, p):
        session.permanent = True
        session['user_id'] = user.id
        session['username'] = user.username
        return jsonify({'message': 'OK', 'username': user.username})
    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/api/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'username': session.get('username', '')})

# ── Tasks ────────────────────────────────────────────────────────────────────
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    err = auth_required()
    if err: return err
    pf = request.args.get('priority', 'all')
    q  = Task.query.filter_by(user_id=session['user_id'])
    if pf and pf != 'all': q = q.filter_by(priority=pf)
    tasks = q.order_by(Task.id.desc()).all()
    s = request.args.get('search', '').strip().lower()
    if s:
        tasks = [t for t in tasks if s in t.title.lower() or (t.description and s in t.description.lower())]
    return jsonify([task_dict(t) for t in tasks])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    err = auth_required()
    if err: return err
    d = request.json
    t = Task(title=d.get('title'), description=d.get('description',''),
             priority=d.get('priority','medium'),
             due_date=d.get('due_date') or None,
             due_time=d.get('due_time') or None,
             user_id=session['user_id'])
    db.session.add(t); db.session.commit()
    return jsonify(task_dict(t)), 201

@app.route('/api/tasks/<int:tid>', methods=['PUT'])
def update_task(tid):
    err = auth_required()
    if err: return err
    t = Task.query.filter_by(id=tid, user_id=session['user_id']).first()
    if not t: return jsonify({'error': 'Not found'}), 404
    d = request.json
    for k in ('title','description','completed','priority','due_date','due_time'):
        if k in d:
            val = d[k]
            if k in ('due_date', 'due_time'):
                val = val or None
            setattr(t, k, val)
    db.session.commit()
    return jsonify(task_dict(t))

@app.route('/api/tasks/<int:tid>', methods=['DELETE'])
def delete_task(tid):
    err = auth_required()
    if err: return err
    t = Task.query.filter_by(id=tid, user_id=session['user_id']).first()
    if not t: return jsonify({'error': 'Not found'}), 404
    db.session.delete(t); db.session.commit()
    return jsonify({'message': 'Deleted'})

@app.route('/api/tasks/clear-completed', methods=['DELETE'])
def clear_completed():
    err = auth_required()
    if err: return err
    Task.query.filter_by(user_id=session['user_id'], completed=True).delete()
    db.session.commit()
    return jsonify({'message': 'Cleared'})

# ── Password Generator ────────────────────────────────────────────────────────
@app.route('/api/generate')
def generate():
    try: length = max(8, min(128, int(request.args.get('length', 16))))
    except: length = 16
    try: count = max(1, min(10, int(request.args.get('count', 1))))
    except: count = 1

    AMBIGUOUS = set('0Ol1I|`')
    chars = ''
    if request.args.get('uppercase') == 'true': chars += string.ascii_uppercase
    if request.args.get('lowercase') == 'true': chars += string.ascii_lowercase
    if request.args.get('numbers')   == 'true': chars += string.digits
    if request.args.get('symbols')   == 'true': chars += string.punctuation
    if request.args.get('no_ambiguous') == 'true':
        chars = ''.join(c for c in chars if c not in AMBIGUOUS)
    if not chars:
        return jsonify({'error': 'Select at least one character type'}), 400

    name = request.args.get('name', '').strip()
    def build():
        if name:
            eff = max(length, len(name))
            pad = [secrets.choice(chars) for _ in range(eff - len(name))]
            pos = secrets.randbelow(len(pad)+1) if pad else 0
            return ''.join(pad[:pos] + list(name) + pad[pos:])
        return ''.join(secrets.choice(chars) for _ in range(length))

    return jsonify({'passwords': [build() for _ in range(count)]})

# ── Boot ─────────────────────────────────────────────────────────────────────
def init_db():
    with app.app_context():
        db.create_all()
        try:
            from sqlalchemy import text
            db.session.execute(text("ALTER TABLE task ADD COLUMN due_time VARCHAR(10)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

