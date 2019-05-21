var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
const logger = require('../server').logger
const moment = require('moment')

class StoreMqttHandler extends MqttHandler {
	init() {
		this.topic = 'v1/+/location/+/registries/+/devices/+/publish'
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			// console.log(arr)
			// console.log(arr[7], arr[5], arr[1])
			logger.info([message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] }])
			this.storeData(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
			// logger.info({ MIX: { IN: true } })
		})
	}
	async storeData(data, { deviceName, regName, customerID }) {
		try {
			console.log('STORING DATA')
			console.log(deviceName, regName, customerID)
			let pData = JSON.parse(data)
			let deviceQ = `SELECT d.id, d.name, d.type_id, d.reg_id, d.\`normalize\`, dm.\`data\` as metadata from Device d
			INNER JOIN Registry r ON r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			LEFT JOIN Device_metadata dm on dm.device_id = d.id
			where c.uuid='${customerID}' AND d.uuid='${deviceName}' AND r.uuid='${regName}' AND d.deleted = 0;
			`
			let query = `INSERT INTO Device_data
			(data, topic, created, device_id)
			SELECT '${JSON.stringify(pData)}', '', '${moment.unix(pData.time).startOf('day').format('YYYY-MM-DD HH:mm:ss')}', Device.id as device_id from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id
			INNER JOIN Customer ON Customer.id = Registry.customer_id
			where Customer.uuid='${customerID}' AND Device.uuid='${deviceName}' AND Registry.uuid='${regName}'
			`
			console.log(deviceQ)
			let lastId = null
			await mysqlConn.query(query).then(([res, fi]) => {
				lastId = res.insertId;
			})
			let [device, fields] = await mysqlConn.query(deviceQ)
			// console.log('Device', device[0])
			if (device.length > 0) {
				if (device[0].normalize >= 1) {					
					// console.log(device[0])
					let nData = JSON.parse(data)
					// console.log('nData',nData)
					let normalized = await engineAPI.post('/', {nId: device[0].normalize, data: { data:pData.data,k: device[0].metadata.key, deviceId: deviceName, seq: pData.seqnr }}).then(rs => { console.log('EngineAPI Response:', rs.status); return rs.ok ? rs.data : null })
					console.log('EngineAPI:',normalized)
					let normalizedQ = `INSERT INTO Device_data_clean
				(data, created, device_id, device_data_id)
				SELECT '${normalized}', '${moment.unix(pData.time).startOf('day').format('YYYY-MM-DD HH:mm:ss')}' ,Device.id as device_id, ${lastId} from Registry
				INNER JOIN Device ON Registry.id = Device.reg_id
				INNER JOIN Customer ON Customer.id = Registry.customer_id
				where Customer.uuid='${customerID}' AND Device.uuid='${deviceName}' AND Registry.uuid='${regName}'
				`
				console.log(normalizedQ)
					await mysqlConn.query(normalizedQ).then().catch(e => {
						console.log(e)
					})
				}
				return true
			}
			else {
				return false
				// res.status('404').json({'Error':'Device not found'});
			}
		}
		catch (e) {
			console.log("ERROR:", e.message)
			return false
		}
		// console.log(pData.data)
	}

}

module.exports = StoreMqttHandler