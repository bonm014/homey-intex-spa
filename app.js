'use strict';

const Homey = require('homey');

class IntexSpaApp extends Homey.App {

  discoveredDevice = undefined;
  mqttTopicRoot = 'SpaTiTan';

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');

    this.clientAvailable = false;
    this.lastMqttMessage = undefined;
    this.drivers = this.homey.drivers.getDrivers();
    
    this.connectMqttClient();
  }

  connectMqttClient() {
    this.MQTTClient = this.homey.api.getApiApp('nl.scanno.mqtt');
    this.MQTTClient
      .on('install', () => this.register())
      .on('uninstall', () => this.unregister())
      .on('realtime', (topic, message) => this.onMessage(topic, message));

    try {
      this.MQTTClient.getInstalled()
        .then(installed => {
          this.clientAvailable = installed;
          this.log(`MQTT client status: ${this.clientAvailable}`);

          if (installed) {
            this.register();
            this.homey.apps.getVersion(this.MQTTClient).then((version) => {
              this.log(`MQTT client installed, version: ${version}`);
            });
          }
        }).catch((error) => {
          this.log(`MQTT client app error: ${error}`);
        });
    } catch (error) {
      this.log(`MQTT client app error: ${error}`);
    }
  }

  onMessage(fullTopic, message) {
    //this.log(`<< ${fullTopic}: ${JSON.stringify(message, null, 2)}`);

    this.lastMqttMessage = Date.now();

    const topic = fullTopic.split('/').slice(1).join('/');

    // This info is only published once at subscription.
    // Keep trace of it for discovery process.
    if (topic === 'pool/model') {
      this.discoveredDevice = message;
    }

    Object.keys(this.drivers).forEach((driverId) => {
      this.drivers[driverId].onMessage(topic, message);
    });
  }

  sendMessage(topic, payload, driver = 'intex_spa') {
    const fullTopic = topic;
    
    if(driver === 'intex_spa') {
      topic.startsWith(this.mqttTopicRoot + '/') ? topic : `${this.mqttTopicRoot}/${topic}`
    }

    this.log(`>> ${fullTopic}: ${payload}`);

    if (!this.clientAvailable)
      return;

    this.MQTTClient.post('send', {
      qos: 0,
      retain: false,
      mqttTopic: fullTopic,
      mqttMessage: payload
    }, error => {
      this.log(`Error sending ${fullTopic} <= "${payload}": ${error}`);
    }).catch(error => {
      this.log(`Error while sending ${fullTopic} <= "${payload}". ${error}`);
    });
  }

  unsubscribeTopic(topicName) {
    if (!this.clientAvailable)
      return;

    this.log(`UnSubscribing to topic: ${topicName}`);

    return this.MQTTClient.post('unsubscribe', { topic: topicName }, error => {
      if (error) {
        this.log(`Can not unsubscribe to topic ${topicName}, error: ${error}`)
      } else {
        this.log(`Sucessfully unsubscribed to topic: ${topicName}`);
      }
    }).catch(error => {
      this.log(`Error while unsubscribing to ${topicName}. ${error}`);
    });
  }

  subscribeTopic(topicName) {
    if (!this.clientAvailable)
      return;

    this.log(`Subscribing to topic: ${topicName}`);

    return this.MQTTClient.post('subscribe', { topic: topicName }, error => {
      if (error) {
        this.log(`Can not subscribe to topic ${topicName}, error: ${error}`)
      } else {
        this.log(`Sucessfully subscribed to topic: ${topicName}`);
      }
    }).catch(error => {
      this.log(`Error while subscribing to ${topicName}. ${error}`);
    });
  }

  register() {
    this.clientAvailable = true;
    this.lastMqttMessage = Date.now();

    // Subscribing to system topic to check if connection still alive (update ~10 second for mosquitto)
    this.subscribeTopic("$SYS/broker/uptime");

    this.homey.app.subscribeTopic(`${this.mqttTopicRoot}/pool/#`);

    let now = Date.now();
    Object.keys(this.drivers).forEach((driverId) => {
      this.drivers[driverId].getDevices().forEach((device) => {
        device.nextRequest = now;
      });
      // this.drivers[driverId].updateDevices();
    });
  }

  unregister() {
    this.clientAvailable = false;
    this.lastMqttMessage = undefined;

    this.log(`${this.constructor.name} unregister called`);
  }
}

module.exports = IntexSpaApp;
