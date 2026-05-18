/**
 * SmartPark Firmware  –  ESP32-CAM AI Thinker
 * ================================================
 * זרימת עבודה:
 *  1. חיישן אולטרסוני מזהה רכב מתקרב
 *  2. מצלמה מצלמת את לוחית הרישוי
 *  3. תמונת JPEG נשלחת לשרת Flask
 *  4. שרת Flask קורא לוחית עם Gemini ומחפש עובד
 *  5. אם מאושר – מחסום נפתח + תגובה מוצגת ב-LCD
 *  6. במקביל: polling כל 3 שניות לפקודות ידניות מהאתר
 *
 * ספריות (Arduino Library Manager):
 *   ESP32Servo | LiquidCrystal I2C | ArduinoJson | esp32-camera (built-in)
 *
 * חיווט:
 *   HC-SR04  TRIG -> GPIO12 | ECHO -> GPIO13
 *   Servo         -> GPIO14
 *   LCD I2C  SDA  -> GPIO15 | SCL  -> GPIO2
 *   Flash LED     -> GPIO4 (builtin)
 */

#include "config.h"
#include "camera_module.h"
#include "ultrasonic_sensor.h"
#include "barrier_control.h"
#include "lcd_display.h"
#include "wifi_manager.h"

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ─── מצבי מערכת ──────────────────────────────────────────────
enum SystemState {
  STATE_IDLE,
  STATE_VEHICLE_DETECTED,
  STATE_CAPTURING,
  STATE_PROCESSING,
  STATE_BARRIER_OPEN,
  STATE_ERROR
};

SystemState   currentState    = STATE_IDLE;
unsigned long barrierOpenedAt = 0;
unsigned long lastDetectionAt = 0;
unsigned long lastPollAt      = 0;

// ─── Setup ───────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n==============================");
  Serial.println("  SmartPark  –  AI Thinker");
  Serial.println("==============================");

  initDisplay();
  displayMessage("SmartPark v2.0", "Starting...");

  if (!initCamera()) {
    displayMessage("FATAL ERROR", "Camera init!");
    while (true) delay(1000);
  }

  initUltrasonic();
  initBarrier();
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  connectWiFi();

  displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
  Serial.println("[SYS] Ready. Gate: " GATE_TYPE);
}

// ─── Loop ────────────────────────────────────────────────────
void loop() {
  ensureWiFiConnected();

  // ── State Machine ──────────────────────────────────────────
  switch (currentState) {

    case STATE_IDLE: {
      float dist    = getStableDistance();
      bool cooldown = (millis() - lastDetectionAt) > DETECTION_COOLDOWN;

      if (dist < DETECTION_DISTANCE_CM && cooldown) {
        Serial.printf("[US] Vehicle at %.1f cm\n", dist);
        lastDetectionAt = millis();
        currentState = STATE_VEHICLE_DETECTED;
      }
      break;
    }

    case STATE_VEHICLE_DETECTED: {
      displayMessage("Vehicle", "Detected...");
      delay(400);
      currentState = STATE_CAPTURING;
      break;
    }

    case STATE_CAPTURING: {
      displayMessage("Scanning", "Plate...");
      digitalWrite(FLASH_LED_PIN, HIGH);
      delay(80);
      camera_fb_t *fb = captureImage();
      digitalWrite(FLASH_LED_PIN, LOW);

      if (!fb) {
        displayMessage("ERROR", "Capture fail");
        currentState = STATE_ERROR;
        break;
      }

      currentState = STATE_PROCESSING;
      String jsonResp = sendImageToServer(fb->buf, fb->len);
      esp_camera_fb_return(fb);

      if (jsonResp.isEmpty()) {
        displayMessage("ERROR", "Server error");
        currentState = STATE_ERROR;
        break;
      }

      StaticJsonDocument<512> doc;
      if (deserializeJson(doc, jsonResp) != DeserializationError::Ok) {
        displayMessage("ERROR", "Bad response");
        currentState = STATE_ERROR;
        break;
      }

      bool        approved  = doc["approved"]      | false;
      const char* empName   = doc["employee_name"] | "";
      const char* eventType = doc["event_type"]    | "entry";
      const char* reason    = doc["reason"]        | "Denied";
      const char* plate     = doc["plate"]         | "???";

      if (approved) {
        char nameShort[17];
        strncpy(nameShort, empName, 16);
        nameShort[16] = '\0';
        const char* msg = (strcmp(eventType, "entry") == 0) ? "Welcome!" : "Goodbye!";
        displayMessage(nameShort, msg);
        Serial.printf("[OK] %s | %s | %s\n", empName, plate, eventType);
        openBarrier();
        barrierOpenedAt = millis();
        currentState = STATE_BARRIER_OPEN;
      } else {
        Serial.printf("[DENIED] %s – %s\n", plate, reason);
        displayMessage(plate, reason);
        delay(3000);
        displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
        currentState = STATE_IDLE;
      }
      break;
    }

    case STATE_BARRIER_OPEN: {
      if (millis() - barrierOpenedAt >= BARRIER_OPEN_DURATION) {
        closeBarrier();
        displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
        currentState = STATE_IDLE;
        Serial.println("[BARRIER] Closed");
      }
      break;
    }

    case STATE_ERROR: {
      delay(3000);
      displayMessage("SmartPark Ready", "Gate: " GATE_TYPE);
      currentState = STATE_IDLE;
      break;
    }
  }

  // ── Polling פקודות ידניות מהאתר (כל GATE_POLL_INTERVAL) ────
  if (millis() - lastPollAt >= GATE_POLL_INTERVAL) {
    lastPollAt = millis();
    if (currentState == STATE_IDLE || currentState == STATE_ERROR) {
      checkManualGateCommand();
    }
  }

  delay(80);
}

// ─── שליחת תמונה לשרת ────────────────────────────────────────
String sendImageToServer(const uint8_t *data, size_t len) {
  if (!ensureWiFiConnected()) return "";

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/plates/recognize?gate_type=" + GATE_TYPE;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(20000);   // 20 שניות – Gemini API עשוי לקחת זמן

  int code = http.POST(const_cast<uint8_t*>(data), len);
  String resp = "";
  if (code == 200) {
    resp = http.getString();
    Serial.printf("[HTTP] 200: %s\n", resp.c_str());
  } else {
    Serial.printf("[HTTP] Error %d\n", code);
  }
  http.end();
  return resp;
}

// ─── polling: פקודת פתיחה ידנית ────────────────────────────────
// GET /api/gates/command?gate_type=<GATE_TYPE>
void checkManualGateCommand() {
  if (!ensureWiFiConnected()) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/gates/command?gate_type=" + GATE_TYPE;
  http.begin(url);
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

  Serial.printf("[GATE] Manual open by: %s (cmd %d)\n", empName, cmdId);

  char nameShort[17];
  strncpy(nameShort, empName, 16);
  nameShort[16] = '\0';

  bool isEntry = (strcmp(GATE_TYPE, "entry") == 0);
  displayMessage(nameShort, isEntry ? "Manual entry" : "Manual exit");

  openBarrier();
  barrierOpenedAt = millis();
  currentState    = STATE_BARRIER_OPEN;

  // אישור לשרת
  HTTPClient ack;
  String ackUrl = String(SERVER_URL) + "/api/gates/ack/" + String(cmdId);
  ack.begin(ackUrl);
  ack.addHeader("Content-Type", "application/json");
  int ackCode = ack.POST("");
  Serial.printf("[GATE] Ack: %d\n", ackCode);
  ack.end();
}
