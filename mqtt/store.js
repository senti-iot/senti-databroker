var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
const logService = require('../server').logService
const moment = require('moment')
const SHA2 = require('sha2')

const format = 'YYYY-MM-DD HH:mm:ss'
const dateFormatter = (date) => {
	if (moment.unix(date).isValid()) {
		return moment.unix(date).format(format)
	}
	if (moment(date).isValid()) {
		return moment(date).format(format)
	}
	return 'NOW()'
}
class StoreMqttHandler extends MqttHandler {
	init() {
		this.topic = 'v1/+/location/+/registries/+/devices/+/publish'
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			// console.log(arr)
			// console.log(arr[7], arr[5], arr[1])
			// logService.log([message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] }])

			this.storeData(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
			// logger.info({ MIX: { IN: true } })
		})
	}
	async storeData(data, { deviceName, regName, customerID }) {
		try {
			console.log('STORING DATA')
			// logService.log('STORING DATA', { deviceName, regName, customerID })
			console.log(deviceName, regName, customerID)
			let pData = JSON.parse(data)
			console.log(pData)
			let deviceQ = `SELECT d.id, d.name, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication from Device d
			INNER JOIN Registry r ON r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			LEFT JOIN Device_metadata dm on dm.device_id = d.id
			where c.uuid='${customerID}' AND d.uuid='${deviceName}' AND r.uuid='${regName}' AND d.deleted = 0;
			`
			let query = `INSERT INTO Device_data
			(data, topic, created, device_id, signature)
			SELECT '${JSON.stringify(pData)}', '', '${dateFormatter(pData.time)}', Device.id as device_id, SHA2('${JSON.stringify(pData)}',256) from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id
			INNER JOIN Customer ON Customer.id = Registry.customer_id
			where Customer.uuid='${customerID}' AND Device.uuid='${deviceName}' AND Registry.uuid='${regName}'
			`
			let packageCheckQ = `SELECT signature from Device_data dd
			INNER JOIN Device d on d.id = dd.device_id
			WHERE dd.signature=? and d.uuid=?
			`
			let shaString = SHA2['SHA-256'](JSON.stringify(pData)).toString('hex')

			let check = await mysqlConn.query(packageCheckQ, [shaString, deviceName]).then(([res, fi]) => {
				console.log('\n')
				console.log(SHA2['SHA-256'](JSON.stringify(pData)).toString('hex'))
				// console.log(res[0], fi)
				console.log('\n')
				return res
			})
			if (check.length > 0) {
				console.warn(pData)
				console.warn('DUPLICATE: Package already exists!')
				return false
			}
			//console.log(deviceQ)
			let [device, fields] = await mysqlConn.query(deviceQ)
			if (device.length > 0 && device[0].communication == 0) {
				console.warn('COMMUNICATION: Not allowed!')
				return false
			}
			let lastId = null
			await mysqlConn.query(query).then(([res, fi]) => {
				lastId = res.insertId;
			})
			// console.log('Device\n', device[0])
			if (device.length > 0) {
				if (device[0].communication)
					if (device[0].cloudfunctions)
						if (device[0].cloudfunctions.length >= 1) {
							let normalized = null
							normalized = await engineAPI.post(
								'/',
								{ nIds: device[0].cloudfunctions.map(n => n.nId), data: { ...pData, ...device[0].metadata } })
								.then(rs => {
									console.log('EngineAPI Response:', rs.status, rs.data);
									return rs.ok ? rs.data : null
								})
							// console.log(moment.unix(normalized.time).format('YYYY-MM-DD HH:mm:ss'))
							console.log(normalized.time, moment.unix(pData.time).isValid())
							let normalizedQ = `INSERT INTO Device_data_clean
										(data, created, device_id, device_data_id)
										SELECT '${JSON.stringify(normalized)}',
										'${normalized.time ? dateFormatter(normalized.time) : dateFormatter(pData.time)}',
										Device.id as device_id,
										${lastId} from Registry
										INNER JOIN Device ON Registry.id = Device.reg_id
										INNER JOIN Customer ON Customer.id = Registry.customer_id
										where Customer.uuid='${customerID}' AND Device.uuid='${deviceName}' AND Registry.uuid='${regName}'`
							console.log(mysqlConn.format(normalizedQ))
							await mysqlConn.query(normalizedQ).then(rs => { }).catch(e => {
								console.log(e)
							})
						}
						else {
							let normalizedQ = `INSERT INTO Device_data_clean
										(data, created, device_id, device_data_id)
										SELECT '${JSON.stringify(pData)}',
										'${dateFormatter(pData.time)}',
										Device.id as device_id, ${lastId} from Registry
										INNER JOIN Device ON Registry.id = Device.reg_id
										INNER JOIN Customer ON Customer.id = Registry.customer_id
										where Customer.uuid='${customerID}' AND Device.uuid='${deviceName}' AND Registry.uuid='${regName}'`
							await mysqlConn.query(normalizedQ).then(rs => { }).catch(e => {
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