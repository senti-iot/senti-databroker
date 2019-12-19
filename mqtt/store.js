var MqttHandler = require('./mqtt_handler.js')
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
const asyncForEach = require('../utils/asyncForEach')
// const logService = require('../server').logService
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
const deviceQuery = `SELECT d.id, d.name, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication from Device d
			INNER JOIN Registry r ON r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			LEFT JOIN Device_metadata dm on dm.device_id = d.id
			where c.uuid=? AND d.uuid=? AND r.uuid=? AND d.deleted = 0;
			`
const insDeviceDataQuery = `INSERT INTO Device_data
			(data, topic, created, device_id, signature)
			SELECT ?, '', ?, Device.id as device_id, SHA2(?,256) from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id
			INNER JOIN Customer ON Customer.id = Registry.customer_id
			where Customer.uuid=? AND Device.uuid=? AND Registry.uuid=?
			`
const packageCheckQ = `SELECT signature from Device_data dd
			INNER JOIN Device d on d.id = dd.device_id
			WHERE dd.signature=? and d.uuid=?
			`
const insDataClean = `INSERT INTO Device_data_clean
			(data, created, device_id, device_data_id)
			SELECT ?, ?, Device.id as device_id, ? from Registry
			INNER JOIN Device ON Registry.id = Device.reg_id
			INNER JOIN Customer ON Customer.id = Registry.customer_id
			where Customer.uuid=? AND Device.uuid=? AND Registry.uuid=?`

const getRegistry = `SELECT * from Registry r
			WHERE r.uuid=?`
const createDeviceQuery = `INSERT INTO Device
			(uuid,name, type_id, reg_id,
			description,
			lat, lng, address,
			locType,
			communication)
			VALUES (?,?,?,?,?,?,?,?,?,?)`

const createMetaDataQuery = `INSERT INTO Device_metadata
			(device_id, data, inbound, outbound)
			VALUES(?, ?, ?, ?);`

const selectDeviceType = `SELECT * from Device_type where id=?`

function cleanUpSpecialChars(str) {

	return str.toString()
		.replace(/[øØ]/g, "ou")
		.replace(/[æÆ]/g, "ae")
		.replace(/[åÅ]/g, "aa")
		.replace(/[^a-z0-9]/gi, '-'); // final clean up
}

