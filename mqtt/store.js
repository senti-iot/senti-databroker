var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			console.log(arr)
			console.log(message.toString())
			this.storeData(message.toString(), arr[arr.length - 2])
		})
	}
	storeData(data, deviceID) {
		try {

			let pData = JSON.parse(data)
			let query = "INSERT INTO `Device_data`(data,device_name) VALUES ('" + JSON.stringify(pData.data) + '\',\'' + deviceID + "')"
			console.log(query)
			mysqlConn.query(query)
		}
		catch (e) {
			console.log("ERROR:", e.message)
		}
		// console.log(pData.data)
	}

}

module.exports = StoreMqttHandler