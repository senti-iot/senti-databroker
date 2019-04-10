var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			console.log(arr)
			console.log(message.toString())
			this.storeData(message.toString(), {deviceName: arr[arr.length - 2],regName: arr[arr.length-4]})
		})
	}
	storeData(data, {deviceName, regName}) {
		try {

			let pData = JSON.parse(data)
			let query = "INSERT INTO `Device_data`(data,device_name,reg_name) VALUES ('" + JSON.stringify(pData.data) + '\',\'' + deviceName + '\',\'' + regName + "')"
			console.log(query)
			mysqlConn.query(query, (err, result) => {
				if(err) {console.log(err)}
			})
		}
		catch (e) {
			console.log("ERROR:", e.message)
		}
		// console.log(pData.data)
	}

}

module.exports = StoreMqttHandler