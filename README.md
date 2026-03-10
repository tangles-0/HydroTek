# HydroTek

## An IoT Controller for Aquaponics, Hydroponics, and Aeroponics

---

### Status Update

This project is under development. If you wish to build this you should contact me to see if it's feasible at the time.
As of writing, the hardware is mostly complete, but I am designing a new PCB to address quality of life points, such as proper connectors for sensors instead of IDC header pins.

- **Firmware** (ESP32, in `firmware/hydrotek/`): Largely complete. On-device menu, flash-stored settings, Wi‑Fi provisioning (SSID scan and passphrase entry on the 128×64 OLED with four buttons), device pairing with the web app, RTC time sync from server, and bidirectional config sync (device as source of truth; web can push pending config; device reports local changes). Telemetry and alarm states are sent to the web API.
- **Web app** (in `nextapp/`): Next.js 15 app with email/password auth, Neon PostgreSQL (Drizzle), dashboard (telemetry chart/table, device tabs, 1h/12h/24h/30d range), device pairing (one-time code on OLED, confirm in app), device settings modal (form-based config, sync state, remove device), and responsive light/dark UI. See `nextapp/README.md` for setup and run instructions.
- **Casing**: Designs will not be started until the PCB for the current revision is finalised and tested.

---

### Design:

There are four components to this repository:

- PCB cad file (created in PCBWeb for early revisions, then KiCad as of rev7)
- Firmware for the ESP32
- STL files for a case
- The web app (`nextapp/`) for configuration and monitoring of the device

### History:

Early revisions used an ESP8266 and an Arduino Nano, which communicated with each other over serial. Since discovering the ESP32 I've changed the design to simplify it greatly, however I suffered a consistent issue with the gerber files produced by PCBWeb which is now abandonware. New revisions are made in KiCAD.

---

### Overview:

This device is designed to control lighting and nutrient delivery in a hydroponics environment. It has been designed for use primarily with my own run-to-waste hydroponic system, however could be applied to just about any setup where the same sensors and control outputs are relevant, such as airponics, aquaponics, or even a simple vegge patch.

It's flexible enough that I've also used this to control the temperature within an enclosed container for making bread dough!

---

_latest hardware revision: 7_