class StoreMqttHandler extends MqttHandler {
	init() {
		this.topics = ['v1/+/location/+/registries/+/devices/+/publish', 'v1/+/location/+/registries/+/publish']
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			if (arr.length === 9 && arr.indexOf('devices' > -1)) {
				this.storeDataByDevice(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
			}
			if (arr.length === 7) {
				console.log(arr)
				this.storeDataByRegistry(message.toString(), { regName: arr[5], customerID: arr[1] })
			}
		})
	}
	async createDevice(data, regId, deviceTypeId) {
		let uuid = data.uuid ? data.uuid : cleanUpSpecialChars(data.name).toLowerCase()
		let arr = [uuid, data.name, deviceTypeId, regId, '', data.lat, data.lng, data.address, data.locType, data.communication]
		return await mysqlConn.query(createDeviceQuery, arr).then(async rs => {
			console.log('Device Created', rs[0].insertId)
			console.log(data, regId, deviceTypeId)
			let [deviceType] = await mysqlConn.query(selectDeviceType, [deviceTypeId])
			console.log(deviceType[0])
			let mtd = deviceType[0]
			let mtdArr = [rs[0].insertId, JSON.stringify(mtd.metadata), JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
			mysqlConn.query(createMetaDataQuery, mtdArr).then(r => {
				console.log('Device Metadata Created', r[0].insertId)
			}).catch(err => {
				console.log("error: ", err);

			})
			return rs[0].insertId
		}).catch(async err => {
			// if (err) {
			console.log("error: ", err);
		})
	}
	async getDevice(customerID, deviceName, regName) {
		let [device] = await mysqlConn.query(deviceQuery, [customerID, deviceName, regName])
		return device[0]
	}
	async storeDeviceData(pData, registry, customerID, regName) {
		/**
		 * Get the key name
		 */
		let deviceName = pData[registry[0].config.deviceId]
		console.log(deviceName)
		/**
		 *  Check if the device exists
		 * */
		let device = await this.getDevice(customerID, deviceName, regName)

		/**
		 * If the device doesn't exist create it
		 */
		if (!device) {
			let deviceTypeId = registry[0].config.deviceTypeId
			console.log(`DEVICE ${deviceName} DOES NOT EXIST`)
			await this.createDevice({ name: deviceName, communication: 1, ...pData }, registry[0].id, deviceTypeId)
			device = await this.getDevice(customerID, deviceName, regName)
			console.log(device)
		}
		/**
		* Check if device accepts communication
		*/
		if (device && device.communication == 0) {
			console.warn('COMMUNICATION: Not allowed!')
			return false
		}
		if (device) {
			console.log('HERE')
			/**
			 * Delete device id from package and stringify the package
			 */
			delete pData[registry[0].config.deviceId]
			let sData = JSON.stringify(pData)

			/**
			 * Check if the package isn't a duplicate
			 */

			let shaString = SHA2['SHA-256'](sData).toString('hex')

			let check = await mysqlConn.query(packageCheckQ, [shaString, deviceName]).then(([res]) => {
				console.log('\n')
				console.log(SHA2['SHA-256'](sData).toString('hex'))
				console.log('\n')
				return res
			})
			if (check.length > 0) {
				console.log(pData)
				console.log('DUPLICATE: Package already exists!')
				return false
			}
			/**
			 * Insert data into DeviceData table
			 */
			let lastId = null
			await mysqlConn.query(insDeviceDataQuery, [sData, dateFormatter(pData.time), sData, customerID, deviceName, regName]).then(([res]) => {
				lastId = res.insertId;
			})
			/**
			 * Device Data Clean Table insertion and CloudFunctions process
			 */
			if (lastId) {
				if (device.cloudfunctions.length >= 1) {
					let normalized = null
					normalized = await engineAPI.post(
						'/',
						{ nIds: device.cloudfunctions.map(n => n.nId), data: { ...pData, ...device.metadata } })
						.then(rs => {
							console.log('EngineAPI Response:', rs.status, rs.data);
							return rs.ok ? rs.data : null
						})

					let sNormalized = JSON.stringify(normalized)
					await mysqlConn.query(insDataClean, [sNormalized, dateFormatter(pData.time), lastId, customerID, deviceName, regName]).then(() => { }).catch(e => {
						console.log(e)
					})
				}
				else {
					await mysqlConn.query(insDataClean, [sData, dateFormatter(pData.time), lastId, customerID, deviceName, regName]).then(() => { }).catch(e => {
						console.log(e)
					})
				}
			}
		}
	}

	async storeDataByRegistry(data, { regName, customerID }) {
		try {
			console.log('STORING DATA BY REGISTRY')
			console.log(regName, customerID)
			let pData = JSON.parse(data)
			console.log(pData)

			/**
			 * Get the registry
			 */
			let [registry] = await mysqlConn.query(getRegistry, [regName])
			if (registry[0]) {
				if (!Array.isArray(pData)) {
					await this.storeDeviceData(pData, registry, customerID, regName)
				}
				else {
					if (Array.isArray(pData)) {
						asyncForEach(pData, async (d) => {
							console.log(d)
							await this.storeDeviceData(d, registry, customerID, regName)
						})
					}
				}
			}

		}
		catch (e) {
			console.log(e.message)
		}
	}
	async storeDataByDevice(data, { deviceName, regName, customerID }) {
		try {
			console.log('STORING DATA')
			console.log(deviceName, regName, customerID)
			let pData = JSON.parse(data)
			let sData = JSON.stringify(pData)
			console.log(pData)

			let shaString = SHA2['SHA-256'](sData).toString('hex')

			let check = await mysqlConn.query(packageCheckQ, [shaString, deviceName]).then(([res]) => {
				console.log('\n')
				console.log(SHA2['SHA-256'](sData).toString('hex'))
				console.log('\n')
				return res
			})
			if (check.length > 0) {
				console.warn(pData)
				console.warn('DUPLICATE: Package already exists!')
				return false
			}
			let [device] = await mysqlConn.query(deviceQuery, [customerID, deviceName, regName])
			if (device.length > 0 && device[0].communication == 0) {
				console.warn('COMMUNICATION: Not allowed!')
				return false
			}
			let lastId = null
			await mysqlConn.query(insDeviceDataQuery, [sData, dateFormatter(pData.time), sData, customerID, deviceName, regName]).then(([res]) => {
				lastId = res.insertId;
			})
			if (device.length > 0) {
				if (device[0].communication)
					if (device[0].cloudfunctions)
						if (device[0].cloudfunctions.length >= 1) {
							let normalized = null
							normalized = await engineAPI.post('/',
								{ nIds: device[0].cloudfunctions.map(n => n.nId), data: { ...pData, ...device[0].metadata } })
								.then(rs => {
									console.log('EngineAPI Response:', rs.status, rs.data);
									return rs.ok ? rs.data : null
								})
							console.log(normalized.time, moment.unix(pData.time).isValid())

							// console.log(mysqlConn.format(normalizedQ))
							let sNormalized = JSON.stringify(normalized)
							await mysqlConn.query(insDataClean, [sNormalized, dateFormatter(pData.time), lastId, customerID, deviceName, regName]).then(() => {
								console.log('INSERTED CLEAN DATA', sNormalized)

							}).catch(e => {
								console.log(e)
							})
						}
						else {
							await mysqlConn.query(insDataClean, [sData, dateFormatter(pData.time), lastId, customerID, deviceName, regName]).then(() => {
								console.log('INSERTED CLEAN DATA', sData)
							}).catch(e => {
								console.log(e)
							})
						}
				return true
			}
			else {
				return false
			}
		}
		catch (e) {
			console.log("ERROR:", e.message)
			return false
		}
	}

}

module.exports = StoreMqttHandler