/*
 * 
 * HydroTek hydroponics controller - tim eastwood
 * 
 * See https://github.com/Energiz3r/HydroTek for information and instructions
 *
 * A lot of this code could be external or at least classes but really only the button showed a need to be classed at this time
 * Device may be released as 'single plant' further negating the need to worry about it
 * 
 * Target: ESP32 Dev Module
 * 
 * Pin assignment notes: 
 * 
 *   This sketch to suit ESP32 "D1" WeMos D1 Mini compatible
 * 
 *  Pin notes:
 *  4,13,18,19,23,25,26,27,32,33 - OK (**19 grounded accidentally on latest PCB rev)
 *  2 - OK, connected to onboard LED
 *  5,14,15 - OK, PWM at boot
 *  34,35,36,39 - input only, no pull-up/down
 *  12 - output OK, boot fail if pulled HIGH
 *  21, 22 - SDA, SCL
 *  16,17 - OK, but RX, TX UART 2
 *  
 *  
 *  
 */

#define LOOP_SPEED 50 // frequency with which to update sensors and so on (every x ms). default 50. do not change

//#define PREFERENCES_CLEAR //deprecated. can be reset from the settings menu. uncomment to erase settings from flash
//#define SET_RTC_MANUAL // uncomment to force setting the RTC time to the sketch compile time
//#define offlineMode // deprecated. wifi can be disabled from the settings menu
//#define buttonDisable

#include "tones.h"

#include "menu-option.h"

// PIN ASSIGNMENTS
#define floatSw1Pin 23 // OK
#define floatSw2Pin 5 // OK
#define dhtPin 15 // WAS 16 // OK (dht2: 17)
#define flowPin 25 // OK (flow2: 32)
#define lampPin 18 // untested (lamp2: 18) 19 originally - bridged to ground on current PCB
#define pumpPin 26 // untested (pump2: 36)

#define ledPin 33 // not working (pin is not an output)
#define ledBrightness 20 // 0 - 255
#define buzzerPin 14 // OK (TMS)
#define buttonPinOK 32 // OK
#define buttonPinBK 27 // OK
#define buttonPinUP 13 // OK (TCK)
#define buttonPinDN 4 // OK (IO4)
#define buttonDurationLong 

#define aux1 19
#define aux2 2
#define aux3 15 //(TDO)
#define aux4 12 //(TDI)
// END PIN ASSIGNMENTS

String devicePassword = "";
String deviceID = "";
String accountID = "";
String deviceToken = "";
String wifiSSID = "";
String wifiPassphrase = "";

#define webEndpoint "http://minty:3030/api/device" // base URL for device API routes
#define lampHeaterTempVariance 0.5 // how much to allow the temp to vary from the desired setting before switching the state of the heater (lamp)
#define buttonShortTime 30 //ms
#define buttonLongTime 250 //ms
//#define flowPulsesPerMl 0.45 //flow sensor pulses per mL of liquid (YF-S201 sensor = 0.45) //deprecated. now an item in the settings menu
#define screenSleepTime 1 // how long to keep screen on for before sleeping (mins)
#define buttonDebounceTime 10 //ms
#define startupBeepEnabled true
#define startupLedPwmEnabled false

#include <Arduino.h>
#include "ESP32S3Buzzer.h"
const uint8_t buzzerChannel = 1; // specify the PWM channel to use for the buzzer
ESP32S3Buzzer buzzer(buzzerPin, buzzerChannel);

// ESP WiFi Includes
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>

// OLED display includes
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1); // -1 is the reset pin, or 4 // Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
bool displayAvailable = false;

// DHT sensor includes
#include "DHT.h"
DHT dht(dhtPin, DHT22); //pin, type

// RTC includes
#include <RTClib.h>
RTC_DS1307 RTC;

// JSON includes
#include <ArduinoJson.h>

Preferences preferences;
portMUX_TYPE flowPulseMux = portMUX_INITIALIZER_UNLOCKED;
volatile unsigned long flowPulseInterruptCount = 0;

void IRAM_ATTR onFlowPulse() {
  portENTER_CRITICAL_ISR(&flowPulseMux);
  flowPulseInterruptCount++;
  portEXIT_CRITICAL_ISR(&flowPulseMux);
}

unsigned long takePendingFlowPulses() {
  unsigned long pulses = 0;
  portENTER_CRITICAL(&flowPulseMux);
  pulses = flowPulseInterruptCount;
  flowPulseInterruptCount = 0;
  portEXIT_CRITICAL(&flowPulseMux);
  return pulses;
}

void clearPendingFlowPulses() {
  portENTER_CRITICAL(&flowPulseMux);
  flowPulseInterruptCount = 0;
  portEXIT_CRITICAL(&flowPulseMux);
}

extern bool calibratingFlowSensor;
extern unsigned long flowSensorCalibrationPulses;
extern MenuOption menuOptions[];
extern uint32_t localConfigVersion;

void startFlowCalibration() {
  calibratingFlowSensor = true;
  flowSensorCalibrationPulses = 0;
  clearPendingFlowPulses();
}

void finishFlowCalibration() {
  calibratingFlowSensor = false;
  flowSensorCalibrationPulses = flowSensorCalibrationPulses + takePendingFlowPulses();
  menuOptions[30].setFloatVal(flowSensorCalibrationPulses / 5.0 / 1000.0);
  flashWrite();
  flowSensorCalibrationPulses = 0;
  localConfigVersion++;
  webConfigWrite();
  markLocalConfigDirty();
}

// declare an array of menu option objects
#define NUM_MENU_OPTIONS 38
MenuOption menuOptions[NUM_MENU_OPTIONS] = {
  //(int pos (menu position), String title (description), String systemName (used for the 'preferences' library), String type (bool, int, or float), float defaultVal, float maxVal, float minVal, bool showInMenu, bool saveInFlash
  
  MenuOption(1, "Upload frequency", "uploadFreq", "int", 5, 1, true, true),
  //temp
  MenuOption(2, "Temp enable", "tenable", "bool", 1, 0.0, true, true),
  MenuOption(3, "HI Temp lamp off", "tlampshutoff", "bool", 0, 0, true, true),
  MenuOption(4, "Shutoff Temp degC", "tshutofftemp", "float", 60, 5, true, true),
  MenuOption(5, "HI temp alarm", "thighalarm", "bool", 0, 0, true, true),
  MenuOption(6, "HI Temp degC", "thightemp", "float", 60, 5, true, true),
  MenuOption(7, "LO temp alarm", "tlowalarm", "bool", 0, 0, true, true),
  MenuOption(8, "HI Temp degC", "tlowtemp", "float", 60, 5, true, true),
  //lamp
  MenuOption(9, "Lamp enable", "lenable", "bool", 0, 0, true, true),
  MenuOption(10, "Lamp is heater", "lheater", "bool", 0, 0, true, true),
  MenuOption(11, "Heater temp degC", "ltemp", "float", 60, 5, true, true),
  MenuOption(12, "Lamp on hour", "lstarthour", "int", 23, 0, true, true),
  MenuOption(13, "Lamp off hour", "lendhour", "int", 23, 0, true, true),
  MenuOption(14, "Lamp invert", "linvert", "bool", 0, 0, true, true),
  //pump
  MenuOption(15, "Pump enable", "penable", "bool", 0, 0, true, true),
  MenuOption(16, "Pump flow mode", "pflow", "bool", 0, 0, true, true),
  MenuOption(17, "Pump flow Ml", "pflowml", "int", 5000, 0, true, true),
  MenuOption(18, "Pump alarm", "pflowalarm", "bool", 0, 0, true, true),
  MenuOption(19, "Pump duration sec", "pduration", "int", 240, 5, true, true),
  MenuOption(20, "Pump freq. min", "pfrequency", "int", 240, 2, true, true),
  MenuOption(21, "Pump invert", "pinvert", "bool", 0, 0, true, true),
  //float 1
  MenuOption(22, "Float1 enable", "flt1enable", "bool", 0, 0, true, true),
  MenuOption(23, "Float1 alarm", "flt1alarm", "bool", 0, 0, true, true),
  MenuOption(24, "Float1 pump off", "flt1shutoff", "bool", 0, 0, true, true),
  MenuOption(25, "Float1 invert", "flt1invert", "bool", 0, 0, true, true),
  //float 2
  MenuOption(26, "Float2 enable", "flt2enable", "bool", 0, 0, true, true),
  MenuOption(27, "Float2 alarm", "flt2alarm", "bool", 0, 0, true, true),
  MenuOption(28, "Float2 pump off", "flt2shutoff", "bool", 0, 0, true, true),
  MenuOption(29, "Float2 invert", "flt2invert", "bool", 0, 0, true, true),
  //flow
  MenuOption(30, "Flow enable", "flwenable", "bool", 0, 0, true, true),
  MenuOption(31, "Flow pulses per Ml", "flowpulsesml", "float", 1000, 0, true, true),
  //system
  MenuOption(32, "Select display type", "displaytype", "int", 1, 0, true, true),
  MenuOption(33, "Enable WiFi", "enablewifi", "bool", 0, 0, true, true),
  MenuOption(34, "Reset Settings", "reset", "bool", 0, 0, true, false),
  MenuOption(35, "WiFi Setup", "wifiSetup", "bool", 0, 0, true, false),
  MenuOption(36, "Pair Device", "pairDevice", "bool", 0, 0, true, false),
  MenuOption(37, "Sync Clock", "syncClock", "bool", 0, 0, true, false),
  MenuOption(38, "Fetch Config", "fetchConfig", "bool", 0, 0, true, false)
};

