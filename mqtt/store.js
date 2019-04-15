var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
class StoreMqttHandler extends MqttHandler {
	init() {
		this.topic = 'v1/+/location/+/registries/+/devices/+/publish'
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			// console.log(arr)
			// console.log(message.toString())
			this.storeData(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
		})
	}
	async storeData(data, { deviceName, regName, customerID }) {
		try {

			let pData = JSON.parse(data)
			let deviceQ = `SELECT Device.id, Device.name, Device.type_id, Device.reg_id, Device.normalize from Device
			INNER JOIN Registry ON Registry.id = Device.reg_id
			INNER JOIN Customer on Customer.id = Registry.customer_id
			where uuid='${customerID}' AND Device.name='${deviceName}' AND Registry.name='${regName}';
			`
			let query = `INSERT INTO Device_data
			(data, topic, created, device_id)
			SELECT '${JSON.stringify(pData)}', '', NOW(),Device.id as device_id from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id
			INNER JOIN Customer ON Customer.id = Registry.customer_id
			where uuid='${customerID}' AND Device.name='${deviceName}' AND Registry.name='${regName}'
			`
			let lastId = null
			await mysqlConn.query(query).then(([res, fi])=> {
				lastId = res.insertId;
			})
			let [device, fields] = await mysqlConn.query(deviceQ)
			console.log(device)
			if (device[0].normalize === 1) {
				let normalized = await engineAPI.post('/', { ...JSON.parse(data), flag: device[0].normalize }).then(rs => { console.log(rs.status); return rs.data })
				// console.log(normalized)
				let normalizedQ = `INSERT INTO Device_data_clean
				(data, created, device_id, device_data_id)
				SELECT '${normalized}', NOW(),Device.id as device_id, ${lastId} from Registry
				INNER JOIN Device ON Registry.id = Device.reg_id
				INNER JOIN Customer ON Customer.id = Registry.customer_id
				where uuid='${customerID}' AND Device.name='${deviceName}' AND Registry.name='${regName}'
				`
				await mysqlConn.query(normalizedQ).then().catch(e=> {
					console.log(e)
				})
			}
		}
		catch (e) {
			console.log("ERROR:", e.message)
		}
		// console.log(pData.data)
	}

}

module.exports = StoreMqttHandler