(rev6 pictured below)
Powered here by USB - barrel jack connector not installed.
![alt-text](https://i.imgur.com/nuCdhum.jpg "Image")
![alt-text](https://i.imgur.com/tzIy5Id.jpg "Image")

(rev5 pictured below)

![alt-text](https://i.imgur.com/Od8aEW4l.jpg "Image")

(rev4 pictured below)

![alt-text](https://i.imgur.com/qcLx93il.jpg "Image")

(rev3 pictured below)

![alt-text](https://i.imgur.com/RJYCEXgl.jpg "Image")

---

## Device Options Menu (rev5):

https://www.youtube.com/watch?v=8toKR6Uxk_A

### Features:

- Uploads sensor data to cloud via WiFi
- 128x64 OLED display
- RTC with battery backup for control of grow light times even while offline or after power outage
- Online RTC time updates for accurate timekeeping
- Can monitor:
  - DHT22 temperature / humidity sensor
  - Liquid flow sensor (YF-S201 or any 5V based hall-effect sensor)
  - Float switch to detect either empty nutrient tank or full run-off tank
- Can control:
  - Grow light
  - Nutrient pump
- Buzzer / LED to alert user to lost WiFi signal, temperature extremes, nutrient pump faults, or full / empty nutrient / run-off tanks
- The board can be powered either through the barrel jack as designed or using a USB power source plugged into the ESP32 (Note: some USB power sources may not be sufficient to run both the HydroTek as well as relays connected)

I2C pH sensors _could_ be connected using a kit [such as this](https://www.sparkfun.com/products/10972), however pH meters are supposed to be stored in a pH-neutral storage solution. Since this means they aren't suitable for a constant-monitoring setup, pH monitoring was excluded from the feature set.

---

### Design considerations:

- The device must be maintenance-free
- Once assembled, flashed, and configured, the device must be easy to set up and use by non-technical people
- Compact size desirable. Other off-the-shelf units or open-source setups seem to be quite large

---

### Implemented (firmware + web):

- **Wi‑Fi on device**: SSID scan and passphrase entry via 4-button menu and OLED (credentials stored in flash).
- **Device pairing**: Device requests a one-time code from the web API, shows it on the OLED; user confirms in the web app; device polls until paired and stores device/account IDs and token in flash.
- **RTC time sync**: Device fetches time from the web API on boot and when connected; optional “Sync Clock” menu action.
- **Config sync**: Device pushes full config on boot and when settings change on-device (device is source of truth). Web app can set “pending” config; device polls and applies pending config, then acknowledges. “Fetch Config” menu option forces a pull. Config state (pending/success/device) is shown in the web settings modal.
- **Flow calibration on device**: Menu option for flow sensor; run 5L through and confirm to calibrate pulses per mL.
- **Web app**: Password auth, dashboard with telemetry chart (temp, humidity, flow) and table, device tabs, range filters (1h/12h/24h/30d), status indicators (lamp, pump, floats, alarm), add-device and device-settings modals, form-based device config (no raw JSON). See `nextapp/README.md`.

---

### PCB Build instructions:

Note: The capacitors, barrel jack, and LM7805 can be omitted if the intention is to only run HydroTek from a reliable USB power source.

_(rev5)_

- To manufacture the PCB, upload the gerber files for the current PCB revision to a service such as [DirtyPCBs](http://dirtypcbs.com/store/pcbs)
- Purchase the components, as desired, outlined in the BOM file
- Solder the components to the PCB, ensuring the following order is observed (_B/S = BOTTOM SIDE_):
  - (B/S) Solder the LM7805 linear regulator to the UNDERSIDE of the board, ensuring the tab is soldered to the large square pad for heat dissipation
  - Solder in the 4x capacitors
  - Solder in the piezo buzzer
  - Solder in the IDC headers for the sensor inputs (to the TOP side of the board)
  - Solder in the IDC sockets for the LCD (or alternatively, solder the LCD direct to the board, if clearance above capacitors allows)
  - Solder in the ESP32
  - Solder remaining components
  - Install IDC jumper shunts between the GND and DATA pins for flow sensors that will not be used, else the pin will float and detect erroneous readings
  - If the float sensor logic is to be inverted (normally-closed), a jumper shunt on those pins will be handy to silence the alarm if the power is on and the float sensors are not connected
- Configure your Arduino IDE according to the section below
- Set the web API base URL in the sketch (e.g. `webEndpoint`) if needed, then upload to the ESP32. Wi‑Fi SSID and passphrase can be set on-device via the menu (Options → Wi‑Fi) after first boot.
- Power on your HydroTek, configure Wi‑Fi from the device menu, then pair and use the web app to confirm it works
- Connect your (safe, low-voltage) lamps / pumps to the relay module and connect the relay module inputs to the header pins on the PCB
  - NOTE: If in any doubt at all, use safe, low-voltage LED grow lights and nutrient pumps. Switching of mains voltages may not be at all legal where you live, your relays may not be sufficient, I advise you not to try it, and I accept no responsibility if you do.

---

### Arduino IDE Configuration:

_(rev5)_

- Go to 'File' > 'Preferences', then click the icon to the right of the text input for "Additional board manager URLs"
- Paste the following text into the field (separate existing entries by a comma and a new line):
  > https://dl.espressif.com/dl/package_esp32_index.json
- Go to 'Tools' > 'Board...' > 'Boards Manager'
- Search for ESP32, and install the 'esp32 by Espressif Systems' package (version 1.0.2 at the time of writing)
- Go to 'Tools' > 'Board...' and select 'ESP32 Dev Module'
- Go to 'Sketch' > 'Include Library' > 'Manage Libraries'
- Search for 'Adafruit GFX' and install the 'Adafruit GFX Library' package by Adafruit
- Search for 'Adafruit 1306' and install the 'Adafruit SSD1306' package by Adafruit
- Search for 'dht22' and install the 'DHT sensor library' package by Adafruit
- Search for 'rtclib' and install the 'RTClib' package by Adafruit

- Go to 'Tools' > 'Port' and select the port for your connected ESP32
- Once you have edited the .ino file to suit your desired configuration, click upload to flash the ESP.

---

### Known issues:

_(rev5)_

- Have not designed a 3D printable case. Will not do this until satisfied the board design is final
- The nutrient flow values are derived from flow sensor pulses and the configurable “Flow pulses per mL” (or from the on-device calibration flow).

---

### API (device ↔ web app)

The firmware uses a **base URL** in `webEndpoint` (e.g. `https://your-host/api/device`). The ESP32 talks to the Next.js app in `nextapp/` with these flows:

| Purpose | Method | Path | Auth |
|--------|--------|------|------|
| Time sync | GET | `/time` | — |
| Request pairing code | POST | `/pairing/request` | — |
| Poll pairing status | GET | `/pairing/status?code=XXX` | — |
| Telemetry (temp, humidity, flow, lamp, pump, floats, alarms) | POST | `/telemetry` | Bearer device token |
| Get config (when pending) | GET | `/config?deviceId=...` | Bearer device token |
| Notify config changed (device edited) | POST | `/config/changed` | Bearer device token |

Telemetry and config payloads are JSON. The web app exposes device pairing, telemetry history, and device config (form-based) to logged-in users. See `nextapp/README.md` for environment and run instructions.