#define configUploadFrequencyMins menuOptions[0]
#define configTempEnable menuOptions[1]
#define configTempLampShutoff menuOptions[2]
#define configTempLampShutoffTemp menuOptions[3]
#define configTempHighTempAlarm menuOptions[4]
#define configTempHighTemp menuOptions[5]
#define configTempLowTempAlarm menuOptions[6]
#define configTempLowTemp menuOptions[7]
#define configLampEnable menuOptions[8]
#define configLampHeaterMode menuOptions[9]
#define configLampHeaterTemp menuOptions[10]
#define configLampStartHour menuOptions[11]
#define configLampEndHour menuOptions[12]
#define configLampInvertLogic menuOptions[13]
#define configPumpEnable menuOptions[14]
#define configPumpFlowMode menuOptions[15]
#define configPumpFlowMl menuOptions[16]
#define configPumpFlowAlarm menuOptions[17]
#define configPumpDurationSec menuOptions[18]
#define configPumpFrequencyMin menuOptions[19]
#define configPumpInvertLogic menuOptions[20]
#define configFloat1Enable menuOptions[21]
#define configFloat1Alarm menuOptions[22]
#define configFloat1PumpShutoff menuOptions[23]
#define configFloat1InvertLogic menuOptions[24]
#define configFloat2Enable menuOptions[25]
#define configFloat2Alarm menuOptions[26]
#define configFloat2PumpShutoff menuOptions[27]
#define configFloat2InvertLogic menuOptions[28]
#define configFlowEnable menuOptions[29]
#define configFlowPulsesPerMl menuOptions[30]
#define configDisplayType menuOptions[31]
#define configEnableWifi menuOptions[32]
#define configResetSettings menuOptions[33]

// return title
String getMenuOptionTitle(int menuPos) {
  for (int i = 0; i < NUM_MENU_OPTIONS; i ++) {
    if (menuOptions[i].pos() == menuPos) {
      return menuOptions[i].title();
    }
  }
  return "Menu Error";
}

// increment or decrement a menu option
void incrementMenuOption(int menuPos, bool increment) {
  for (int i = 0; i < NUM_MENU_OPTIONS; i ++) {
    if (menuOptions[i].pos() == menuPos) {
      if (menuPos == 34) { // reset all settings
        Serial.println("Erasing flash and rebooting..."); preferences.clear(); ESP.restart(); // delete everything in the flash and reboot the ESP to recreate the structure
      } else if (menuPos >= 35) {
        return;
      } else {
        menuOptions[i].adjustVal(increment);
      }
    }
  }
}

// returns value as a String (for use on the display)
const String stringEnabled = "Enabled";
const String stringDisabled = "Disabled"; // used this instead of a #define because I'm pretty sure this takes up less space in the sketch
String getMenuOptionValue(int menuPos) {
  for (int i = 0; i < NUM_MENU_OPTIONS; i ++) {
    if (menuOptions[i].pos() == menuPos) {
      if (menuPos == 34) { // reset all settings
        return "";
      } else if (menuPos == 35) {
        return wifiSSID.length() > 0 ? wifiSSID : "Not set";
      } else if (menuPos == 36) {
        return deviceID.length() > 0 ? "Paired" : "Not paired";
      } else if (menuPos == 37) {
        return "Press OK";
      } else if (menuPos == 38) {
        return "Press OK";
      } else {
        String type = menuOptions[i].getType();
        if (type == "bool") {
          return menuOptions[i].boolVal() ? stringEnabled : stringDisabled;
        } else if (type == "int") {
          return String(menuOptions[i].intVal());
        } else if (type == "float" ) {
          return String(menuOptions[i].floatVal());
        }
      }
    }
  }
  return "Menu Error";
}

// read settings from flash memory using 'preferences' library
void flashRead() {
  Serial.println("Reading flash...");
  for (int i = 0; i < NUM_MENU_OPTIONS; i ++) {
    if (menuOptions[i].saveInFlash()) {
      String type = menuOptions[i].getType();
      String systemName = menuOptions[i].getSysName();
      if (type == "bool") {
        menuOptions[i].setBoolVal(preferences.getBool(systemName.c_str(), menuOptions[i].defaultVal() >= 1));
      } else if (type == "int") {
        menuOptions[i].setIntVal(preferences.getUInt(systemName.c_str(), int(menuOptions[i].defaultVal())));
      } else if (type == "float" ) {
        menuOptions[i].setFloatVal(preferences.getFloat(systemName.c_str(), menuOptions[i].defaultVal()));
      }
    }
  }
  Serial.println("Loaded settings from flash!");
}

// write settings to flash memory
void flashWrite() {
  Serial.println("Writing flash...");
  for (int i = 0; i < NUM_MENU_OPTIONS; i ++) {
    if (menuOptions[i].saveInFlash()) {
      String type = menuOptions[i].getType();
      String systemName = menuOptions[i].getSysName();
      if (type == "bool") {
        preferences.putBool(systemName.c_str(), menuOptions[i].boolVal());
      } else if (type == "int") {
        preferences.putUInt(systemName.c_str(), menuOptions[i].intVal());
      } else if (type == "float" ) {
        preferences.putFloat(systemName.c_str(), menuOptions[i].floatVal());
      }
    }
  }
  Serial.println("Wrote settings to flash!");
}

void onButtonPress(String btnType, bool longPress);
class Button {
  public:
    void Init(int pin, const char* type);
    void checkState(unsigned int long curMs);
  private:
    int _pin;
    const char* _btnType;
    unsigned int long _startTime;
    bool _lastState;
};

void Button::Init(int pin, const char* type) {
  _pin = pin;
  _btnType = type;
  _startTime = 0;
  _lastState = false;
  pinMode(pin, INPUT_PULLUP);
}

void Button::checkState(unsigned int long curMs) {
  if (digitalRead(_pin) == LOW && !_lastState) {
    _startTime = curMs;
    _lastState = true;
  }
  //button released
  if (digitalRead(_pin) == HIGH && _lastState) {
    if (curMs - _startTime > buttonShortTime) {
      if (curMs - _startTime > buttonLongTime) {
        buzzer.tone(NOTE_C5, 10, 0, 1);
        onButtonPress(_btnType, true);
      } else {
        buzzer.tone(NOTE_C5, 10, 0, 1);
        onButtonPress(_btnType, false);
      }
    }
    _lastState = false;
  }
}

Button buttonOK;
Button buttonBK;
Button buttonUP;
Button buttonDN;

extern uint32_t localConfigVersion;

void webConfigRead() {
  wifiSSID = preferences.getString("wifiSSID", "");
  wifiPassphrase = preferences.getString("wifiPass", "");
  deviceID = preferences.getString("deviceId", "");
  accountID = preferences.getString("accountId", "");
  deviceToken = preferences.getString("deviceToken", "");
  localConfigVersion = preferences.getUInt("localCfgV", 0);
}
void webConfigWrite() {
  preferences.putString("wifiSSID", wifiSSID);
  preferences.putString("wifiPass", wifiPassphrase);
  preferences.putString("deviceId", deviceID);
  preferences.putString("accountId", accountID);
  preferences.putString("deviceToken", deviceToken);
  preferences.putUInt("localCfgV", localConfigVersion);
}

