#pragma once
/**
 * ultrasonic_sensor.h – HC-SR04
 * מדידת מרחק. משתמש ב-pulseIn עם timeout.
 */

#include "config.h"

void initUltrasonic() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  Serial.println("[US] Ultrasonic sensor initialized");
}

/** מחזיר מרחק בס"מ, או 999 אם אין מדידה תקינה. */
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);   // timeout 30ms ≈ 5 מטר
  if (duration == 0) return 999.0f;
  return (duration * 0.0343f) / 2.0f;
}

/** ממוצע של SAMPLES מדידות. מסנן ערכים חריגים. */
float getStableDistance(uint8_t samples = 3) {
  float   sum = 0;
  uint8_t cnt = 0;
  for (uint8_t i = 0; i < samples; i++) {
    float d = measureDistance();
    if (d < 500.0f) { sum += d; cnt++; }
    delay(20);
  }
  return cnt ? (sum / cnt) : 999.0f;
}

bool isVehiclePresent() {
  return getStableDistance() < DETECTION_DISTANCE_CM;
}
