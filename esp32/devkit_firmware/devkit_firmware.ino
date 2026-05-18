/**
 * SmartPark – ESP32-DEVKITC  (Single-File)
 * ==========================================
 * ערוך את ה-CONFIGURATION בחלק הראשון לפי הסביבה שלך.
 *
 * ספריות נדרשות (Arduino Library Manager):
 *   ESP32Servo | U8g2 | ArduinoJson
 *
 * Board: "ESP32 Dev Module"
 *
 * חיווט:
 *   HC-SR04   TRIG → GPIO25 | ECHO → GPIO26
 *   Servo     SIG  → GPIO18
 *   Grove OLED SDA → GPIO21 | SCL  → GPIO22
 *   UART לCAM: TX(17) → CAM RX(3)  |  RX(16) ← CAM TX(1)
 */

// ============================================================
//  CONFIGURATION – ערוך כאן
// ============================================================

#define WIFI_SSID                "YOUR_WIFI_SSID"
#define WIFI_PASSWORD            "YOUR_WIFI_PASSWORD"
#define SERVER_URL               "http://192.168.1.100:5000"
#define GATE_TYPE                "entry"   // "entry" או "exit"

#define TRIG_PIN                 25
#define ECHO_PIN                 26
#define SERVO_PIN                18
#define OLED_SDA_PIN             21
#define OLED_SCL_PIN             22
#define CAM_UART_BAUD            115200
#define CAM_TX_PIN               17
#define CAM_RX_PIN               16

#define DETECTION_DISTANCE_CM    80.0f
#define BARRIER_OPEN_DURATION    8000
#define DETECTION_COOLDOWN       8000
#define GATE_POLL_INTERVAL       3000
#define CAM_RESPONSE_TIMEOUT_MS  22000
#define BARRIER_OPEN_ANGLE       90
#define BARRIER_CLOSE_ANGLE      0
#define WIFI_RETRY_COUNT         5

// ============================================================
//  INCLUDES
// ============================================================

#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================================
//  OLED  (Grove 1.12" v2.0 – SH1107 128×128)
//  אם יש לך v1.0 (SSD1327 96×96) שנה ל:
//  static U8G2_SSD1327_MIDAS_96X96_F_HW_I2C _oled(U8G2_R0, U8X8_PIN_NONE);
// ============================================================

static U8G2_SH1107_128X128_F_HW_I2C _oled(U8G2_R0, U8X8_PIN_NONE);

void initDisplay() {
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  _oled.begin();
  _oled.clearBuffer();
  _oled.sendBuffer();
}

void displayMessage(const char* line1, const char* line2 = "") {
  _oled.clearBuffer();
  _oled.setFont(u8g2_font_ncenB12_tr);
  _oled.drawStr(0, 24, line1);
  if (line2 && line2[0] != '\0') {
    _oled.setFont(u8g2_font_ncenR10_tr);
    _oled.drawStr(0, 55, line2);
  }
  _oled.sendBuffer();
}

// ============================================================
//  ULTRASONIC  HC-SR04
// ============================================================

void initUltrasonic() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
}

float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long d = pulseIn(ECHO_PIN, HIGH, 30000UL);
  return d ? (d * 0.0343f) / 2.0f : 999.0f;
}

float getStableDistance(uint8_t samples = 3) {
  float sum = 0; uint8_t cnt = 0;
  for (uint8_t i = 0; i < samples; i++) {
    float d = measureDistance();
    if (d < 500.0f) { sum += d; cnt++; }
    delay(20);
  }
  return cnt ? (sum / cnt) : 999.0f;
}

// ============================================================
//  BARRIER  Servo
// ============================================================

static Servo _barrierServo;
static bool  _barrierOpen = false;

void initBarrier() {
  _barrierServo.attach(SERVO_PIN);
  _barrierServo.write(BARRIER_CLOSE_ANGLE);
  _barrierOpen = false;
  delay(500);
}

void openBarrier() {
  if (!_barrierOpen) { _barrierServo.write(BARRIER_OPEN_ANGLE);  _barrierOpen = true;  Serial.println("[BARRIER] Open");   }
}
void closeBarrier() {
  if (_barrierOpen)  { _barrierServo.write(BARRIER_CLOSE_ANGLE); _barrierOpen = false; Serial.println("[BARRIER] Closed"); }
}

// ============================================================
//  WIFI
// ============================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_RETRY_COUNT * 10) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected: %s\n", WiFi.localIP().toString().c_str());
    displayMessage("WiFi Connected", WiFi.localIP().toString().c_str());
    delay(1500);
  } else {
    displayMessage("WiFi FAILED", "Restarting..."); delay(3000); ESP.restart();
  }
}

bool ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return true;
  displayMessage("Reconnecting...", "WiFi");
  connectWiFi();
  return WiFi.status() == WL_CONNECTED;
}

// ============================================================
//  STATE MACHINE
// ============================================================

#define CamSerial Serial2

enum SystemState { STATE_IDLE, STATE_VEHICLE_DETECTED, STATE_WAITING_CAM, STATE_BARRIER_OPEN, STATE_ERROR };

