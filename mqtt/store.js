var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			console.log(arr)
			this.storeData(message.toString(), arr[arr.length-1])
		})
	}
	storeData(data, deviceID) {
		let pData = JSON.parse(data)
		console.log(deviceID)
		// console.log(pData.data)

		let query  ="INSERT INTO `Device_data`(data,device_name) VALUES ('"+ JSON.stringify(pData.data) + '\',\'' + pData.deviceID + "')"
		console.log(query)
		mysqlConn.query(query)
	}

}

module.exports = StoreMqttHandler