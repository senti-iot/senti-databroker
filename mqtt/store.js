var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.mqttClient.on('message', (topic, message) => {

			this.storeData(message.toString())
		})
	}
	storeData(data) {
		let pData = JSON.parse(data)
		// console.log(pData.data)
		let query  ="INSERT INTO `Device_data`(data,device_id) VALUES ('"+ JSON.stringify(pData.data) + '\',' + pData.device_id + ")"
		// console.log(query)
		mysqlConn.query(query)
	}

}

module.exports = StoreMqttHandler