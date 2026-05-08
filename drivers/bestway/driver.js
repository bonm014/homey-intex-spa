'use strict';

const Homey = require('homey');

module.exports = class BestwayDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Bestway Lay-Z-Spa has been initialized');
  }

  onMessage(topic, message) {
    let devices = this.getDevices();
    for (const device of devices) {
      device.onMessage(topic, message, 'bestway').catch(this.error);
    }
  }

  sendMessage(topic, payload) {
    this.homey.app.sendMessage(topic, payload);
  }

  onPair(session) {
    this.log('pairing');

    let mqttConfig = {};

    session.setHandler('create_device', async (data) => {
      this.log(`create device : ${data}`);
      const device = {
        name: data.mqtt_topic,
        data: {
          id: `mqtt-${Date.now()}`
        },
        settings: {
          mqtt_topic: data.mqtt_topic
        }
      };

      // Device direct aanmaken zonder add_devices template
      await session.emit('add_device', device);
      await session.done();
    });
  }
  
  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
      // Example device data, note that `store` is optional
      // {
      //   name: 'My Device',
      //   data: {
      //     id: 'my-device',
      //   },
      //   store: {
      //     address: '127.0.0.1',
      //   },
      // },
    ];
  }

};
