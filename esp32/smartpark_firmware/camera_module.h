#pragma once
/**
 * camera_module.h – ESP32-CAM AI Thinker
 * מאתחל את מצלמת ה-OV2640 ומספק פונקציית צילום.
 */

#include "esp_camera.h"
#include "config.h"

bool initCamera() {
  camera_config_t cfg;
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0       = Y2_GPIO_NUM;
  cfg.pin_d1       = Y3_GPIO_NUM;
  cfg.pin_d2       = Y4_GPIO_NUM;
  cfg.pin_d3       = Y5_GPIO_NUM;
  cfg.pin_d4       = Y6_GPIO_NUM;
  cfg.pin_d5       = Y7_GPIO_NUM;
  cfg.pin_d6       = Y8_GPIO_NUM;
  cfg.pin_d7       = Y9_GPIO_NUM;
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
  cfg.frame_size   = FRAMESIZE_VGA;    // 640×480 – מספיק ל-OCR
  cfg.jpeg_quality = 12;               // 0=הכי טוב, 63=הכי נמוך
  cfg.fb_count     = 1;

  if (psramFound()) {
    cfg.frame_size   = FRAMESIZE_SVGA;
    cfg.jpeg_quality = 10;
    cfg.fb_count     = 2;
  }

  esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init failed: 0x%x\n", err);
    return false;
  }

  // כיוונון חשיפה לתאורת חוץ
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);
    s->set_saturation(s, -1);
  }

  Serial.println("[CAM] Initialized OK");
  return true;
}

/**
 * מצלם תמונה. המשתמש חייב לשחרר את ה-frame buffer אחרי השימוש:
 *   esp_camera_fb_return(fb);
 */
camera_fb_t* captureImage() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAM] Capture failed");
  }
  return fb;
}
