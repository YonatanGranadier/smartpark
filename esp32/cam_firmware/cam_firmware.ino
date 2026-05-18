/**
 * SmartPark – ESP32-CAM AI Thinker  (Single-File)
 * =================================================
 * ערוך את ה-CONFIGURATION בחלק הראשון לפי הסביבה שלך.
 *
 * ספריות נדרשות (Arduino Library Manager):
 *   ArduinoJson  |  esp32-camera (built-in עם ה-board)
 *
 * Board: "AI Thinker ESP32-CAM"
 *
 * UART לתקשורת עם DEVKITC:
 *   GPIO1 (U0T) TX → DEVKITC RX (GPIO16)
 *   GPIO3 (U0R) RX ← DEVKITC TX (GPIO17)
 * ⚠️ נתק USB מה-CAM לפני הפעלת המערכת!
 */

// ============================================================
//  CONFIGURATION – ערוך כאן
// ============================================================

#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"
#define SERVER_URL        "http://192.168.1.100:5000"
#define GATE_TYPE         "entry"   // "entry" או "exit"

// Logic
#define DEVKIT_UART_BAUD  115200
#define WIFI_RETRY_COUNT  5

// Flash LED
#define FLASH_LED_PIN     4

// Camera pin mapping – AI Thinker (אל תשנה!)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================================
//  DEBUG MACRO
//  #define PRODUCTION  → debug messages compile to nothing
//  comment it out     → debug goes to Serial2 (GPIO14/15)
// ============================================================

#define PRODUCTION

#ifdef PRODUCTION
  #define DBG(...)  do {} while(0)
#else
  #define DBG(fmt, ...)  Serial2.printf(fmt, ##__VA_ARGS__)
#endif

// ============================================================
//  INCLUDES
// ============================================================

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================
//  CAMERA  (AI Thinker OV2640)
// ============================================================

bool initCamera() {
  camera_config_t cfg = {};
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0 = Y2_GPIO_NUM; cfg.pin_d1 = Y3_GPIO_NUM;
  cfg.pin_d2 = Y4_GPIO_NUM; cfg.pin_d3 = Y5_GPIO_NUM;
  cfg.pin_d4 = Y6_GPIO_NUM; cfg.pin_d5 = Y7_GPIO_NUM;
  cfg.pin_d6 = Y8_GPIO_NUM; cfg.pin_d7 = Y9_GPIO_NUM;
  cfg.pin_xclk     = XCLK_GPIO_NUM;
  cfg.pin_pclk     = PCLK_GPIO_NUM;
  cfg.pin_vsync    = VSYNC_GPIO_NUM;
  cfg.pin_href     = HREF_GPIO_NUM;
  cfg.pin_sscb_sda = SIOD_GPIO_NUM;
  cfg.pin_sscb_scl = SIOC_GPIO_NUM;
  cfg.pin_pwdn     = PWDN_GPIO_NUM;
  cfg.pin_reset    = RESET_GPIO_NUM;
  cfg.xclk_freq_hz = 20000000;
  cfg.pixel_format = PIXFORMAT_JPEG;
  cfg.fb_location  = CAMERA_FB_IN_PSRAM;
  cfg.frame_size   = FRAMESIZE_VGA;
  cfg.jpeg_quality = 12;
  cfg.fb_count     = 1;

  if (psramFound()) {
    cfg.frame_size   = FRAMESIZE_SVGA;
    cfg.jpeg_quality = 10;
    cfg.fb_count     = 2;
  }

  esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    DBG("[CAM] Init failed: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s) { s->set_brightness(s, 1); s->set_saturation(s, -1); }

  DBG("[CAM] Initialized OK\n");
  return true;
}

/** צלם תמונה. שחרר עם esp_camera_fb_return(fb) אחרי שימוש. */
camera_fb_t* captureImage() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) DBG("[CAM] Capture failed\n");
  return fb;
}

// ============================================================
//  SETUP & LOOP
// ============================================================

void handleCapture();  // forward declaration

void setup() {
  Serial.begin(DEVKIT_UART_BAUD);
  delay(100);

  DBG("[CAM] Starting...\n");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!initCamera()) {
    while (true) { Serial.println("ERROR"); delay(5000); }
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  DBG("[WiFi] Connecting");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < WIFI_RETRY_COUNT * 10) {
    delay(500); DBG("."); tries++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    delay(2000); ESP.restart();
  }

  DBG("\n[WiFi] Connected\n");
  DBG("[CAM] Ready\n");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    DBG("[CAM] Received: %s\n", cmd.c_str());
    if (cmd == "CAPTURE") handleCapture();
  }
  delay(20);
}

// ============================================================
//  CAPTURE + POST TO SERVER
// ============================================================

void handleCapture() {
  // ודא WiFi
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(3000);
    if (WiFi.status() != WL_CONNECTED) { Serial.println("ERROR"); return; }
  }

  // Flash + צלם
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(80);
  camera_fb_t* fb = captureImage();
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) { Serial.println("ERROR"); return; }

  DBG("[CAM] Captured %d bytes\n", fb->len);

  // שלח JPEG לשרת
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/plates/recognize?gate_type=" + GATE_TYPE;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(22000);

  int code = http.POST(const_cast<uint8_t*>(fb->buf), fb->len);
  esp_camera_fb_return(fb);

  if (code != 200) {
    DBG("[CAM] HTTP error: %d\n", code);
    http.end(); Serial.println("ERROR"); return;
  }

  String body = http.getString();
  http.end();
  DBG("[CAM] Server: %s\n", body.c_str());

  // פרסר JSON
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) {
    Serial.println("ERROR"); return;
  }

  bool        approved  = doc["approved"]      | false;
  const char* empName   = doc["employee_name"] | "";
  const char* eventType = doc["event_type"]    | "entry";
  const char* reason    = doc["reason"]        | "Access denied";

  // תשובה ל-DEVKITC
  if (approved) {
    Serial.printf("APPROVED:%s:%s\n", empName, eventType);
  } else {
    Serial.printf("DENIED:%s\n", reason);
  }
}
