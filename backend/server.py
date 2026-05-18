"""
SmartPark – Flask Backend
=========================
שרת לניהול נוכחות עובדים בחניון.

הפעלה:
    python server.py
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from datetime import datetime, timedelta
from functools import wraps
from collections import defaultdict
import jwt
import bcrypt
import os
from dotenv import load_dotenv
import cv2
import numpy as np
import easyocr
from model import recognize_plate as _roboflow_recognize_plate

load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smartpark.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

SECRET_KEY         = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
TOKEN_HOURS        = int(os.getenv('TOKEN_EXPIRE_HOURS', '8'))
CMD_EXPIRE_MINUTES = int(os.getenv('GATE_COMMAND_EXPIRE_MINUTES', '2'))
ROBOFLOW_API_KEY  = os.getenv('ROBOFLOW_API_KEY', '')
ROBOFLOW_MODEL_ID = os.getenv('ROBOFLOW_MODEL_ID', 'license-plate-recognition-rxg4e/4')

# ─── Lazy-loaded LPR resources ─────────────────────────────────────────
# המודלים נטענים באיחור ראשון בלבד כדי לא לעכב את השרת
_plate_model = None    # Roboflow detection model
_ocr_reader  = None    # EasyOCR reader


def _get_plate_model():
    global _plate_model
    if _plate_model is None:
        from inference import get_model
        if ROBOFLOW_API_KEY:
            os.environ.setdefault('ROBOFLOW_API_KEY', ROBOFLOW_API_KEY)
        _plate_model = get_model(ROBOFLOW_MODEL_ID)
    return _plate_model


def _get_ocr():
    global _ocr_reader
    if _ocr_reader is None:
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    return _ocr_reader


# ═══════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════

class Employee(db.Model):
    __tablename__ = 'employees'
    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(100), nullable=False)
    employee_number = db.Column(db.String(20), unique=True, nullable=False)
    department      = db.Column(db.String(50))
    email           = db.Column(db.String(100))
    phone           = db.Column(db.String(20))
    is_active       = db.Column(db.Boolean, default=True)
    password_hash   = db.Column(db.String(200))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    plates        = db.relationship('LicensePlate', backref='employee', lazy=True,
                                    cascade='all, delete-orphan')
    attendance    = db.relationship('AttendanceRecord', backref='employee', lazy=True,
                                    cascade='all, delete-orphan')
    gate_commands = db.relationship('GateCommand', backref='employee', lazy=True,
                                    cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':              self.id,
            'name':            self.name,
            'employee_number': self.employee_number,
            'department':      self.department,
            'email':           self.email,
            'phone':           self.phone,
            'is_active':       self.is_active,
            'created_at':      self.created_at.isoformat(),
            'plates':          [{'id': p.id, 'plate_number': p.plate_number} for p in self.plates],
        }


class AttendanceRecord(db.Model):
    __tablename__ = 'attendance'
    id          = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    event_type  = db.Column(db.String(10), nullable=False)   # 'entry' | 'exit'
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)
    gate_id     = db.Column(db.String(20), default='main')

    def to_dict(self):
        return {
            'id':            self.id,
            'employee_id':   self.employee_id,
            'employee_name': self.employee.name if self.employee else '',
            'event_type':    self.event_type,
            'timestamp':     self.timestamp.isoformat(),
            'gate_id':       self.gate_id,
        }


class GateCommand(db.Model):
    __tablename__ = 'gate_commands'
    id           = db.Column(db.Integer, primary_key=True)
    gate_type    = db.Column(db.String(10), nullable=False)   # 'entry' | 'exit'
    requested_by = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    status       = db.Column(db.String(20), default='pending')  # pending/executed/expired
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    executed_at  = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id':           self.id,
            'gate_type':    self.gate_type,
            'requested_by': self.requested_by,
            'status':       self.status,
            'created_at':   self.created_at.isoformat(),
            'executed_at':  self.executed_at.isoformat() if self.executed_at else None,
        }


class LicensePlate(db.Model):
    __tablename__ = 'license_plates'
    id           = db.Column(db.Integer, primary_key=True)
    plate_number = db.Column(db.String(20), unique=True, nullable=False)
    employee_id  = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'plate_number': self.plate_number, 'employee_id': self.employee_id}


# ═══════════════════════════════════════════════════════════════
# Auth helpers
# ═══════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(employee_id: int) -> str:
    payload = {
        'sub': employee_id,
        'exp': datetime.utcnow() + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'detail': 'Missing token'}), 401
        token = auth_header.split(' ', 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            emp = db.session.get(Employee, payload['sub'])
            if not emp or not emp.is_active:
                return jsonify({'detail': 'Unauthorized'}), 401
            g.current_employee = emp
        except jwt.ExpiredSignatureError:
            return jsonify({'detail': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'detail': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def _expire_old_commands():
    cutoff = datetime.utcnow() - timedelta(minutes=CMD_EXPIRE_MINUTES)
    GateCommand.query.filter(
        GateCommand.status == 'pending',
        GateCommand.created_at < cutoff
    ).update({'status': 'expired'})
    db.session.commit()


def recognize_plate_locally(image_bytes: bytes) -> str:
    """
    זיהוי לוחית רישוי בציוד מקומי (ללא שירות ענן):
      1. זיהוי אזור הלוחית בתמונה באמצעות מודל Roboflow מאומן מראש (דרישת ROBOFLOW_API_KEY בטעינה ראשונה)
      2. חיתוך אזור הלוחית + EasyOCR לקריאת הטקסט
    """
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return ''

    plate_crop = img   # fallback: תמונה מלאה אם הגילוי נכשל

    try:
        model   = _get_plate_model()
        results = model.infer(img)[0]
        if results.predictions:
            best = max(results.predictions, key=lambda p: p.confidence)
            x, y, w, h = int(best.x), int(best.y), int(best.width), int(best.height)
            x1 = max(0, x - w // 2)
            y1 = max(0, y - h // 2)
            x2 = min(img.shape[1], x + w // 2)
            y2 = min(img.shape[0], y + h // 2)
            plate_crop = img[y1:y2, x1:x2]
    except Exception as exc:
        app.logger.warning(f'[LPR] Roboflow detection skipped: {exc}')

    try:
        reader = _get_ocr()
        parts  = reader.readtext(
            plate_crop, detail=0,
            allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        )
        text = ''.join(parts).upper().replace(' ', '').replace('-', '')
        return text if len(text) >= 4 else ''
    except Exception as exc:
        app.logger.error(f'[LPR] EasyOCR failed: {exc}')
        return ''


def _record_attendance(emp, event_type: str, gate_id: str = 'main', plate: str = '') -> 'AttendanceRecord':
    """Saves attendance record and emits real-time SocketIO event to all connected clients."""
    rec = AttendanceRecord(employee_id=emp.id, event_type=event_type, gate_id=gate_id)
    db.session.add(rec)
    db.session.commit()
    socketio.emit('attendance_event', {
        'event':         event_type,
        'employee_id':   emp.id,
        'employee_name': emp.name,
        'department':    emp.department or '',
        'plate':         plate,
        'timestamp':     rec.timestamp.isoformat(),
        'gate_id':       gate_id,
    })
    return rec


# ═══════════════════════════════════════════════════════════════
# Auth  /api/auth
# ═══════════════════════════════════════════════════════════════

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    emp = Employee.query.filter_by(employee_number=data.get('employee_number')).first()
    if not emp or not emp.password_hash or \
            not verify_password(data.get('password', ''), emp.password_hash):
        return jsonify({'detail': 'מספר עובד או סיסמה שגויים'}), 401
    if not emp.is_active:
        return jsonify({'detail': 'משתמש אינו פעיל'}), 403
    return jsonify({'access_token': create_token(emp.id), 'token_type': 'bearer',
                    'employee': emp.to_dict()})


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_me():
    return jsonify(g.current_employee.to_dict())


@app.route('/api/auth/change-password', methods=['PUT'])
@require_auth
def change_password():
    data = request.get_json()
    pw = data.get('password', '')
    if len(pw) < 6:
        return jsonify({'detail': 'הסיסמה חייבת לכלול לפחות 6 תווים'}), 400
    g.current_employee.password_hash = hash_password(pw)
    db.session.commit()
    return jsonify({'message': 'הסיסמה עודכנה'})


@app.route('/api/auth/admin/set-password', methods=['PUT'])
def admin_set_password():
    data = request.get_json()
    emp = db.session.get(Employee, data.get('employee_id'))
    if not emp:
        return jsonify({'detail': 'עובד לא נמצא'}), 404
    pw = data.get('password', '')
    if len(pw) < 6:
        return jsonify({'detail': 'הסיסמה חייבת לכלול לפחות 6 תווים'}), 400
    emp.password_hash = hash_password(pw)
    db.session.commit()
    return jsonify({'message': 'הסיסמה עודכנה'})


# ═══════════════════════════════════════════════════════════════
# Employees  /api/employees
# ═══════════════════════════════════════════════════════════════

@app.route('/api/employees', methods=['GET'])
def get_employees():
    emps = Employee.query.order_by(Employee.name).all()
    return jsonify([e.to_dict() for e in emps])


@app.route('/api/employees/<int:emp_id>', methods=['GET'])
def get_employee(emp_id):
    emp = db.session.get(Employee, emp_id)
    if not emp:
        return jsonify({'detail': 'לא נמצא'}), 404
    return jsonify(emp.to_dict())


@app.route('/api/employees', methods=['POST'])
def create_employee():
    data = request.get_json()
    if not data.get('name') or not data.get('employee_number'):
        return jsonify({'detail': 'שם ומספר עובד הם שדות חובה'}), 400
    if Employee.query.filter_by(employee_number=data['employee_number']).first():
        return jsonify({'detail': 'מספר עובד כבר קיים'}), 400
    emp = Employee(
        name=data['name'],
        employee_number=data['employee_number'],
        department=data.get('department'),
        email=data.get('email'),
        phone=data.get('phone'),
    )
    db.session.add(emp)
    db.session.commit()
    return jsonify(emp.to_dict()), 201


@app.route('/api/employees/<int:emp_id>', methods=['PUT'])
def update_employee(emp_id):
    emp = db.session.get(Employee, emp_id)
    if not emp:
        return jsonify({'detail': 'לא נמצא'}), 404
    data = request.get_json()
    for field in ('name', 'department', 'email', 'phone', 'is_active'):
        if field in data:
            setattr(emp, field, data[field])
    db.session.commit()
    return jsonify(emp.to_dict())


@app.route('/api/employees/<int:emp_id>', methods=['DELETE'])
def delete_employee(emp_id):
    emp = db.session.get(Employee, emp_id)
    if not emp:
        return jsonify({'detail': 'לא נמצא'}), 404
    db.session.delete(emp)
    db.session.commit()
    return jsonify({'message': 'נמחק'})


@app.route('/api/employees/<int:emp_id>/plates', methods=['POST'])
def add_plate(emp_id):
    emp = db.session.get(Employee, emp_id)
    if not emp:
        return jsonify({'detail': 'עובד לא נמצא'}), 404
    data = request.get_json()
    plate_num = (data.get('plate_number') or '').strip().upper()
    if not plate_num:
        return jsonify({'detail': 'מספר לוחית חסר'}), 400
    if LicensePlate.query.filter_by(plate_number=plate_num).first():
        return jsonify({'detail': 'לוחית כבר קיימת'}), 400
    lp = LicensePlate(plate_number=plate_num, employee_id=emp_id)
    db.session.add(lp)
    db.session.commit()
    return jsonify(lp.to_dict()), 201


@app.route('/api/employees/<int:emp_id>/plates/<plate_number>', methods=['DELETE'])
def remove_plate(emp_id, plate_number):
    lp = LicensePlate.query.filter_by(
        plate_number=plate_number.upper(), employee_id=emp_id).first()
    if not lp:
        return jsonify({'detail': 'לא נמצא'}), 404
    db.session.delete(lp)
    db.session.commit()
    return jsonify({'message': 'נמחק'})


# ═══════════════════════════════════════════════════════════════
# LPR – זיהוי לוחית רישוי באמצעות Gemini  /api/plates
# ═══════════════════════════════════════════════════════════════

@app.route('/api/plates/recognize', methods=['POST'])
def recognize_plate():
    """ESP32-CAM שולח JPEG bytes. השרת מזהה לוחית באמצעות Roboflow מקומי + EasyOCR,
    מחפש בבסיס הנתונים ומעדכן את הנוכחות בזמן אמת."""
    gate_type   = request.args.get('gate_type', 'entry')
    image_bytes = request.data
    if not image_bytes:
        return jsonify({'approved': False, 'reason': 'No image'}), 400

    plate = _roboflow_recognize_plate(image_bytes)
    if not plate:
        socketio.emit('attendance_event', {
            'event': 'denied', 'reason': 'לא ניתן לקרוא לוחית'
        })
        return jsonify({'approved': False, 'reason': 'Cannot read plate', 'plate': ''})

    lp = LicensePlate.query.filter_by(plate_number=plate).first()
    if not lp:
        socketio.emit('attendance_event', {
            'event': 'denied', 'plate': plate, 'reason': 'לוחית לא רשומה'
        })
        return jsonify({'approved': False, 'reason': 'Unknown plate', 'plate': plate})

    emp = db.session.get(Employee, lp.employee_id)
    if not emp or not emp.is_active:
        socketio.emit('attendance_event', {
            'event': 'denied', 'plate': plate, 'reason': 'עובד לא פעיל'
        })
        return jsonify({'approved': False, 'reason': 'Inactive employee', 'plate': plate})

    rec = _record_attendance(emp, gate_type, gate_id=gate_type, plate=plate)
    return jsonify({
        'approved':      True,
        'employee_name': emp.name,
        'plate':         plate,
        'event_type':    gate_type,
    })

def _is_employee_in(employee_id: int) -> bool:
    last = AttendanceRecord.query \
        .filter_by(employee_id=employee_id) \
        .order_by(AttendanceRecord.timestamp.desc()).first()
    return last is not None and last.event_type == 'entry'


@app.route('/api/attendance/checkin', methods=['POST'])
@require_auth
def checkin():
    emp = g.current_employee
    if _is_employee_in(emp.id):
        return jsonify({'detail': 'אתה כבר רשום כמו נמצא בחניון'}), 409
    rec = _record_attendance(emp, 'entry', gate_id='manual')
    cmd = GateCommand(gate_type='entry', requested_by=emp.id)
    db.session.add(cmd)
    db.session.commit()
    return jsonify({'attendance': rec.to_dict(), 'gate_command': cmd.to_dict()}), 201


@app.route('/api/attendance/checkout', methods=['POST'])
@require_auth
def checkout():
    emp = g.current_employee
    if not _is_employee_in(emp.id):
        return jsonify({'detail': 'אינך רשום כמו נמצא בחניון'}), 409
    rec = _record_attendance(emp, 'exit', gate_id='manual')
    cmd = GateCommand(gate_type='exit', requested_by=emp.id)
    db.session.add(cmd)
    db.session.commit()
    return jsonify({'attendance': rec.to_dict(), 'gate_command': cmd.to_dict()}), 201


@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    q = AttendanceRecord.query
    emp_id = request.args.get('employee_id', type=int)
    if emp_id:
        q = q.filter_by(employee_id=emp_id)
    limit = request.args.get('limit', 50, type=int)
    recs = q.order_by(AttendanceRecord.timestamp.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in recs])


@app.route('/api/attendance/today', methods=['GET'])
def get_today():
    today = datetime.utcnow().date()
    recs = AttendanceRecord.query.filter(
        db.func.date(AttendanceRecord.timestamp) == today
    ).order_by(AttendanceRecord.timestamp.desc()).all()
    return jsonify([r.to_dict() for r in recs])


@app.route('/api/attendance/current', methods=['GET'])
def get_current_parking():
    result = []
    for emp in Employee.query.filter_by(is_active=True).all():
        if _is_employee_in(emp.id):
            last = AttendanceRecord.query.filter_by(employee_id=emp.id) \
                .order_by(AttendanceRecord.timestamp.desc()).first()
            d = emp.to_dict()
            d['since'] = last.timestamp.isoformat()
            result.append(d)
    return jsonify(result)


@app.route('/api/attendance/status', methods=['GET'])
@require_auth
def get_my_status():
    status = 'in' if _is_employee_in(g.current_employee.id) else 'out'
    return jsonify({'status': status})


@app.route('/api/attendance/reports/work-hours', methods=['GET'])
def work_hours_report():
    from_date = request.args.get('from_date')
    to_date   = request.args.get('to_date')

    q = AttendanceRecord.query.order_by(
        AttendanceRecord.employee_id, AttendanceRecord.timestamp)
    all_recs = q.all()

    by_emp = defaultdict(list)
    for r in all_recs:
        iso = r.timestamp.date().isoformat()
        if from_date and iso < from_date:
            continue
        if to_date and iso > to_date:
            continue
        by_emp[r.employee_id].append(r)

    result = []
    for emp_id, records in by_emp.items():
        emp = db.session.get(Employee, emp_id)
        total_minutes = 0
        i = 0
        while i < len(records) - 1:
            if records[i].event_type == 'entry' and records[i + 1].event_type == 'exit':
                diff = records[i + 1].timestamp - records[i].timestamp
                total_minutes += diff.total_seconds() / 60
                i += 2
            else:
                i += 1
        result.append({
            'employee_id':   emp_id,
            'employee_name': emp.name if emp else 'Unknown',
            'department':    emp.department if emp else '',
            'total_minutes': round(total_minutes),
            'total_hours':   round(total_minutes / 60, 1),
        })

    result.sort(key=lambda x: x['total_hours'], reverse=True)
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════
# Gates  /api/gates
# ═══════════════════════════════════════════════════════════════

@app.route('/api/gates/my-command', methods=['GET'])
@require_auth
def get_my_command():
    _expire_old_commands()
    cmd = GateCommand.query \
        .filter_by(requested_by=g.current_employee.id) \
        .order_by(GateCommand.created_at.desc()).first()
    if not cmd:
        return jsonify({'detail': 'אין פקודה'}), 404
    return jsonify(cmd.to_dict())


@app.route('/api/gates/command', methods=['GET'])
def get_gate_command_for_esp():
    """ESP32 מבצע polling לנקודת קצה זו כל 3 שניות."""
    _expire_old_commands()
    gate_type = request.args.get('gate_type', 'entry')
    cmd = GateCommand.query \
        .filter_by(gate_type=gate_type, status='pending') \
        .order_by(GateCommand.created_at.asc()).first()
    if not cmd:
        return jsonify({'has_command': False})
    return jsonify({
        'has_command':   True,
        'command_id':    cmd.id,
        'gate_type':     cmd.gate_type,
        'employee_name': cmd.employee.name if cmd.employee else 'Unknown',
    })


@app.route('/api/gates/ack/<int:command_id>', methods=['POST'])
def ack_gate_command(command_id):
    """ESP32 שולח אישור שהשער נפתח."""
    cmd = db.session.get(GateCommand, command_id)
    if not cmd:
        return jsonify({'detail': 'לא נמצא'}), 404
    cmd.status = 'executed'
    cmd.executed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'ok'})


# ═══════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=False, host='0.0.0.0', port=5000, use_reloader=False, allow_unsafe_werkzeug=True)
