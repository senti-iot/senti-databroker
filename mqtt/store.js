var MqttHandler = require('./mqtt_handler.js')


class StoreMqttHandler extends MqttHandler {
	init() {
		this.mqttClient.on('message', (topic, message)=> {

			this.storeData(message.toString())
		})
	}
	storeData(data) {
		console.log('Received Data, ready to store', data)
	}

}

module.exports = StoreMqttHandler