SystemState   currentState    = STATE_IDLE;
unsigned long barrierOpenedAt = 0;
unsigned long lastDetectionAt = 0;
unsigned long lastPollAt      = 0;
unsigned long camRequestedAt  = 0;

void handleCamResponse(const String& line);
void checkManualGateCommand();

// ─── Setup ──────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== SmartPark DEVKITC ===");
  initDisplay();
  displayMessage("SmartPark", "Starting...");
  initUltrasonic();
  initBarrier();
  CamSerial.begin(CAM_UART_BAUD, SERIAL_8N1, CAM_RX_PIN, CAM_TX_PIN);
  connectWiFi();
  displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
  Serial.println("[SYS] Ready. Gate: " GATE_TYPE);
}

// ─── Loop ───────────────────────────────────────────────────

void loop() {
  ensureWiFiConnected();

  switch (currentState) {

    case STATE_IDLE: {
      float dist = getStableDistance();
      if (dist < DETECTION_DISTANCE_CM && (millis() - lastDetectionAt) > DETECTION_COOLDOWN) {
        Serial.printf("[US] Vehicle at %.1f cm\n", dist);
        lastDetectionAt = millis();
        currentState = STATE_VEHICLE_DETECTED;
      }
      break;
    }

    case STATE_VEHICLE_DETECTED:
      displayMessage("Vehicle", "Detected...");
      delay(300);
      CamSerial.println("CAPTURE");
      camRequestedAt = millis();
      currentState   = STATE_WAITING_CAM;
      displayMessage("Scanning...", "Please wait");
      Serial.println("[CAM] Sent CAPTURE");
      break;

    case STATE_WAITING_CAM:
      if (millis() - camRequestedAt > CAM_RESPONSE_TIMEOUT_MS) {
        displayMessage("ERROR", "Cam timeout");
        currentState = STATE_ERROR;
        break;
      }
      if (CamSerial.available()) {
        String line = CamSerial.readStringUntil('\n');
        line.trim();
        Serial.printf("[CAM] Response: %s\n", line.c_str());
        handleCamResponse(line);
      }
      break;

    case STATE_BARRIER_OPEN:
      if (millis() - barrierOpenedAt >= BARRIER_OPEN_DURATION) {
        closeBarrier();
        displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
        currentState = STATE_IDLE;
      }
      break;

    case STATE_ERROR:
      delay(3000);
      displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
      currentState = STATE_IDLE;
      break;
  }

  if (millis() - lastPollAt >= GATE_POLL_INTERVAL) {
    lastPollAt = millis();
    if (currentState == STATE_IDLE || currentState == STATE_ERROR)
      checkManualGateCommand();
  }

  delay(80);
}

// ─── CAM response handler ────────────────────────────────────

void handleCamResponse(const String& line) {
  if (line.isEmpty() || line.startsWith("[")) return;

  if (line.startsWith("APPROVED:")) {
    int    c1  = line.indexOf(':', 9);
    String emp = (c1 > 0) ? line.substring(9, c1)  : line.substring(9);
    String evt = (c1 > 0) ? line.substring(c1 + 1) : "entry";
    char   buf[33]; emp.toCharArray(buf, 33);
    displayMessage(buf, evt.startsWith("exit") ? "Goodbye!" : "Welcome!");
    Serial.printf("[OK] %s\n", buf);
    openBarrier();
    barrierOpenedAt = millis();
    currentState    = STATE_BARRIER_OPEN;

  } else if (line.startsWith("DENIED:")) {
    char buf[33]; line.substring(7).toCharArray(buf, 33);
    displayMessage("Access Denied", buf);
    Serial.printf("[DENIED] %s\n", buf);
    currentState = STATE_ERROR;

  } else if (line == "ERROR") {
    displayMessage("ERROR", "Cam error");
    currentState = STATE_ERROR;
  }
}

// ─── Manual gate command polling ────────────────────────────

void checkManualGateCommand() {
  if (!ensureWiFiConnected()) return;

  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/gates/command?gate_type=" + GATE_TYPE);
  http.setTimeout(5000);
  int code = http.GET();
  if (code != 200) { http.end(); return; }

  String body = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, body) != DeserializationError::Ok) return;
  if (!doc["has_command"].as<bool>()) return;

  int         cmdId   = doc["command_id"].as<int>();
  const char* empName = doc["employee_name"] | "Employee";
  char        nameBuf[33]; strncpy(nameBuf, empName, 32); nameBuf[32] = '\0';

  Serial.printf("[GATE] Manual: %s (cmd %d)\n", nameBuf, cmdId);
  displayMessage(nameBuf, (String(GATE_TYPE) == "entry") ? "Manual entry" : "Manual exit");

  openBarrier();
  barrierOpenedAt = millis();
  currentState    = STATE_BARRIER_OPEN;

  HTTPClient ack;
  ack.begin(String(SERVER_URL) + "/api/gates/ack/" + String(cmdId));
  ack.addHeader("Content-Type", "application/json");
  ack.POST(""); ack.end();
}