enum UiMode {
  UI_MENU,
  UI_WIFI_SCAN,
  UI_WIFI_PASS,
  UI_PAIRING_WAIT
};

extern bool wifiConnected;
extern bool calledWifiBegin;
extern bool configDownloaded;

UiMode uiMode = UI_MENU;
String wifiScanSsid[16];
int wifiScanCount = 0;
int wifiScanSelection = 0;
String wifiPassBuffer = "";
int wifiCharSelection = 0;
const String wifiCharSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()-_=+";
String pairingCode = "";
unsigned long pairingStartedAt = 0;
unsigned long pairingLastPoll = 0;
const unsigned long pairingTimeoutMs = 5UL * 60UL * 1000UL;
bool remoteConfigDirty = false;
unsigned long lastRemoteConfigFetch = 0;
uint32_t localConfigVersion = 0;
bool suppressLocalConfigDirty = false;
bool bootConfigReported = false;

String endpointUrl(const String &path) {
  String base = webEndpoint;
  if (base.endsWith("/")) {
    base.remove(base.length() - 1);
  }
  return base + path;
}

bool httpPostJson(const String &url, const String &body, String &responseBody, int &httpCode) {
  HTTPClient http;
  if (!http.begin(url)) {
    responseBody = "Connection Error";
    httpCode = -1;
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  if (deviceToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + deviceToken);
  }
  httpCode = http.POST(body);
  if (httpCode > 0) {
    responseBody = http.getString();
  } else {
    responseBody = http.errorToString(httpCode).c_str();
  }
  http.end();
  return httpCode > 0;
}

bool httpGet(const String &url, String &responseBody, int &httpCode) {
  HTTPClient http;
  if (!http.begin(url)) {
    responseBody = "Connection Error";
    httpCode = -1;
    return false;
  }
  if (deviceToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + deviceToken);
  }
  httpCode = http.GET();
  if (httpCode > 0) {
    responseBody = http.getString();
  } else {
    responseBody = http.errorToString(httpCode).c_str();
  }
  http.end();
  return httpCode > 0;
}

void markSyncSuccess() {
  configDownloaded = true;
}

void markSyncFailure() {
  configDownloaded = false;
}

unsigned long lastPendingConfigSyncAttempt = 0;

unsigned long getConfiguredSyncIntervalMs() {
  return (unsigned long)configUploadFrequencyMins.intVal() * 60UL * 1000UL;
}

unsigned long getTelemetryIntervalMs() {
  return getConfiguredSyncIntervalMs();
}

unsigned long getPendingConfigRetryIntervalMs() {
  return 60UL * 1000UL;
}

void markLocalConfigDirty() {
  remoteConfigDirty = true;
}

void startWifiScan() {
  display.clearDisplay();
  display.setCursor(2, 12);
  display.print("Scanning WiFi...");
  display.display();
  wifiScanCount = WiFi.scanNetworks();
  if (wifiScanCount < 0) {
    wifiScanCount = 0;
  }
  if (wifiScanCount > 16) {
    wifiScanCount = 16;
  }
  for (int i = 0; i < wifiScanCount; i++) {
    wifiScanSsid[i] = WiFi.SSID(i);
  }
  wifiScanSelection = 0;
  uiMode = UI_WIFI_SCAN;
}

void beginWifiPassphraseEntry() {
  wifiPassBuffer = "";
  wifiCharSelection = 0;
  uiMode = UI_WIFI_PASS;
}

void finishWifiSetup() {
  wifiPassphrase = wifiPassBuffer;
  webConfigWrite();
  WiFi.disconnect(true);
  delay(200);
  calledWifiBegin = false;
  wifiConnected = false;
  if (wifiSSID.length() > 0) {
    WiFi.begin(wifiSSID.c_str(), wifiPassphrase.c_str());
    calledWifiBegin = true;
  }
  uiMode = UI_MENU;
}

void startPairing() {
  DynamicJsonDocument req(256);
  req["chipId"] = String((uint32_t)ESP.getEfuseMac(), HEX);
  req["deviceHint"] = "hydrotek-esp32";
  String payload;
  serializeJson(req, payload);
  String response;
  int httpCode = 0;
  if (!httpPostJson(endpointUrl("/pairing/request"), payload, response, httpCode) || httpCode >= 300) {
    pairingCode = "ERR";
    uiMode = UI_PAIRING_WAIT;
    pairingStartedAt = millis();
    pairingLastPoll = millis();
    return;
  }
  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    pairingCode = "ERR";
  } else {
    pairingCode = doc["pairingCode"] | "";
  }
  pairingStartedAt = millis();
  pairingLastPoll = 0;
  uiMode = UI_PAIRING_WAIT;
}

void pollPairingStatus() {
  if (uiMode != UI_PAIRING_WAIT) { return; }
  if (pairingCode == "ERR") { return; }
  if (millis() - pairingStartedAt > pairingTimeoutMs) {
    uiMode = UI_MENU;
    pairingCode = "";
    return;
  }
  if (millis() - pairingLastPoll < 3000) {
    return;
  }
  pairingLastPoll = millis();
  String response;
  int httpCode = 0;
  if (!httpGet(endpointUrl("/pairing/status?code=" + pairingCode), response, httpCode) || httpCode >= 300) {
    return;
  }
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    return;
  }
  bool paired = doc["paired"] | false;
  if (paired) {
    deviceID = doc["deviceId"] | "";
    accountID = doc["accountId"] | "";
    deviceToken = doc["deviceToken"] | "";
    webConfigWrite();
    pairingCode = "";
    uiMode = UI_MENU;
  }
}

void syncRtcFromServer() {
  String response;
  int httpCode = 0;
  if (!httpGet(endpointUrl("/time"), response, httpCode) || httpCode >= 300) {
    markSyncFailure();
    return;
  }
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    markSyncFailure();
    return;
  }
  uint32_t epoch = doc["epoch"] | 0;
  if (epoch > 0) {
    RTC.adjust(DateTime(epoch));
  }
  markSyncSuccess();
}

void serializeCurrentConfig(JsonObject settings) {
  for (int i = 0; i < NUM_MENU_OPTIONS; i++) {
    if (!menuOptions[i].saveInFlash()) {
      continue;
    }
    String key = menuOptions[i].getSysName();
    String type = menuOptions[i].getType();
    if (type == "bool") {
      settings[key] = menuOptions[i].boolVal();
    } else if (type == "int") {
      settings[key] = menuOptions[i].intVal();
    } else if (type == "float") {
      settings[key] = menuOptions[i].floatVal();
    }
  }
}

bool notifyConfigUpdated(const String& state, bool includeSettings) {
  if (!wifiConnected || deviceID.length() == 0) {
    return false;
  }
  DynamicJsonDocument req(4096);
  req["deviceId"] = deviceID;
  req["localConfigVersion"] = localConfigVersion;
  req["configSyncState"] = state;
  if (includeSettings) {
    JsonObject settings = req.createNestedObject("settings");
    serializeCurrentConfig(settings);
  }
  String payload;
  serializeJson(req, payload);
  String response;
  int httpCode = 0;
  if (!httpPostJson(endpointUrl("/config/changed"), payload, response, httpCode) || httpCode >= 300) {
    markSyncFailure();
    return false;
  }
  markSyncSuccess();
  return true;
}

void pullRemoteConfig(bool force = false) {
  if (!wifiConnected || deviceID.length() == 0) {
    return;
  }
  if (!force && lastRemoteConfigFetch > 0 && millis() - lastRemoteConfigFetch < getPendingConfigRetryIntervalMs()) {
    return;
  }
  lastRemoteConfigFetch = millis();
  String response;
  int httpCode = 0;
  if (!httpGet(endpointUrl("/config?deviceId=" + deviceID), response, httpCode) || httpCode >= 300) {
    markSyncFailure();
    return;
  }
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    markSyncFailure();
    return;
  }
  markSyncSuccess();
  String serverSyncState = doc["configSyncState"] | "success";
  uint32_t serverVersion = doc["configVersion"] | 0;
  if (serverSyncState != "pending" && serverVersion <= localConfigVersion) {
    return;
  }
  JsonObject settings = doc["settings"].as<JsonObject>();
  suppressLocalConfigDirty = true;
  for (int i = 0; i < NUM_MENU_OPTIONS; i++) {
    if (!menuOptions[i].saveInFlash()) {
      continue;
    }
    String key = menuOptions[i].getSysName();
    if (!settings.containsKey(key)) {
      continue;
    }
    String type = menuOptions[i].getType();
    if (type == "bool") {
      menuOptions[i].setBoolVal(settings[key].as<bool>());
    } else if (type == "int") {
      menuOptions[i].setIntVal(settings[key].as<int>());
    } else if (type == "float") {
      menuOptions[i].setFloatVal(settings[key].as<float>());
    }
  }
  flashWrite();
  suppressLocalConfigDirty = false;
  localConfigVersion = serverVersion;
  webConfigWrite();
  notifyConfigUpdated("success", false);
}

