'use strict';

const Homey = require('homey');

module.exports = class BestwayDevice extends Homey.Device {
  values = {};
  mqttTopic = "";
  tempUnit = 1;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('BestwayDevice has been initialized');

    // Haal opgeslagen settings op
    this.mqttTopic = this.getSetting('mqtt_topic');
    this.log('MQTT Topic:', this.mqttTopic);

    if (this.mqttTopic) {
      await this.subscribeToTopic(this.mqttTopic);
    }

    this.log(`Capabilities: ${JSON.stringify(this.getCapabilities())}`);

    const capabilities = this.getCapabilities();
    for (const capability of capabilities) {
      this.log(`Registering listener for capability: ${capability}`);

      // Setup initial value
      this.values[capability] = await this.getCapabilityValue(capability);

      this.registerCapabilityListener(capability, async (value) => {
        const topic = `${this.mqttTopic}/command`;
        const mapper = await this.commandTopicFromCapability(capability);
        const mqttValue = await this.valueFomCapability(capability,value);

        this.log(`Sending message to topic: ${topic}, command: ${mapper}, value: ${mqttValue} <- Capability: ${capability}`);
        const mqttMessage = `{"CMD":${mapper},"VALUE":${mqttValue},"XTIME":0,"INTERVAL":0}`;

        await this.driver.sendMessage(topic, mqttMessage);
      });
    }

    if (!this.hasCapability('measure_tempAmbient')) {
        await this.addCapability('measure_tempAmbient');
    }
    if (!this.hasCapability('measure_power')) {
        await this.addCapability('measure_power');
    }
    if (!this.hasCapability('alarm_pump_device')) {
        await this.addCapability('alarm_pump_device');
    }
    

    if (this.hasCapability('tempAmbient')) {
        await this.removeCapability('tempAmbient');
    }

    this.registerSwitchAction('bubble_action', 'bubble');
    this.registerSwitchAction('filter_action', 'filter');
    this.registerSwitchAction('heater_action', 'heater');
    this.registerSwitchAction('power_action', 'power');

    this.homey.flow.getActionCard("ambienttemp_action").registerRunListener(async (args, state) => {
      const topic = `${this.mqttTopic}/command`;
      const mapper = await this.commandTopicFromCapability("measure_tempAmbient");
      const mqttValue = args.temp;

      this.log(`Sending message to topic: ${topic}, command: ${mapper}, value: ${mqttValue}`);
      const mqttMessage = `{"CMD":${mapper},"VALUE":${mqttValue},"XTIME":0,"INTERVAL":0}`;

      await this.driver.sendMessage(topic, mqttMessage);
    });
    

    this.homey.flow.getConditionCard('bubble_turned_on').registerRunListener(async (args, state) => {
      return args.device.getCapabilityValue('bubble');
    });
    this.homey.flow.getConditionCard('filter_turned_on').registerRunListener(async (args, state) => {
      return args.device.getCapabilityValue('filter');
    });
    this.homey.flow.getConditionCard('heater_turned_on').registerRunListener(async (args, state) => {
      return args.device.getCapabilityValue('heater');
    });
    this.homey.flow.getConditionCard('power_turned_on').registerRunListener(async (args, state) => {
      return args.device.getCapabilityValue('power');
    });
  }

  async valueFomCapability(capability,value) {
    switch (capability) {
      case 'bubble':
      case 'filter':
      case 'heater':
        return value ? 1 : 0;
      case 'tempSet':
      case 'target_temperature':
        return value
      default:
        return null;
    }
  }

  async commandTopicFromCapability(capability) {
    switch (capability) {
      case 'bubble':
        return 2;
      case 'filter':
        return 4;
      case 'heater':
        return 3;
      case 'tempSet':
      case 'target_temperature':
        return 0;
      case 'measure_tempAmbient':
        if(this.tempUnit==0)
          return 14;
        else
          return 15;
      default:
        return null;
    }
  }


  async registerSwitchAction(actionId, capability) {
    this.homey.flow.getActionCard(actionId).registerRunListener(async (args, state) => {
      let mqttValue = null;
      if (args.state === 'toggle') {
        mqttValue = this.getCapabilityValue(capability) ? 1 : 0;
      } else {
        mqttValue = args.state;
      }

      const topic = `${this.mqttTopic}/command`;
      const mapper = await this.commandTopicFromCapability(capability);

      this.log(`Sending message to topic: ${topic}, command: ${mapper}, value: ${mqttValue} <- Capability: ${capability}`);
      const mqttMessage = `{"CMD":${mapper},"VALUE":${mqttValue},"XTIME":0,"INTERVAL":0}`;

      await this.driver.sendMessage(topic, mqttMessage);
    });
  }

  formatDate(date) {
    const tz = this.homey.clock.getTimezone()

    const parts = new Intl.DateTimeFormat('nl-NL', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

    const formatted = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;

    return formatted;
  }

  async onMessage(topic, message) {
    let messageTopic = `${this.mqttTopic}/${topic}`;

    if(topic === 'times') 
    {
        const times = message; //JSON.parse(message);

        this.setCapabilityValue('measure_power', times.WATT);
    }
   
    if(topic === 'message') 
    {
      //this.log(`Found bestway topic ${messageTopic}`)

      try {
        const status = message; //JSON.parse(message);

        const date = new Date(status.TIME * 1000);
        let strDate = this.formatDate(date);

        this.setCapabilityValue('measure_lastrefresh', strDate);

        let alarm_pump_device = false;
        let alarm_heat = false;
        let errorcode = status.ERR / 1;

        if(errorcode > 0) {
          this.setCapabilityValue('power',  true);
          this.setCapabilityValue('heater', false);
          this.setCapabilityValue('filter', false);
          this.setCapabilityValue('bubble', false);

          this.setCapabilityValue('alarm_heat', false);

          this.setCapabilityValue('target_temperature', 20);
          this.setCapabilityValue('measure_temperature', 20);

          switch(errorcode)
          {
            case 2:
              alarm_pump_device = true;
              break;
            case 3:
            case 4:
            case 5:
              alarm_heat = true;
              break;
          }

          this.setCapabilityValue('alarm_heat', alarm_heat);
          this.setCapabilityValue('alarm_pump_device', alarm_pump_device);
        }
        else
        {
          this.setCapabilityValue('alarm_heat', false);
          this.setCapabilityValue('alarm_pump_device', false);

          this.setCapabilityValue('power',  status.PWR  == 1);
          this.setCapabilityValue('heater', status.GRN  == 1 || status.RED == 1);
          this.setCapabilityValue('filter', status.FLT  == 1);
          this.setCapabilityValue('bubble', status.AIR  == 1);

          //UNITSTATE (0=F, 1=C)
          this.tempUnit = status.UNT;
          if(status.UNT == 0) {
            this.setCapabilityValue('target_temperature', status.TGTF);
            this.setCapabilityValue('measure_temperature', status.TMPF);
            this.setCapabilityValue('measure_tempAmbient', status.AMBF);
          }
          else {
            this.setCapabilityValue('target_temperature', status.TGTC);
            this.setCapabilityValue('measure_temperature', status.TMPC);
            this.setCapabilityValue('measure_tempAmbient', status.AMBC);
          }
        }
      } 
      catch (err) {
        console.error('Error processing message:', err);
      }
    }
  }

  async subscribeToTopic(topic) {
    // Jouw MQTT logica hier
    this.log('Subscribing to:', topic);

    this.mqttTopic = topic;

    this.homey.app.subscribeTopic(topic);
    this.homey.app.subscribeTopic(`${this.mqttTopic}/Status`);
    this.homey.app.subscribeTopic(`${this.mqttTopic}/message`);
    this.homey.app.subscribeTopic(`${this.mqttTopic}/times`);
  }

  async unsubscribeFromTopic(topic) {
    this.log('Unsubscribing from:', topic);

    this.homey.app.unsubscribeTopic(topic);
    this.homey.app.unsubscribeTopic(`${this.mqttTopic}/Status`);
    this.homey.app.unsubscribeTopic(`${this.mqttTopic}/message`);
    this.homey.app.unsubscribeTopic(`${this.mqttTopic}/times`);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('BestwayDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('BestwayDevice settings where changed');

    this.log('Settings changed:', changedKeys);

    if (changedKeys.includes('mqtt_topic')) {
      const oldTopic = oldSettings.mqtt_topic;
      const newTopic = newSettings.mqtt_topic;

      // Oude subscription opruimen
      if (oldTopic) {
        await this.unsubscribeFromTopic(oldTopic);
      }

      // Nieuwe subscription starten
      if (newTopic) {
        await this.subscribeToTopic(newTopic);
      }
    }

    // Als je de wijziging wilt weigeren, gooi een Error:
    // throw new Error('Ongeldig topic formaat');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('BestwayDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('BestwayDevice has been deleted');
  }
};
