#pragma once
/**
 * barrier_control.h – שליטה במחסום חניון
 * ספרייה נדרשת: ESP32Servo (זמינה ב-Arduino Library Manager)
 */

#include <Arduino.h>
#include <ESP32Servo.h>
#include "config.h"

static Servo _barrierServo;
static bool  _barrierOpen = false;

void initBarrier() {
  _barrierServo.attach(SERVO_PIN);
  _barrierServo.write(BARRIER_CLOSE_ANGLE);
  _barrierOpen = false;
  delay(500);
  Serial.println("[BARRIER] Initialized – closed");
}

void openBarrier() {
  if (!_barrierOpen) {
    Serial.println("[BARRIER] Opening");
    _barrierServo.write(BARRIER_OPEN_ANGLE);
    _barrierOpen = true;
  }
}

void closeBarrier() {
  if (_barrierOpen) {
    Serial.println("[BARRIER] Closing");
    _barrierServo.write(BARRIER_CLOSE_ANGLE);
    _barrierOpen = false;
  }
}

bool isBarrierOpen() { return _barrierOpen; }
