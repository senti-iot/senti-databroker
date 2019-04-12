var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.topic = 'v1/+/location/+/registries/+/devices/+/publish'
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			console.log(arr)
			console.log(message.toString())
			this.storeData(message.toString(), { deviceName: arr[arr.length - 2], regName: arr[arr.length - 4], customerID: arr[1] })
		})
	}
	storeData(data, { deviceName, regName, customerID }) {
		try {
			/* INSERT INTO Device_data
			(data, topic, created, device_id)
			SELECT '{"test":"hello"}', '', NOW(),Device.id as device_id from `Registry`
			INNER JOIN `Device` ON `Registry`.`id` = `Device`.`reg_id` where customer_id=1 */
			
			let pData = JSON.parse(data)
			let query = `INSERT INTO Device_data
			(data, topic, created, device_id)
			SELECT '${JSON.stringify(pData.data)}', '', NOW(),Device.id as device_id from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id where customer_id=1`
			// VALUES ('" + JSON.stringify(pData.data) + '\',\'' + deviceName + '\',\'' + customerID + '\',\'' + regName + "')`
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