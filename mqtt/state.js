var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.topic = 'v1/+/location/+/registries/+/devices/+/state/+'
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			console.log(arr)
			console.log(message.toString())

			this.storeData(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1], state: arr[arr.length - 1] })
		})
	}
	storeData(data, { deviceName, regName, customerID, state }) {
		try {
			let pData = JSON.parse(data)
			let query = "INSERT INTO Device_state(`data`, device_id, customer_id, reg_name, state) VALUES ('" + JSON.stringify(pData.data) + '\',\'' + deviceName + '\',\'' + customerID + '\',\'' + regName+ '\',\'' + state + "')"
			console.log(query)
			mysqlConn.query(query, (err, result) => {
				if (err) { console.log(err) }
			})
		}
		catch (e) {
			console.log("ERROR:", e.message)
		}
		// console.log(pData.data)
	}

}

module.exports = StoreMqttHandler