//update config from online
String webError = "";
bool configDownloaded = false;
void handleReceiveConfig(String webResponse) {

  const size_t capacity = JSON_OBJECT_SIZE(51) + 1210;
  DynamicJsonDocument doc(capacity);

  deserializeJson(doc, webResponse);

  //check if parsing the JSON failed
  JsonObject object = doc.as<JsonObject>();
  if (object.isNull()) {
    webError = "Error: ";
    webError += webResponse;
    Serial.println(webError);
    markSyncFailure();
    return;
  }

  if (doc.containsKey("configUploadFrequencyMins")) {
    configUploadFrequencyMins.setIntVal(doc["configUploadFrequencyMins"]);
  }

  Serial.println("Updated config:");
  Serial.println(webResponse);

  markSyncSuccess();
  webError = "";

  flashWrite();
}

#define firstCoordinate 0
#define charHeight 8
#define titleBarHeight 11
#define lineX 2
int lineY(int line) { 
  if (line == 1) { return firstCoordinate + titleBarHeight + 1; }
  if (line == 2) { return lineY(1) + charHeight; }
  if (line > 2) { return lineY(line - 1) + charHeight; }
}

//draws the border and title etc
bool wifiConnected = false;
bool inMenu = false;
String menuTitle = "";
void drawInitial() {
  if (!displayAvailable) { return; }
  display.clearDisplay();
  display.drawRoundRect(0,0,display.width(),display.height(), 2, WHITE); //x, y, x, y, radius, color
  display.fillRoundRect(0,0,display.width(),10, 2, WHITE); //x, y, x, y, radius, color
  display.setTextColor(BLACK); // Draw black text (background transparent by default)
  display.setCursor(27, 2); //title line
  String title = inMenu ? menuTitle : "HydroTek";
  display.print(title);
  display.setCursor(3, 2); //title line
  if (wifiConnected) { display.print("+"); } else { display.print("-"); }
  if (configDownloaded) { display.print("+"); } else { display.print("-"); }
  display.setTextColor(WHITE, BLACK); // Draw white text with a black background 
}

float temp;
float humidity;
void tempCheckState() {
  if (configTempEnable.boolVal()) {
    temp = dht.readTemperature(); //read temperature as Celsius (the default)
    humidity = dht.readHumidity(); //read humidity
    if (isnan(temp)) { temp = 0.0; }
    if (isnan(humidity)) { humidity = 0.0; }
  }
}

//turn lamp relay(s) on / off
bool lampLastState = false;
void lampSetState (String stateStr) {
  bool state = stateStr == "ON";
  bool invertLogic = configLampInvertLogic.boolVal();
  //Serial.println("Lamp invert: " + String(invertLogic));
  bool tempOverride = false;
  if (!configLampHeaterMode.boolVal() && configTempEnable.boolVal() && configTempLampShutoff.boolVal() && temp > configTempLampShutoffTemp.floatVal()) {
    tempOverride = true;
  }
  if (!invertLogic) {
    if (state && !tempOverride) {
      digitalWrite(lampPin, LOW);
      lampLastState = true;
    } else {
      digitalWrite(lampPin, HIGH);
      lampLastState = false;
    }
  } else {
    if (state && !tempOverride) {
      digitalWrite(lampPin, HIGH);
      lampLastState = true;
    } else {
      digitalWrite(lampPin, LOW);
      lampLastState = false;
    }
  }
}

void lampCheckState (int currentHour) {
  if (configLampEnable.boolVal()) {
    if (configLampHeaterMode.boolVal()) {
      if (configTempEnable.boolVal()) {
        if (temp > configLampHeaterTemp.floatVal() + lampHeaterTempVariance) {
          lampSetState("OFF");
        } else if (temp < configLampHeaterTemp.floatVal() - lampHeaterTempVariance) {
          lampSetState("ON");
        }
      }
    } else {
      if (configLampEndHour.intVal() > configLampStartHour.intVal()) {
        if (currentHour < configLampEndHour.intVal() && currentHour >= configLampStartHour.intVal()) {
          lampSetState("ON");
        } else {
          lampSetState("OFF");
        }
      }
      else if (configLampEndHour.intVal() < configLampStartHour.intVal()) {
        if (currentHour >= configLampStartHour.intVal() || currentHour < configLampEndHour.intVal()) {
          lampSetState("ON");
        } else {
          lampSetState("OFF");
        }
      }
    }
  } else {
    lampSetState("OFF");
  }
}

//float sensor variables
bool float1triggered = false;
bool float2triggered = false;

//sounds alarm if conditions are met
bool pumpMissedFlowTarget = false;
String alarmReason = "";
String syncStatusReason = "";
bool alarmTempHighTriggered = false;
bool alarmTempLowTriggered = false;
bool alarmFloat1Triggered = false;
bool alarmFloat2Triggered = false;
bool alarmPumpLowFlowTriggered = false;
bool alarmWifiDisconnectedTriggered = false;
bool alarmActive = false;
void alarmCheckState(){
  bool shouldSoundAlarm = false;
  alarmReason = "";
  syncStatusReason = "";
  alarmTempHighTriggered = false;
  alarmTempLowTriggered = false;
  alarmFloat1Triggered = false;
  alarmFloat2Triggered = false;
  alarmPumpLowFlowTriggered = false;
  alarmWifiDisconnectedTriggered = false;
  if (!wifiConnected && configEnableWifi.boolVal()) {
    syncStatusReason = "No WiFi";
  } else if (configEnableWifi.boolVal()) {
    if (configDownloaded) {
      syncStatusReason = "Sync OK";
    } else {
      #ifdef offlineMode
        syncStatusReason = "Offline";
      #else
        syncStatusReason = "Sync Err";
      #endif
    }
  }
  if (configTempEnable.boolVal() && configTempHighTempAlarm.boolVal() && temp > configTempHighTemp.floatVal()) {
    shouldSoundAlarm = true;
    alarmReason = "Temp HIGH";
    alarmTempHighTriggered = true;
  }
  if (configTempEnable.boolVal() && configTempLowTempAlarm.boolVal() && temp < configTempLowTemp.floatVal()) {
    shouldSoundAlarm = true;
    alarmReason = "Temp LOW";
    alarmTempLowTriggered = true;
  }
  if (configFloat1Enable.boolVal() && float1triggered) {
    if (configFloat1Alarm.boolVal()) {
      shouldSoundAlarm = true;
      alarmFloat1Triggered = true;
    }    
    alarmReason = "Tank 1 FULL/EMPTY";
  }
  if (configFloat2Enable.boolVal() && float2triggered) {
    if (configFloat2Alarm.boolVal()) {
      shouldSoundAlarm = true; 
      alarmFloat2Triggered = true;
    }
    alarmReason = "Tank 2 FULL/EMPTY";
  }
  if (pumpMissedFlowTarget) {
    shouldSoundAlarm = true;
    alarmReason = "Pump LOW FLOW";
    alarmPumpLowFlowTriggered = true;
  }
  alarmActive = shouldSoundAlarm;
  if (shouldSoundAlarm) {
    buzzer.tone(NOTE_A4, 50, 0, 1);
  }
}

bool pumpLastState = false;
void pumpSetState(String state) {
  if (!configPumpInvertLogic.boolVal() && state == "ON") {
    digitalWrite(pumpPin, LOW);
    pumpLastState = true;
  } else if (!configPumpInvertLogic.boolVal() && state == "OFF") {
    digitalWrite(pumpPin, HIGH);
    pumpLastState = false;
  } else if (configPumpInvertLogic.boolVal() && state == "ON") {
    digitalWrite(pumpPin, HIGH);
    pumpLastState = true;
  } else if (configPumpInvertLogic.boolVal() && state == "OFF") {
    digitalWrite(pumpPin, LOW);
    pumpLastState = false;
  }
}

