/**
 * SmartPark – ESP32-CAM AI Thinker  (Single-File)
 * =================================================
 * Board: "AI Thinker ESP32-CAM"
 *
 * UART לתקשורת עם DEVKITC:
 *   GPIO1 (U0TX) → DEVKITC RX (GPIO16)
 *   GPIO3 (U0RX) ← DEVKITC TX (GPIO17)
 *
 * ⚠️  נתק את מתאם ה-USB מה-CAM לפני הפעלת המערכת!
 *     פעל את ה-CAM מ-5V/GND של ה-DEVKITC.
 */

// ============================================================
//  CONFIGURATION
// ============================================================
#define WIFI_SSID        "GranadierR"
#define WIFI_PASSWORD    "0528909491"
#define SERVER_URL       "http://192.168.1.67:5000"
#define GATE_TYPE        "entry"   // "entry" או "exit"

#define DEVKIT_UART_BAUD  115200
#define FLASH_LED_PIN     4
#define HTTP_TIMEOUT_MS   20000

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
//  INCLUDES
// ============================================================
#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ============================================================
//  Simple JSON helpers (no extra library needed)
// ============================================================
static bool jsonBool(const String& j, const char* key) {
  String s = String('"') + key + "\":";
  int i = j.indexOf(s);
  if (i < 0) return false;
  i += s.length();
  while (i < (int)j.length() && j[i] == ' ') i++;
  return j.substring(i, i + 4) == "true";
}

static String jsonStr(const String& j, const char* key) {
  String s = String('"') + key + "\":\"";
  int i = j.indexOf(s);
  if (i < 0) return "";
  i += s.length();
  int e = j.indexOf('"', i);
  if (e < 0) return "";
  return j.substring(i, e);
}

// ============================================================
//  LED helpers
// ============================================================
void ledBlink(int times, int onMs = 120, int offMs = 120) {
  for (int i = 0; i < times; i++) {
    digitalWrite(FLASH_LED_PIN, HIGH); delay(onMs);
    digitalWrite(FLASH_LED_PIN, LOW);  delay(offMs);
  }
}

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
  // VGA (640x480) – good balance of quality vs upload speed for OCR
  cfg.frame_size   = FRAMESIZE_VGA;
  cfg.jpeg_quality = 8;   // lower = better quality (1-63)
  cfg.fb_count     = psramFound() ? 2 : 1;

  if (esp_camera_init(&cfg) != ESP_OK) return false;

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s,  1);
    s->set_saturation(s, -1);
    s->set_sharpness(s,   1);
  }
  return true;
}

// Warm up: first frame after init is often under-exposed – discard it
void warmupCamera() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb);
  delay(200);
}

// ============================================================
//  WIFI
// ============================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int waited = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    waited += 500;
    if (waited >= 30000) {   // 30 s – restart and try again
      ESP.restart();
    }
  }
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.reconnect();
  for (int i = 0; i < 20; i++) {   // wait up to 10 s
    if (WiFi.status() == WL_CONNECTED) return true;
    delay(500);
  }
  return false;
}

// ============================================================
//  SETUP
// ============================================================
void handleCapture();  // forward declaration

void setup() {
  Serial.begin(DEVKIT_UART_BAUD);
  delay(200);
  Serial.flush();   // clear any noise on the line

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // Camera init – rapid blink on failure
  if (!initCamera()) {
    while (true) {
      ledBlink(5, 60, 60);
      Serial.println("ERROR");
      delay(3000);
    }
  }
  warmupCamera();

  // WiFi – slow blink while connecting
  ledBlink(2, 300, 300);
  connectWiFi();

  // 3 quick blinks = WiFi OK + ready
  ledBlink(3, 80, 80);

  // Tell the DevKit (and anyone monitoring) we are alive
  Serial.println("READY");
  Serial.flush();
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "CAPTURE") {
      handleCapture();
    }
    // ignore anything else (noise, partial bytes, etc.)
  }
  delay(10);
}

// ============================================================
//  CAPTURE + POST TO SERVER
// ============================================================
void handleCapture() {
  if (!ensureWiFi()) {
    Serial.println("ERROR");
    Serial.flush();
    return;
  }

  // Flash on – capture
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(100);   // let auto-exposure settle
  camera_fb_t* fb = esp_camera_fb_get();
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) {
    Serial.println("ERROR");
    Serial.flush();
    return;
  }

  // POST JPEG to server
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/plates/recognize?gate_type=" + GATE_TYPE;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(HTTP_TIMEOUT_MS);

  int code = http.POST(const_cast<uint8_t*>(fb->buf), fb->len);
  esp_camera_fb_return(fb);

  if (code != 200) {
    http.end();
    Serial.println("ERROR");
    Serial.flush();
    return;
  }

  String body = http.getString();
  http.end();

  // Parse JSON response (no external library)
  bool   approved  = jsonBool(body, "approved");
  String empName   = jsonStr(body, "employee_name");
  String eventType = jsonStr(body, "event_type");
  String reason    = jsonStr(body, "reason");
  if (eventType.isEmpty()) eventType = "entry";
  if (reason.isEmpty())    reason    = "Access denied";

  if (approved) {
    Serial.printf("APPROVED:%s:%s\n", empName.c_str(), eventType.c_str());
    ledBlink(2, 200, 100);   // 2 long blinks = approved
  } else {
    Serial.printf("DENIED:%s\n", reason.c_str());
    ledBlink(5, 60, 60);     // rapid blinks = denied
  }
  Serial.flush();
}