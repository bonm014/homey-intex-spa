# Intex Spa

Adds support of Intex Spa throught MQTT protocol.

Current features:
- Get water temperature
- Set target water temperature
- Control heater, blowers, filters
- Toggle power
- Meter Power (Bestway only)
- Error handling (Bestway only)


# Prerequisites

This application depends on [Menno van Grinsven MQTT Client](https://homey.app/fr-fr/app/nl.scanno.mqtt/MQTT-Client) to communicate with a MQTT broker. You have to install and configure this application first (and configure a MQTT broker somewhere).

The underlying communication between the MQTT broker and the SPA is done by a DIY object only. The details are found on the [Github's jnsbyr/esp8266-intexsbh20 repository](https://github.com/jnsbyr/esp8266-intexsbh20).

**Note :** This system is only compatible for these models:
- Intex PureSpa SB-H20
- Intex SimpleSpa SB–B20
- Intex PureSpa SJB-HS
- Intex PureSpa SSP-H (not tested)
- Bestway WIFI remote (https://github.com/visualapproach/WiFi-remote-for-Bestway-Lay-Z-SPA)


All the commands and measures of the Spa are available.
