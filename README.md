# SmartPark – מערכת חכמה לניהול נוכחות עובדים דרך החניון

מערכת מלאה לזיהוי רכבי עובדים בכניסה/יציאה מהחניון באמצעות **ESP32-CAM**, זיהוי לוחית רישוי (OCR) ותיעוד שעות עבודה אוטומטי.

---

## ארכיטקטורה

```
┌──────────────────────────────────────────────────────────────┐
│                    חניון עובדים                               │
│                                                              │
│  ┌────────────┐    WiFi    ┌──────────────────────────────┐  │
│  │ ESP32-CAM  │ ────────►  │   FastAPI Backend (Python)   │  │
│  │ HC-SR04    │            │   SQLite DB                  │  │
│  │ Servo      │ ◄────────  │   OpenCV + EasyOCR (LPR)    │  │
│  │ LCD 16x2   │            └──────────────────────────────┘  │
│  └────────────┘                        ▲                     │
│                                        │ REST API            │
│                               ┌────────────────┐            │
│                               │  React Frontend │            │
│                               │  (Vite + Tailwind)          │
│                               └────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## רכיבי חומרה

| רכיב | תפקיד | GPIO (ESP32-CAM AI Thinker) |
|------|--------|----------------------------|
| ESP32-CAM (AI Thinker) | בקר ראשי + מצלמה | – |
| HC-SR04 | זיהוי כניסת רכב | TRIG=12, ECHO=13 |
| Servo SG90/MG996R | פתיחת/סגירת מחסום | GPIO 14 |
| LCD 16x2 I2C | הצגת מידע | SDA=15, SCL=2 |
| נורת פלאש | תאורת לוחית | GPIO 4 (מובנה) |

### תרשים חיווט

```
ESP32-CAM          HC-SR04
GPIO12  ──────►  TRIG
GPIO13  ◄──────  ECHO
3.3V    ──────►  VCC
GND     ──────►  GND

ESP32-CAM          Servo
GPIO14  ──────►  Signal (כתום)
5V      ──────►  VCC (אדום)
GND     ──────►  GND (חום)

ESP32-CAM          LCD I2C
GPIO15  ──────►  SDA
GPIO2   ──────►  SCL
5V      ──────►  VCC
GND     ──────►  GND
```

> ⚠️ **חשוב:** GPIO0 חייב להיות HIGH בזמן הפעלה רגילה (לא בזמן תכנות).  
> ⚠️ עבוד עם ספק כוח 5V/2A לפחות – ה-ESP32-CAM צורך זרם גבוה בזמן WiFi+Camera.

---

## דרישות תוכנה

### ESP32 (Arduino IDE)
- Board: `esp32` by Espressif (1.0.6+)
- ספריות (Library Manager):
  - `ESP32Servo`
  - `LiquidCrystal I2C` by Frank de Brabander
  - `ArduinoJson` by Benoit Blanchon

### Backend (Python 3.11+)
```bash
pip install -r requirements.txt
```

### Frontend (Node.js 18+)
```bash
cd frontend
npm install
```

---

## הפעלה

### 1. Backend
```bash
cd backend
# העתק קובץ הגדרות
copy .env.example .env

# הפעל שרת
python run.py
```
השרת יעלה על `http://0.0.0.0:8000`  
תיעוד API: `http://localhost:8000/docs`

### 2. Frontend
```bash
cd frontend
npm run dev
```
ממשק Web: `http://localhost:5173`

### 3. ESP32
1. פתח `esp32/smartpark_firmware/smartpark_firmware.ino` ב-Arduino IDE
2. ערוך `config.h` – הכנס SSID, סיסמת WiFi וכתובת השרת
3. בחר Board: **AI Thinker ESP32-CAM**
4. העלה את הקוד

---

## זרימת עבודה

```
1. רכב מתקרב לשער
2. HC-SR04 מזהה רכב (מרחק < 80 ס"מ)
3. ESP32-CAM מצלם תמונה (Flash LED מופעל רגע)
4. תמונת JPEG נשלחת לשרת:
     POST /api/plates/recognize?gate_type=entry
5. השרת:
   a. EasyOCR מחלץ את מספר הלוחית
   b. בדיקה מול בסיס הנתונים
   c. תיעוד אירוע כניסה/יציאה
   d. החזרת תשובה JSON
6. ESP32:
   ✅ מורשה → פותח מחסום (סרבו) + מציג שם על LCD
   ❌ לא מורשה → מציג סיבת דחייה
7. לאחר 8 שניות – מחסום נסגר אוטומטית
```

---

## API Endpoints

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/plates/recognize?gate_type=entry` | זיהוי לוחית (ESP32) |
| GET | `/api/employees/` | רשימת עובדים |
| POST | `/api/employees/` | הוספת עובד |
| PUT | `/api/employees/{id}` | עדכון עובד |
| DELETE | `/api/employees/{id}` | מחיקת עובד |
| POST | `/api/employees/{id}/plates` | הוספת לוחית |
| GET | `/api/attendance/` | היסטוריית נוכחות |
| GET | `/api/attendance/current` | מי בחניון כרגע |
| GET | `/api/attendance/today` | נוכחות היום |
| GET | `/api/attendance/reports/work-hours` | דוח שעות עבודה |

---

## מבנה הפרויקט

```
smartpark final/
├── esp32/
│   └── smartpark_firmware/
│       ├── smartpark_firmware.ino  # קוד ראשי
│       ├── config.h                # הגדרות WiFi, פינים, שרת
│       ├── camera_module.h         # אתחול מצלמה ולכידה
│       ├── ultrasonic_sensor.h     # חיישן HC-SR04
│       ├── barrier_control.h       # שליטה במחסום
│       ├── lcd_display.h           # תצוגת LCD
│       └── wifi_manager.h          # ניהול WiFi
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app
│   │   ├── database.py             # SQLAlchemy / SQLite
│   │   ├── models.py               # טבלאות DB
│   │   ├── schemas.py              # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── employees.py        # CRUD עובדים
│   │   │   ├── attendance.py       # נוכחות ודוחות
│   │   │   └── plates.py           # זיהוי לוחית (ESP32)
│   │   └── services/
│   │       ├── lpr_service.py      # OpenCV + EasyOCR
│   │       └── attendance_service.py
│   ├── requirements.txt
│   └── run.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx       # לוח בקרה
        │   ├── Employees.jsx       # ניהול עובדים
        │   ├── Attendance.jsx      # היסטוריית נוכחות
        │   └── Reports.jsx         # דוחות שעות
        └── ...
```

---

## רישיון

פרויקט פנימי – לשימוש לימודי/עסקי.
