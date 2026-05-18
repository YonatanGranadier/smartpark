#pragma once
/**
 * wifi_manager.h – ניהול חיבור WiFi
 * תלוי ב: oled_display.h, config.h
 */

#include <WiFi.h>
#include <Arduino.h>
#include "config.h"
#include "oled_display.h"

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_RETRY_COUNT * 10) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected: %s\n", WiFi.localIP().toString().c_str());
    displayMessage("WiFi Connected", WiFi.localIP().toString().c_str());
    delay(1500);
  } else {
    Serial.println("\n[WiFi] Failed! Restarting...");
    displayMessage("WiFi FAILED", "Restarting...");
    delay(3000);
    ESP.restart();
  }
}

bool ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("[WiFi] Reconnecting...");
  displayMessage("Reconnecting...", "WiFi");
  connectWiFi();
  return WiFi.status() == WL_CONNECTED;
}