unsigned int pumpMeasuredFlowMl = 0;
int pumpMissedTargetByMl = 0;
void pumpCheckState(int currentSecond) {
  if (inMenu) { return; }
  pumpMissedFlowTarget = false;
  if (configPumpEnable.boolVal()) {
    bool pumpShouldRun = false;
    for (int i = 0; i <= 86400; i = i + configPumpFrequencyMin.intVal() * 60) {
      if (currentSecond >= i && currentSecond <= i + configPumpDurationSec.intVal()) {
        if (configPumpFlowMode.boolVal()) {
          if (pumpMeasuredFlowMl < configPumpFlowMl.intVal()) {
            pumpShouldRun = true;
          }
          //if it's within the last second of run time and the flow hasn't met the target by more than 5ml, consider the flow target not met
          if (currentSecond > i + configPumpDurationSec.intVal() - 2 && configPumpFlowMl.intVal() - pumpMeasuredFlowMl > 5) {
            pumpMissedFlowTarget = true;
            pumpMissedTargetByMl = configPumpFlowMl.intVal() - pumpMeasuredFlowMl;
          }
        } else {
          pumpShouldRun = true;
        }
      }
    }
    if (pumpShouldRun) {
      pumpSetState("ON");
    } else {
      pumpSetState("OFF");
      pumpMeasuredFlowMl = 0;
    }
  }
}

unsigned long flowPulseCount = 0;
unsigned int flowMlSinceLastUpload = 0;
void flowCheckState(){
  flowPulseCount = takePendingFlowPulses();
  if (!configFlowEnable.boolVal()) {
    flowPulseCount = 0;
    return;
  }
  if (calibratingFlowSensor) {
    flowSensorCalibrationPulses = flowSensorCalibrationPulses + flowPulseCount;
    flowPulseCount = 0;
    return;
  }
  float pulsesPerMl = configFlowPulsesPerMl.floatVal();
  if (pulsesPerMl <= 0.0) {
    flowPulseCount = 0;
    return;
  }
  int flowInMl = flowPulseCount / pulsesPerMl;
  pumpMeasuredFlowMl = pumpMeasuredFlowMl + flowInMl;
  flowMlSinceLastUpload = flowMlSinceLastUpload + flowInMl;
  flowPulseCount = 0;
  //(pulsesOver1000ms * 60 / 7.5); //the LPH calculation for flow sensors
}
    
bool screenIsSleeping = false;
int unsigned long screenSleepLastAction = 0;
int menuSelection = 1;
bool editingAnOption = false;
int unsigned long buttonDebounceTimer = 0;
bool calibratingFlowSensor = false;
int long unsigned flowSensorCalibrationPulses = 0;
void onButtonPress(String btnType, bool longPress) { //OK BK UP DN

  #ifdef buttonDisable
  return;
  #endif
  
  if (millis() - buttonDebounceTimer < buttonDebounceTime) {
    return;
  } else {
    buttonDebounceTimer = millis();
  }
  
  Serial.println("Button pressed: " + btnType + " " + (longPress ? "long" : "short"));

  screenSleepLastAction = millis();

  //wake the screen up and do nothing else
  if (screenIsSleeping) {
    screenIsSleeping = false;
    return;
  }

  if (uiMode == UI_WIFI_SCAN) {
    if (wifiScanCount <= 0) {
      if (btnType == "BK" || btnType == "OK") {
        uiMode = UI_MENU;
      }
      return;
    }
    if (btnType == "UP") {
      wifiScanSelection--;
      if (wifiScanSelection < 0) { wifiScanSelection = wifiScanCount - 1; }
    } else if (btnType == "DN") {
      wifiScanSelection++;
      if (wifiScanSelection >= wifiScanCount) { wifiScanSelection = 0; }
    } else if (btnType == "OK") {
      if (wifiScanCount > 0) {
        wifiSSID = wifiScanSsid[wifiScanSelection];
        beginWifiPassphraseEntry();
      }
    } else if (btnType == "BK") {
      uiMode = UI_MENU;
    }
    return;
  }

  if (uiMode == UI_WIFI_PASS) {
    if (btnType == "UP") {
      wifiCharSelection++;
      if (wifiCharSelection >= wifiCharSet.length()) { wifiCharSelection = 0; }
    } else if (btnType == "DN") {
      wifiCharSelection--;
      if (wifiCharSelection < 0) { wifiCharSelection = wifiCharSet.length() - 1; }
    } else if (btnType == "OK" && !longPress) {
      if (wifiPassBuffer.length() < 63) {
        wifiPassBuffer += wifiCharSet[wifiCharSelection];
      }
    } else if (btnType == "BK" && !longPress) {
      if (wifiPassBuffer.length() > 0) {
        wifiPassBuffer.remove(wifiPassBuffer.length() - 1);
      }
    } else if (btnType == "OK" && longPress) {
      finishWifiSetup();
    } else if (btnType == "BK" && longPress) {
      uiMode = UI_MENU;
    }
    return;
  }

  if (uiMode == UI_PAIRING_WAIT) {
    if (btnType == "BK") {
      uiMode = UI_MENU;
      pairingCode = "";
    }
    return;
  }
  
  if (!inMenu && btnType == "OK") {
    inMenu = true;
    menuTitle = "Menu";
  }
  else if (inMenu) {

    if (btnType == "OK") {
      if (editingAnOption){
        if (menuSelection == 35) {
          startWifiScan();
          editingAnOption = false;
          return;
        }
        if (menuSelection == 36) {
          startPairing();
          editingAnOption = false;
          return;
        }
        if (menuSelection == 37) {
          syncRtcFromServer();
          editingAnOption = false;
          return;
        }
        if (menuSelection == 38) {
          pullRemoteConfig(true);
          editingAnOption = false;
          return;
        }
        if (menuSelection == 31) {
          if (calibratingFlowSensor) {
            finishFlowCalibration();
          } else {
            startFlowCalibration();
          }
        } else {
          editingAnOption = !editingAnOption;
        }
      } else {
        editingAnOption = !editingAnOption;
      }      
    }
    
    if (btnType == "BK") {
      if (!editingAnOption) {
        inMenu = false;
        menuTitle = "";
        drawInitial();
      } else {
        if (menuSelection == 31) {
          if (calibratingFlowSensor) {
            finishFlowCalibration();
          } else {
            editingAnOption = false;
          }
        } else {
          editingAnOption = false;
        }
      }
    }

    if (btnType == "UP") {
      if (!editingAnOption){
        if (menuSelection == 1) {
          menuSelection = NUM_MENU_OPTIONS;
        } else {
          menuSelection--;
        }
      } else {
        incrementMenuOption(menuSelection, true);
        flashWrite();
        if (!suppressLocalConfigDirty) {
          localConfigVersion++;
          webConfigWrite();
          markLocalConfigDirty();
        }
      }
    }

    if (btnType == "DN") {
      if (!editingAnOption) {
        if (menuSelection == NUM_MENU_OPTIONS) {
          menuSelection = 1;
        } else {
          menuSelection++;
        }
      } else {
        incrementMenuOption(menuSelection, false);
        flashWrite();
        if (!suppressLocalConfigDirty) {
          localConfigVersion++;
          webConfigWrite();
          markLocalConfigDirty();
        }
      }
    }
    
  }
}

//set line position and font
void drawMenuSet(int menuPos, int offset) {
  if (menuPos > NUM_MENU_OPTIONS) { return; }
  int displayLine = menuPos - offset; //offset corrects the number representing overall menu position for display on a display with room for only 6 lines
  display.setCursor(lineX, lineY(displayLine));
  if (menuSelection == menuPos) {
    display.setTextColor(BLACK, WHITE);
  }
  else {
    display.setTextColor(WHITE, BLACK);
  }
  display.print(getMenuOptionTitle(menuPos));
}

