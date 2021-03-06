const mqtt = require('mqtt');

class MqttHandler {
	constructor() {
		this.mqttClient = null;
		this.host = 'mqtt://hive.senti.cloud';
		this.topic = '';
		this.topics = [];
	}
	init() { }
	connect() {

		this.mqttClient = mqtt.connect(this.host, {
			clientId: 'dataBroker_' + Math.random().toString(16).substr(2, 8)
		});
		this.init();

		this.mqttClient.on('error', (err) => {
			console.log(err);
			this.mqttClient.end();
		});

		this.mqttClient.on('connect', () => {
			// console.log(this.host);
			// console.log('\n')
			console.log('MQTT client connected'.green.bold)
			this.topics.forEach(topic => {
				this.mqttClient.subscribe(topic, { qos: 1 }, () => {
					console.log('MQTT client subscribed to: ' + topic.yellow.bold);
					// console.log('\n')
				});
			})
		});

		this.mqttClient.on('message', function (topic, message) {
			console.log(topic);
			console.log(message);
		});

		this.mqttClient.on('close', (err) => {
			console.log(`mqtt client disconnected`, err);
		});
	}
	// Sends a mqtt message
	sendMessage(message) {
		this.mqttClient.publish(this.topic, message);
	}
}

module.exports = MqttHandler;