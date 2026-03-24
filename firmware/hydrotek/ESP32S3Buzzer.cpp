#include "ESP32S3Buzzer.h"
#include "Arduino.h"

#if __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#endif

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
#define HYDROTEK_LEDC_USES_PIN_API 1
#endif

ESP32S3Buzzer::ESP32S3Buzzer(uint8_t pin, uint8_t channel)
    : _pin(pin), _ledcChannel(channel), _isPlaying(false), _startTime(0), _currentDuration(0), _isToneOn(false), _currentCycle(0) {}

void ESP32S3Buzzer::begin() {
#if defined(HYDROTEK_LEDC_USES_PIN_API)
  ledcAttach(_pin, 1, 13);
#else
  ledcSetup(_ledcChannel, 1, 13);
  ledcAttachPin(_pin, _ledcChannel);
#endif
}

void ESP32S3Buzzer::end() {
#if defined(HYDROTEK_LEDC_USES_PIN_API)
  ledcWriteTone(_pin, 0);
  ledcDetach(_pin);
#else
  ledcWriteTone(_ledcChannel, 0);
  ledcDetachPin(_pin);
#endif
}

void ESP32S3Buzzer::tone(uint32_t freq, uint32_t onDuration, uint32_t offDuration, uint16_t cycles) {
  Tone newTone = {freq, onDuration, offDuration, cycles};
  _toneQueue.push(newTone);
}

void ESP32S3Buzzer::update() {
  if (_isPlaying) {
    if (millis() - _startTime >= _currentDuration) {
      if (_isToneOn) {
        _isToneOn = false;
#if defined(HYDROTEK_LEDC_USES_PIN_API)
        ledcWriteTone(_pin, 0);
#else
        ledcWriteTone(_ledcChannel, 0);
#endif
        _currentDuration = _toneQueue.front().offDuration;
        _currentCycle++;
      } else {
        if (_currentCycle < _toneQueue.front().cycles) {
          _isToneOn = true;
#if defined(HYDROTEK_LEDC_USES_PIN_API)
          ledcWriteTone(_pin, _toneQueue.front().frequency);
#else
          ledcWriteTone(_ledcChannel, _toneQueue.front().frequency);
#endif
          _currentDuration = _toneQueue.front().onDuration;
        } else {
          _isPlaying = false;
          _toneQueue.pop();
        }
      }
      _startTime = millis();
    }
  } else if (!_toneQueue.empty()) {
    _isPlaying = true;
    _isToneOn = true;
#if defined(HYDROTEK_LEDC_USES_PIN_API)
    ledcWriteTone(_pin, _toneQueue.front().frequency);
#else
    ledcWriteTone(_ledcChannel, _toneQueue.front().frequency);
#endif
    _startTime = millis();
    _currentDuration = _toneQueue.front().onDuration;
    _currentCycle = 0;
  }
}