void menuDraw() {
  if (!displayAvailable) { return; }
  if (!editingAnOption) {
    int iMin = 1;
    int iMax = 7;
    int offset = 0;
      
    for(int i = 1; i < NUM_MENU_OPTIONS + 1; i = i + 6) {
      int numPages = ceil(NUM_MENU_OPTIONS / 6.0);
      if (menuSelection >= i && menuSelection < i + 7) {
        menuTitle = "Menu - " + String(int(floor(i / 6) + 1)) + "/" + String(numPages);
        iMin = i;
        iMax = i + 6;
        offset = i - 1;
      }
    }
    
    drawInitial(); //the code is structured this way so the menuTitle could be set before the drawInitial, but not before actually writing the menu items to the display, as drawInitial writes a black background
    for (int i = iMin; i < iMax; i++) { drawMenuSet(i, offset); }
  }
  else if (editingAnOption) {
    menuTitle = "Menu - " + String(menuSelection) + "/" + String(NUM_MENU_OPTIONS);
    drawInitial();
    display.setCursor(lineX, lineY(1));
    display.print(getMenuOptionTitle(menuSelection));
    display.setCursor(lineX + 15, lineY(3));
    display.setTextSize(2);
    if (calibratingFlowSensor && menuSelection == 31) {
      display.setTextSize(1);
      display.setCursor(lineX, lineY(2));
      display.print("Pulses counted");
      display.setCursor(lineX + 15, lineY(3));
      display.setTextSize(2);
      display.print(flowSensorCalibrationPulses);
      display.setTextSize(1);
      display.setCursor(lineX, lineY(5));
      display.print("Pump 5L then hit OK");
    } else {
      if (menuSelection == 32) { // selecting display type
        if (getMenuOptionValue(menuSelection) == "0") { //getMenuOptionValue returns a String for display friendliness
          display.print("All Stats");
        } else if (getMenuOptionValue(menuSelection) == "1") {
          display.print("Temp Only");
        }
      } else if (menuSelection == 34) {
        display.setCursor(lineX + 3, lineY(2));
        display.print("R U sure?");
        display.setTextSize(1);
        display.setCursor(lineX + 3, lineY(4));
        display.print("Press Up or Down to");
        display.setCursor(lineX + 3, lineY(5));
        display.print("confirm");
      } else if (menuSelection == 35) {
        display.setTextSize(1);
        display.setCursor(lineX, lineY(3));
        display.print("Press OK to scan");
      } else if (menuSelection == 36) {
        display.setTextSize(1);
        display.setCursor(lineX, lineY(3));
        display.print("Press OK to start");
      } else if (menuSelection == 37 || menuSelection == 38) {
        display.setTextSize(1);
        display.setCursor(lineX, lineY(3));
        display.print("Press OK");
      } else {
        display.print(getMenuOptionValue(menuSelection)); //print the current setting
        if (menuSelection == 31) { // if adjusting the flow sensor ticks / mL setting
          display.setTextSize(1);
          display.setCursor(lineX, lineY(2));
          display.print("Hit OK to calibrate");
        }
      }      
    }
    display.setTextSize(1);
  }
  display.display();
}

void drawWifiScanUi() {
  if (!displayAvailable) { return; }
  menuTitle = "WiFi Networks";
  drawInitial();
  if (wifiScanCount <= 0) {
    display.setCursor(lineX, lineY(2));
    display.print("No networks");
    display.setCursor(lineX, lineY(4));
    display.print("BK to exit");
    display.display();
    return;
  }
  int start = wifiScanSelection - 2;
  if (start < 0) { start = 0; }
  int end = start + 5;
  if (end > wifiScanCount) { end = wifiScanCount; }
  int line = 1;
  for (int i = start; i < end; i++) {
    display.setCursor(lineX, lineY(line));
    if (i == wifiScanSelection) {
      display.setTextColor(BLACK, WHITE);
    } else {
      display.setTextColor(WHITE, BLACK);
    }
    display.print(wifiScanSsid[i]);
    line++;
  }
  display.setTextColor(WHITE, BLACK);
  display.display();
}

void drawWifiPassUi() {
  if (!displayAvailable) { return; }
  menuTitle = "WiFi Password";
  drawInitial();
  display.setCursor(lineX, lineY(1));
  display.print(wifiSSID);
  display.setCursor(lineX, lineY(2));
  display.print("Pass: ");
  for (unsigned int i = 0; i < wifiPassBuffer.length(); i++) {
    display.print("*");
  }
  display.setCursor(lineX, lineY(4));
  display.setTextSize(2);
  display.print(wifiCharSet[wifiCharSelection]);
  display.setTextSize(1);
  display.setCursor(lineX, lineY(6));
  display.print("OK add / hold OK save");
  display.display();
}

void drawPairingUi() {
  if (!displayAvailable) { return; }
  menuTitle = "Pair Device";
  drawInitial();
  display.setCursor(lineX, lineY(1));
  if (pairingCode == "ERR") {
    display.print("Pair request failed");
    display.setCursor(lineX, lineY(3));
    display.print("BK to exit");
  } else {
    display.print("Code:");
    display.setCursor(lineX + 35, lineY(1));
    display.setTextSize(2);
    display.print(pairingCode);
    display.setTextSize(1);
    display.setCursor(lineX, lineY(4));
    display.print("Confirm in web app");
    display.setCursor(lineX, lineY(6));
    unsigned long remaining = (pairingTimeoutMs - (millis() - pairingStartedAt)) / 1000;
    display.print("Timeout ");
    display.print(remaining);
    display.print("s");
  }
  display.display();
}

//checkstate variables moved to above the alarm check function
void floatCheckState() {
  //get float switch statuses
  if (configFloat1Enable.boolVal()) {
    if (configFloat1InvertLogic.boolVal()) {
      float1triggered = digitalRead(floatSw1Pin);
    } else {
      float1triggered = !digitalRead(floatSw1Pin);
    }
  }
  if (configFloat2Enable.boolVal()) {
    if (configFloat2InvertLogic.boolVal()) {
      float2triggered = digitalRead(floatSw2Pin);
    } else {
      float2triggered = !digitalRead(floatSw2Pin);
    }
  }
}

int unsigned long lastTestCircle = 0;
void testdrawcircle(void) {
  if (!displayAvailable) { return; }
  if (millis() - lastTestCircle > 1000) {
    display.clearDisplay();
    int x = random(15, display.width() - 15);
    int y = random(15, display.height() - 15);
    int radius = random(display.height()/2-15);
    display.drawCircle(x, y, radius, WHITE);
    display.display();
    lastTestCircle = millis();
  }  
}

#define numPages 2
byte page = 1; //which page the loop is on
#define updateFrequency 250 //how often to update contents of display
#define pageFrequency 3000 //seconds to display each page before moving to the next
unsigned int long timeSinceLastPage = 0; //track when page was last changed
unsigned int long timeSinceLastUpdate = 0;
void displayUpdate(int curMillis) {
  if (!displayAvailable) { return; }
  DateTime now = RTC.now();

  if (screenIsSleeping) {
    //display.clearDisplay();
    testdrawcircle();
    //display.display();
    return;
  }

  if (uiMode == UI_WIFI_SCAN) {
    drawWifiScanUi();
    return;
  }
  if (uiMode == UI_WIFI_PASS) {
    drawWifiPassUi();
    return;
  }
  if (uiMode == UI_PAIRING_WAIT) {
    drawPairingUi();
    return;
  }
  
  if (inMenu) {
    //Serial.println("IN menu");
    menuDraw();
    return;
  }
  if (!timeSinceLastUpdate == 0 && curMillis - timeSinceLastUpdate < updateFrequency ) {
    return;
  } else {
    timeSinceLastUpdate = curMillis;
  }
  //update the display
  drawInitial();
  //display.setTextSize(2);
  display.setCursor(lineX, lineY(1));

  int displayMode = configDisplayType.intVal();

  if (displayMode == 0) {
    if (page == 1) {
      String line = "Temp: ";
      if (configTempEnable.boolVal()) {
        line += temp;
        line += (char)247;
        line += "C";
      } else { line += "disabled"; }
      display.print(line); 
      display.setCursor(lineX, lineY(2));
      line = "Hum.: ";
      if (configTempEnable.boolVal()) {
        line += humidity;
        line += "%";
      } else { line += "disabled"; }
      display.print(line); 
      display.setCursor(lineX, lineY(3));
      String curDate; curDate += now.day(); curDate += '/'; curDate += now.month(); curDate += '/'; curDate += now.year();
      String curTime; curTime += now.hour(); curTime += ':'; curTime += now.minute(); curTime += ':'; curTime += now.second();
      line = curDate + " - " + curTime;
      display.print(line);
      display.setCursor(lineX, lineY(4));
      line = "Flow: ";
      if (configFlowEnable.boolVal()) {
        line += flowMlSinceLastUpload;
        line += "mL";
      } else { line += "disabled"; }
      display.print(line);
    }
    else if (page == 2) {
      String line = "Float 1: ";
      if (configFloat1Enable.boolVal()) {
        line += float1triggered ? "X" : "-";
      } else { line += "disabled"; }
      display.print(line);
      display.setCursor(lineX, lineY(2));
      line = "Float 2: ";
      if (configFloat2Enable.boolVal()) {
        line += float2triggered ? "X" : "-";
      } else { line += "disabled"; }
      display.print(line);
      display.setCursor(lineX, lineY(3));
      line = "Lamp: ";
      if (configLampEnable.boolVal()) {
        line += lampLastState ? "ON" : "OFF";
      } else { line += "disabled"; }
      display.print(line);
      display.setCursor(lineX, lineY(4));
      line = "Pump: ";
      if (configPumpEnable.boolVal()) {
        line += pumpLastState ? "ON" : "OFF";
      } else { line += "disabled"; }
      display.print(line);
    }
  } else if (displayMode == 1) {
    display.setCursor(lineX + 30, lineY(1));
    display.setTextSize(2);
    display.print("Temp"); 
    display.setCursor(lineX + 15, lineY(3));
    String line = "";
    if (configTempEnable.boolVal()) {
      line += temp;
      line += (char)247;
      line += "C";
    } else { line += "disabled"; }
    display.print(line);
    display.setCursor(lineX + 3, lineY(6));
    line = "Lamp: ";
    if (configLampEnable.boolVal()) {
      line += lampLastState ? "ON" : "OFF";
    } else { line += "disabled"; }
    display.setTextSize(1);
    display.print(line);    
  }
  display.setCursor(lineX + 3, lineY(5));
  //Serial.println(alarmReason);
  if (alarmActive) {
    display.print(alarmReason);
  } else {
    display.print("-");
  }
  display.setCursor(80, 2);
  display.setTextColor(BLACK); 
  display.print(syncStatusReason);
  display.setTextColor(WHITE, BLACK); 
  display.display();

  if (!timeSinceLastPage == 0 && curMillis - timeSinceLastPage < pageFrequency ) {
    return;
  } else {
    timeSinceLastPage = curMillis;
  }
  
  page++;
  if (page > numPages) {
    page = 1;
  }
}

