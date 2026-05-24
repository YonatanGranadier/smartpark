#pragma once

// ============================================================
//   SmartPark – ESP32-DEVKITC Configuration
//   הלוח הראשי: אולטרסוני, סרבו, OLED, WiFi, UART לESP32-CAM
// ============================================================

// --- WiFi ---
#define WIFI_SSID       "GranadierR"
#define WIFI_PASSWORD   "0528909491"
#define WIFI_TIMEOUT_MS  15000

// --- Server ---
#define SERVER_URL      "http://192.168.1.67:5000"

// סוג השער: "entry" = כניסה, "exit" = יציאה
#define GATE_TYPE       "entry"

// ============================================================
//   Hardware Pins – ESP32-DEVKITC
// ============================================================

// HC-SR04 – חיישן אולטרסוני
#define TRIG_PIN        32
#define ECHO_PIN        33

// Servo – מחסום חניון
#define SERVO_PIN       25

// Grove OLED 1.12" I2C  (פיני I2C ברירת מחדל של DEVKITC)
#define OLED_SDA_PIN    21
#define OLED_SCL_PIN    22

// UART לתקשורת עם ESP32-CAM
//   DEVKITC TX (GPIO17) → ESP32-CAM RX (GPIO3 / U0R)
//   DEVKITC RX (GPIO16) ← ESP32-CAM TX (GPIO1 / U0T)
#define CAM_UART_BAUD   115200
#define CAM_TX_PIN      17
#define CAM_RX_PIN      16

// ============================================================
//   Logic Parameters
// ============================================================

// מרחק בס"מ שמתחתיו מזהה רכב
#define DETECTION_DISTANCE_CM   20.0f

// זמן שהמחסום נשאר פתוח (ms)
#define BARRIER_OPEN_DURATION   8000

// זמן מינימלי בין זיהויים (ms)
#define DETECTION_COOLDOWN      8000

// מרווח polling לפקודות שער ידניות (ms)
#define GATE_POLL_INTERVAL      3000

// זמן timeout לתשובה מESP32-CAM (ms) – Gemini עשוי לקחת עד 20 שניות
#define CAM_RESPONSE_TIMEOUT_MS 22000

// זווית סרבו: פתוח / סגור
#define BARRIER_OPEN_ANGLE      90
#define BARRIER_CLOSE_ANGLE      0

// מספר ניסיונות חיבור WiFi לפני Restart
#define WIFI_RETRY_COUNT         5
