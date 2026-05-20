#pragma once

// ============================================================
//   SmartPark – ESP32-CAM Configuration
//   תפקיד: צילום + שליחת JPEG לשרת + תשובה ל-DEVKITC
// ============================================================

// --- WiFi ---
#define WIFI_SSID       "GranadierR"
#define WIFI_PASSWORD   "0528909491"
#define WIFI_TIMEOUT_MS  15000

// --- Server ---
#define SERVER_URL      "http://192.168.1.67:5000"
#define GATE_TYPE       "entry"

// ============================================================
//   Hardware Pins – ESP32-CAM AI Thinker (אל תשנה!)
// ============================================================

#define FLASH_LED_PIN    4

// Camera pin mapping (AI Thinker – קבוע בחומרה)
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
//   UART לתקשורת עם ESP32-DEVKITC
//   UART0 (GPIO1=TX, GPIO3=RX) – כאשר אין USB מחובר
// ============================================================
#define DEVKIT_UART_BAUD  115200

// ============================================================
//   Logic Parameters
// ============================================================
#define WIFI_RETRY_COUNT   5