unsigned int long lastDataUpload = 0;
unsigned int long lastSuccessfulDataUpload = 0;
bool firstUpload = false;
unsigned long lastTelemetrySentAt = 0;
unsigned long pumpOnAccumMs = 0;
unsigned long pumpOnStartedAt = 0;

bool prevPumpState = false;
bool prevLampState = false;
bool prevFloat1State = false;
bool prevFloat2State = false;
bool prevAlarmActive = false;
bool prevFlowActive = false;
unsigned long lastPumpActiveUpload = 0;
#define PUMP_ACTIVE_UPLOAD_INTERVAL 5000UL

void syncPendingDeviceConfig(bool force = false) {
  if (!remoteConfigDirty || !wifiConnected || deviceID.length() == 0) {
    return;
  }
  if (!force && lastPendingConfigSyncAttempt > 0 && millis() - lastPendingConfigSyncAttempt < getPendingConfigRetryIntervalMs()) {
    return;
  }
  lastPendingConfigSyncAttempt = millis();
  if (notifyConfigUpdated("device", true)) {
    remoteConfigDirty = false;
    bootConfigReported = true;
  }
}

bool sendTelemetry(const String& reason, unsigned long curMillis) {
  if (!wifiConnected) {
    return false;
  }

  unsigned long intervalSec = 0;
  if (lastTelemetrySentAt > 0) {
    intervalSec = (curMillis - lastTelemetrySentAt) / 1000UL;
  }

  unsigned long pumpSec = pumpOnAccumMs / 1000UL;
  if (pumpLastState && pumpOnStartedAt > 0) {
    pumpSec += (curMillis - pumpOnStartedAt) / 1000UL;
  }

  DynamicJsonDocument payloadDoc(1536);
  payloadDoc["deviceId"] = deviceID;
  payloadDoc["accountId"] = accountID;
  payloadDoc["tempC"] = temp;
  payloadDoc["humidity"] = humidity;
  payloadDoc["float1"] = float1triggered;
  payloadDoc["float2"] = float2triggered;
  payloadDoc["flowMl"] = flowMlSinceLastUpload;
  payloadDoc["lampOn"] = lampLastState;
  payloadDoc["pumpOn"] = pumpLastState;
  payloadDoc["alarmActive"] = alarmActive;
  payloadDoc["alarmReason"] = alarmActive ? alarmReason : "";
  payloadDoc["syncStatus"] = syncStatusReason;
  payloadDoc["alarmTempHigh"] = alarmTempHighTriggered;
  payloadDoc["alarmTempLow"] = alarmTempLowTriggered;
  payloadDoc["alarmFloat1"] = alarmFloat1Triggered;
  payloadDoc["alarmFloat2"] = alarmFloat2Triggered;
  payloadDoc["alarmPumpLowFlow"] = alarmPumpLowFlowTriggered;
  payloadDoc["alarmWifiDisconnected"] = false;
  payloadDoc["reportReason"] = reason;
  payloadDoc["intervalSeconds"] = intervalSec;
  payloadDoc["pumpOnSeconds"] = pumpSec;
  String uploadBody;
  serializeJson(payloadDoc, uploadBody);

  Serial.print("Telemetry [");
  Serial.print(reason);
  Serial.print("] interval=");
  Serial.print(intervalSec);
  Serial.print("s pumpOn=");
  Serial.print(pumpSec);
  Serial.println("s");
  Serial.println(uploadBody);

  String webResponse = "";
  int httpCode = 0;
  bool requestOk = httpPostJson(endpointUrl("/telemetry"), uploadBody, webResponse, httpCode);
  if (!requestOk || httpCode >= 300) {
    markSyncFailure();
  }
  if (httpCode == 401 || httpCode == 403 || httpCode == 404) {
    // only show the pairing-failed UI if we thought we were paired
    if (deviceID.length() > 0) {
      alarmReason = "Device unpaired";
      uiMode = UI_PAIRING_WAIT;
      pairingCode = "ERR";
    }
    return false;
  }
  if (!requestOk || httpCode >= 300) {
    return false;
  }

  lastTelemetrySentAt = curMillis;
  lastSuccessfulDataUpload = curMillis;
  lastDataUpload = curMillis;
  flowMlSinceLastUpload = 0;
  pumpOnAccumMs = 0;
  if (pumpLastState && pumpOnStartedAt > 0) {
    pumpOnStartedAt = curMillis;
  }

  markSyncSuccess();
  handleReceiveConfig(webResponse);
  alarmReason = "";
  pullRemoteConfig();

  if (!firstUpload) {
    firstUpload = true;
  }
  return true;
}

String detectEventReason(unsigned long curMillis) {
  if (pumpLastState != prevPumpState) {
    return pumpLastState ? "pump_start" : "pump_stop";
  }
  if (lampLastState != prevLampState) {
    return "state_change";
  }
  if (float1triggered != prevFloat1State || float2triggered != prevFloat2State) {
    return "state_change";
  }
  if (alarmActive != prevAlarmActive) {
    return "alarm_change";
  }
  bool flowActive = flowMlSinceLastUpload > 0;
  if (flowActive != prevFlowActive) {
    return flowActive ? "flow_start" : "flow_stop";
  }
  if (pumpLastState && curMillis - lastPumpActiveUpload >= PUMP_ACTIVE_UPLOAD_INTERVAL) {
    return "pump_running";
  }
  return "";
}

void snapshotPrevStates() {
  prevPumpState = pumpLastState;
  prevLampState = lampLastState;
  prevFloat1State = float1triggered;
  prevFloat2State = float2triggered;
  prevAlarmActive = alarmActive;
  prevFlowActive = flowMlSinceLastUpload > 0;
}

void trackPumpOnTime(unsigned long curMillis) {
  if (pumpLastState && !prevPumpState) {
    pumpOnStartedAt = curMillis;
  } else if (!pumpLastState && prevPumpState && pumpOnStartedAt > 0) {
    pumpOnAccumMs += (curMillis - pumpOnStartedAt);
    pumpOnStartedAt = 0;
  }
}

