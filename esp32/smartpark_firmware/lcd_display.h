#pragma once
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"

/**
 * lcd_display.h
 * תצוגת LCD 16x2 עם ממשק I2C.
 * ספרייה נדרשת: LiquidCrystal I2C by Frank de Brabander
 * כתובת I2C נפוצה: 0x27 או 0x3F (בדוק עם I2C Scanner)
 */

static LiquidCrystal_I2C _lcd(0x27, 16, 2);

void initDisplay() {
  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  _lcd.init();
  _lcd.backlight();
  _lcd.clear();
  Serial.println("[LCD] Initialized");
}

/** מציג שתי שורות על הצג */
void displayMessage(const char* line1, const char* line2 = "") {
  _lcd.clear();
  _lcd.setCursor(0, 0);
  _lcd.print(line1);
  _lcd.setCursor(0, 1);
  _lcd.print(line2);
}

/** מציג הודעה עם מס' שניות ספירה לאחור */
void displayCountdown(const char* msg, int seconds) {
  for (int i = seconds; i > 0; i--) {
    char buf[8];
    snprintf(buf, sizeof(buf), "%ds...  ", i);
    displayMessage(msg, buf);
    delay(1000);
  }
}
