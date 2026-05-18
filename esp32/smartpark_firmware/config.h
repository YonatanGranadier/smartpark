#pragma once

// ============================================================
//   SmartPark - Configuration
//   עדכן את הפרטים הבאים לפי הסביבה שלך
// ============================================================

// --- WiFi ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS  15000

// --- Server ---
// כתובת השרת Flask  (דוגמה: "http://192.168.1.100:5000")
#define SERVER_URL      "http://192.168.1.100:5000"

// סוג השער: "entry" = כניסה, "exit" = יציאה
#define GATE_TYPE       "entry"

// ============================================================
//   Hardware Pins  (ESP32-CAM AI Thinker)
//   ⚠️  אל תשנה את פיני המצלמה – קבועים בחומרה
// ============================================================

// HC-SR04 – חיישן אולטרסוני
#define TRIG_PIN        12
#define ECHO_PIN        13

// Servo – מחסום חניון
#define SERVO_PIN       14

// LCD 16x2 I2C
#define LCD_SDA_PIN     15
#define LCD_SCL_PIN      2

// Flash LED מובנה
#define FLASH_LED_PIN    4

// ============================================================
//   Camera Module – AI Thinker pin mapping (אל תשנה!)
// ============================================================
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

// ============================================================
//   Logic Parameters
// ============================================================

// מרחק בס"מ שמתחתיו מחשיב שיש רכב
#define DETECTION_DISTANCE_CM   80.0f

// זמן שהמחסום נשאר פתוח (ms)
#define BARRIER_OPEN_DURATION   8000

// זמן מינימלי בין זיהויים (ms) – מניעת זיהוי כפול
#define DETECTION_COOLDOWN      8000

// מרווח polling לפקודות שער ידניות (ms)
#define GATE_POLL_INTERVAL      3000

// זווית סרבו: פתוח / סגור
#define BARRIER_OPEN_ANGLE      90
#define BARRIER_CLOSE_ANGLE      0

// מספר ניסיונות חיבור WiFi לפני Restart
#define WIFI_RETRY_COUNT         5



// ============================================================
//   Hardware Pins  (ESP32-CAM AI Thinker)
//   ⚠️  אל תשנה את פיני המצלמה – הם קבועים בחומרה
// ============================================================

// HC-SR04 – חיישן אולטרסוני
#define TRIG_PIN        12
#define ECHO_PIN        13

// Servo – מחסום חניון
#define SERVO_PIN       14

// LCD 16x2 I2C
#define LCD_SDA_PIN     15
#define LCD_SCL_PIN      2

// Flash LED מובנה
#define FLASH_LED_PIN    4

// ============================================================
//   Logic Parameters
// ============================================================

// מרחק בס"מ שמעליו מחשיב שיש רכב
#define DETECTION_DISTANCE_CM   80.0f

// זמן שהמחסום נשאר פתוח (ms)
#define BARRIER_OPEN_DURATION   8000

// זמן מינימלי בין זיהויים (ms) – מניעת זיהוי כפול
#define DETECTION_COOLDOWN      4000

// זווית סרבו: פתוח / סגור
#define BARRIER_OPEN_ANGLE      90
#define BARRIER_CLOSE_ANGLE      0

// מספר ניסיונות חיבור WiFi לפני Restart
#define WIFI_RETRY_COUNT         5

// ============================================================
//   Camera Module – AI Thinker pin mapping
// ============================================================
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22