void uploadData(unsigned long curMillis) {

  #ifdef offlineMode
    return;
  #endif

  if (!wifiConnected || deviceID.length() == 0) {
    return;
  }

  // seed the upload timer on first entry so we don't fire immediately
  if (lastDataUpload == 0) {
    lastDataUpload = curMillis;
    return;
  }

  trackPumpOnTime(curMillis);

  if (!firstUpload) {
    if (sendTelemetry("heartbeat", curMillis)) {
      snapshotPrevStates();
    }
    return;
  }

  String eventReason = detectEventReason(curMillis);
  if (eventReason.length() > 0) {
    if (sendTelemetry(eventReason, curMillis)) {
      if (eventReason == "pump_running") {
        lastPumpActiveUpload = curMillis;
      }
      snapshotPrevStates();
    }
    return;
  }

  bool heartbeatDue = (curMillis - lastDataUpload > getTelemetryIntervalMs());
  if (heartbeatDue) {
    if (sendTelemetry("heartbeat", curMillis)) {
      snapshotPrevStates();
    }
  }
}

void setup() {

  Serial.begin(115200); //pour a bowl of Serial
  delay(1200);
  Serial.println("HydroTek booting...");

  Serial.println("Setup step: buttons");
  Serial.println("Init button OK");
  buttonOK.Init(buttonPinOK, "OK");
  Serial.println("Init button BK");
  buttonBK.Init(buttonPinBK, "BK");
  Serial.println("Init button UP");
  buttonUP.Init(buttonPinUP, "UP");
  Serial.println("Init button DN");
  buttonDN.Init(buttonPinDN, "DN");
  Serial.println("Buttons done");
  Serial.println("Setup step: gpio");

  // Menu options are statically initialized in menuOptions[].

  pinMode(floatSw1Pin, INPUT_PULLUP);
  pinMode(floatSw2Pin, INPUT_PULLUP);
  pinMode(lampPin, OUTPUT);
  pinMode(pumpPin, OUTPUT);
  pinMode(flowPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(flowPin), onFlowPulse, RISING);
  Serial.println("Setup step: led");
  if (startupLedPwmEnabled) {
    bool ledAttached = ledcAttach(ledPin, 5000, 8);
    if (ledAttached) {
      ledcWrite(ledPin, ledBrightness);
    }
    Serial.println(ledAttached ? "LEDC attached" : "LEDC attach failed");
  } else {
    Serial.println("LEDC skipped");
  }
  
  Serial.println("Setup step: buzzer");
  buzzer.begin();
  if (startupBeepEnabled) {
    buzzer.tone(NOTE_C4, 60, 0, 1);
    buzzer.tone(NOTE_E4, 60, 0, 1);
    buzzer.tone(NOTE_G4, 60, 0, 1);
    buzzer.tone(NOTE_C5, 250, 0, 1);
  }

  Serial.println("Setup step: display");
  displayAvailable = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (displayAvailable) {
    display.clearDisplay();
    display.display();
    Serial.println("Display ready");
  } else {
    Serial.println("Display init failed");
  }
  
  Serial.println("Setup step: sensors");
  dht.begin();
  RTC.begin();

  // load last config from flash
  Serial.println("Setup step: preferences");
  preferences.begin("hydrotek", false);
  #ifdef PREFERENCES_CLEAR
    // preserve any hardcoded wifi credentials before wiping flash
    String savedSsid = wifiSSID;
    String savedPass = wifiPassphrase;
    preferences.clear();
    if (savedSsid.length() > 0) {
      preferences.putString("wifiSSID", savedSsid);
      preferences.putString("wifiPass", savedPass);
    }
  #endif
  webConfigRead();
  flashRead();

  if (! RTC.isrunning()) {
    // following line sets the RTC to the date & time this sketch was compiled
    RTC.adjust(DateTime(__DATE__, __TIME__));
  }
  #ifdef SET_RTC_MANUAL
    RTC.adjust(DateTime(__DATE__, __TIME__));
  #endif

  Serial.println("Setup complete");

}

String serialInputBuffer = "";

void handleSerialCommand(String cmd) {
  cmd.trim();
  Serial.println("CMD: " + cmd);

  if (cmd.startsWith("wifi ")) {
    // usage: wifi <ssid> <passphrase>
    // passphrase may contain spaces
    String rest = cmd.substring(5);
    rest.trim();
    int spaceIdx = rest.indexOf(' ');
    if (spaceIdx < 0) {
      Serial.println("Usage: wifi <ssid> <passphrase>");
      return;
    }
    wifiSSID = rest.substring(0, spaceIdx);
    wifiPassphrase = rest.substring(spaceIdx + 1);
    webConfigWrite();
    WiFi.disconnect(true);
    delay(200);
    calledWifiBegin = false;
    wifiConnected = false;
    configEnableWifi.setBoolVal(true);
    flashWrite();
    Serial.println("WiFi credentials saved. Connecting to: " + wifiSSID);
    WiFi.begin(wifiSSID.c_str(), wifiPassphrase.c_str());
    calledWifiBegin = true;

  } else if (cmd == "pair") {
    if (!wifiConnected) {
      Serial.println("Not connected to WiFi - connect first with: wifi <ssid> <pass>");
      return;
    }
    Serial.println("Starting pairing...");
    startPairing();
    Serial.println("Pairing code: " + pairingCode);
    Serial.println("Confirm in the web app. Polling for confirmation...");

  } else if (cmd == "status") {
    Serial.println("WiFi: " + String(wifiConnected ? "connected" : "disconnected") + " (" + wifiSSID + ")");
    Serial.println("DeviceID: " + (deviceID.length() > 0 ? deviceID : "not paired"));
    if (uiMode == UI_PAIRING_WAIT && pairingCode.length() > 0 && pairingCode != "ERR") {
      Serial.println("Pairing pending - code: " + pairingCode);
    } else if (deviceID.length() > 0) {
      Serial.println("Paired");
    } else {
      Serial.println("Not paired - use: pair");
    }

  } else {
    Serial.println("Commands: wifi <ssid> <pass> | pair | status");
  }
}

void handleSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialInputBuffer.length() > 0) {
        handleSerialCommand(serialInputBuffer);
        serialInputBuffer = "";
      }
    } else {
      serialInputBuffer += c;
    }
  }
}

int long unsigned lastSensorUpdate = 0;
int long unsigned lastSerialUpdate = 0;
bool wifiConnOnce = false; // track whether wifi ever connected
bool calledWifiBegin = false; //track whether WiFi.begin() was called (only do this once, but we don't do this in setup() as we need to wait a while for the stack to be ready
bool rtcSyncedFromServer = false;
void loop () {

  unsigned int long curMillis = millis();

  handleSerial();

  if (millis() - lastSerialUpdate > 60000) {
    String upd = "";
    upd = "Temp: " + String(temp) + " Target: " + String(configLampHeaterTemp.floatVal());
    Serial.println(upd);
    lastSerialUpdate = millis();
  }

  if (curMillis - screenSleepLastAction > screenSleepTime * 60 * 1000) {
    screenIsSleeping = true;
  }

  if (configEnableWifi.boolVal()) {
    if (!calledWifiBegin && millis() > 4000 && wifiSSID.length() > 0) {
      WiFi.begin(wifiSSID.c_str(), wifiPassphrase.c_str());
      calledWifiBegin = true;
    }
  }

  if (uiMode == UI_PAIRING_WAIT) {
    pollPairingStatus();
  }

  //OK button down
  buttonOK.checkState(curMillis);
  buttonBK.checkState(curMillis);
  buttonUP.checkState(curMillis);
  buttonDN.checkState(curMillis);

  //update sensors and display every x ms
  if (curMillis - lastSensorUpdate > LOOP_SPEED || lastSensorUpdate == 0) {
    lastSensorUpdate = curMillis;

    //check the WiFi status
    if (configEnableWifi.boolVal()) {
      if (calledWifiBegin && WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        if (!wifiConnOnce) {
          wifiConnOnce = true;
        }
        if (!rtcSyncedFromServer) {
          syncRtcFromServer();
          rtcSyncedFromServer = true;
        }
        if (!bootConfigReported && deviceID.length() > 0) {
          remoteConfigDirty = true;
        }
      } else {
        wifiConnected = false;
      }
    }

    DateTime now = RTC.now();

    //get temp and humidity readings
    tempCheckState();

    //check float sensor state
    floatCheckState();

    //update lamp states
    lampCheckState(now.hour());

    //update flow readings
    flowCheckState();

    //update pump states
    pumpCheckState(now.hour() * 60 * 60 + now.minute() * 60 + now.second());

    //sound any alarms
    alarmCheckState();

    //write to the display
    displayUpdate(curMillis);

    //upload to server
    if (configEnableWifi.boolVal()){
      syncPendingDeviceConfig();
      uploadData(curMillis);
      pullRemoteConfig();
    }

  }

}
