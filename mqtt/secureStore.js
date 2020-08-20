var SecureMqttHandler = require('./SecureMqttHandler')
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
const asyncForEach = require('../utils/asyncForEach')
// const logService = require('../server').logService
const moment = require('moment')
const SHA2 = require('sha2')
const uuidv4 = require('uuid/v4')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../server')

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
const deviceQuery = `SELECT d.id, d.uuid, d.name, d.type_id, d.reg_id, r.uuid as reguuid, d.metadata, d.communication 
FROM device d
	INNER JOIN registry r ON r.id = d.reg_id
	INNER JOIN organisation o on o.id = r.orgId
WHERE o.uuname=?
	AND d.uuname=?
	AND r.uuname=? 
	AND d.deleted = 0;`
// const insDeviceDataQuery = `INSERT INTO deviceData
// 			(data, created, device_id, signature)
// 			SELECT ?, ?, device.id as device_id, SHA2(?,256) from registry
// 			INNER JOIN device ON registry.id = device.reg_id
// 			INNER JOIN customer ON customer.id = registry.customer_id
// 			where customer.uuname=? AND device.uuname=? AND registry.uuname=?
// 			`
const packageCheckQ = `SELECT signature from deviceData dd
			INNER JOIN device d on d.id = dd.device_id
			WHERE dd.signature=? and d.uuname=?
			`
// const insDataClean = `INSERT INTO deviceDataClean
// 			(data, created, device_id, device_data_id)
// 			SELECT ?, ?, device.id as device_id, ? from registry
// 			INNER JOIN device ON registry.id = device.reg_id
// 			INNER JOIN customer ON customer.id = registry.customer_id
// 			where customer.uuname=? AND device.uuname=? AND registry.uuname=?`
const getRegistry = `SELECT * from registry r
			WHERE r.uuname=?`
const createDeviceQuery = `INSERT INTO device
			(uuname, name, type_id, reg_id,
			description,
			lat, lng, address,
			locType,
			communication, uuid)
			VALUES (?,?,?,?,?,?,?,?,?,?,?)`

const createMetaDataQuery = `INSERT INTO deviceMetadata
			(device_id, data, inbound, outbound)
			VALUES(?, ?, ?, ?);`

const selectDeviceType = `SELECT * from deviceType where id=?`

// function cleanUpSpecialChars(str) {
// 	return str.toString()
// 		.replace(/[øØ]/g, "ou")
// 		.replace(/[æÆ]/g, "ae")
// 		.replace(/[åÅ]/g, "aa")
// 		.replace(/[^a-z0-9]/gi, '-'); // final clean up
//}

class SecureStoreMqttHandler extends SecureMqttHandler {
	init() {
		this.topics = ['v1/+/location/+/registries/+/devices/+/publish', 'v1/+/location/+/registries/+/publish']
		// this.topics = ['v2/test']
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			if (arr.length === 9 && arr.indexOf('devices' > -1)) {
				this.storeDataByDevice(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
			}
			if (arr.length === 7) {
				this.storeDataByRegistry(message.toString(), { regName: arr[5], customerID: arr[1] })
			}
		})
	}
	async createDevice(data, regId, deviceTypeId) {
		let uuname = data.uuname ? data.uuname : data.name
		let arr = [uuname, data.name, deviceTypeId, regId, '', data.lat, data.lng, data.address, data.locType, data.communication, uuidv4()]
		return await mysqlConn.query(createDeviceQuery, arr).then(async rs => {
			console.log('Device Created', rs[0].insertId)
			console.log(data, regId, deviceTypeId)
			let [deviceType] = await mysqlConn.query(selectDeviceType, [deviceTypeId])
			console.log(deviceType[0])
			let mtd = deviceType[0]
			let mtdArr = [rs[0].insertId, JSON.stringify(mtd.metadata), JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
			await mysqlConn.query(createMetaDataQuery, mtdArr).then(r => {
				console.log('Device Metadata Created', r[0].insertId)
			}).catch(err => {
				console.log("error: ", err)
			})
			return rs[0].insertId
		}).catch(async err => {
			// if (err) {
			console.log("error: ", err)
		})
	}
	async getDevice(customerID, deviceName, regName) {
		// console.log(await mysqlConn.format(deviceQuery, [customerID, deviceName, regName]))
		let [device] = await mysqlConn.query(deviceQuery, [customerID, deviceName, regName])
		return device[0]
	}
	async getDeviceType(deviceTypeId) {
		let [deviceType] = await mysqlConn.query(selectDeviceType, [deviceTypeId])
		return deviceType[0]
	}

	async storeData(pData, device) {
		let sData = JSON.stringify(pData)
		/**
		 * Insert data into DeviceData table
		 */
		let lastId = null
		let insert = `INSERT INTO deviceData(data, created, device_id, signature) VALUES(?, ?, ?, SHA2(?, 256))`
		await mysqlConn.query(insert, [sData, dateFormatter(pData.time), device.id, sData]).then(([res]) => {
			lastId = res.insertId
		})
		/**
		 * Device Data Clean Table insertion and CloudFunctions process
		 */
		if (lastId) {
			let deviceType = await this.getDeviceType(device.type_id)
			if (deviceType.decoder !== null) {
				let decodedData = await engineAPI.post('/', { nIds: [deviceType.decoder], data: { ...pData, ...device.metadata } })
				pData = decodedData.data
			}
			if (!Array.isArray(pData)) {
				pData = [pData]
			}
			let insertClean = `INSERT INTO deviceDataClean(data, created, device_id, device_data_id) VALUES(?, ?, ?, ?)`

			await Promise.all(pData.map(async (d) => {
				let cleanData = d
				let normalized = null
				let dataTime = dateFormatter(cleanData.time)

				if (deviceType.inbound.length >= 1) {
					normalized = await engineAPI.post('/', { nIds: deviceType.inbound.map(n => n.nId), data: { ...cleanData, ...device.metadata } }).then(rs => {
						// console.log('EngineAPI Response:', rs.status, rs.data)
						return rs.ok ? rs.data : null
					})
				}
				if (normalized !== null) {
					dataTime = normalized.time ? dateFormatter(normalized.time) : dataTime
					cleanData = normalized
				}
				let sCleanData = JSON.stringify(cleanData)
				await mysqlConn.query(insertClean, [sCleanData, dataTime, device.id, lastId]).then(() => { }).catch(e => {
					console.log(e)
				})
				// SEND MESSAGE TO EVENT BROKER device.type_id, device.reg_id, device.id
				if (process.env.NODE_ENV === 'production') {
					cleanData.sentiEventDeviceName = device.name
					this.sendMessage(`v1/event/data/${device.type_id}/${device.reg_id}/${device.id}`, JSON.stringify(cleanData))
				}
			}))
		}
	}

	async storeDeviceData(pData, registry, customerID, regName) {
		/**
		 * Get the key name
		 */
		let deviceName = pData[registry[0].config.deviceId]
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
			// ADD DEVICE TO ACL
			await aclClient.registerResource(device.uuid, sentiAclResourceType.device)
			await aclClient.addResourceToParent(device.uuid, device.reguuid)
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
			let sData = JSON.stringify(pData)

			/**
			 * Check if the package isn't a duplicate
			 */

			let shaString = SHA2['SHA-256'](sData).toString('hex')

			let check = await mysqlConn.query(packageCheckQ, [shaString, deviceName]).then(([res]) => {
				// console.log('\n')
				// console.log(SHA2['SHA-256'](sData).toString('hex'))
				// console.log('\n')
				return res
			})
			if (check.length > 0) {
				console.log(pData)
				console.log('DUPLICATE: Package already exists!')
				return false
			}

			await this.storeData(pData, device)
		}
	}

	async storeDataByRegistry(data, { regName, customerID }) {
		try {
			let pData = JSON.parse(data)
			/**
			 * Get the registry
			 */
			let [registry] = await mysqlConn.query(getRegistry, [regName])
			if (registry[0]) {
				console.log('STORING DATA BY REGISTRY')
				let deviceName = pData[registry[0].config.deviceId]
				console.log(customerID, regName, deviceName)
				if (deviceName === undefined) {
					console.log(pData)
				}
				if (!Array.isArray(pData)) {
					await this.storeDeviceData(pData, registry, customerID, regName)
				}
				else {
					if (Array.isArray(pData)) {
						asyncForEach(pData, async (d) => {
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
			let pData = JSON.parse(data)
			let sData = JSON.stringify(pData)

			let shaString = SHA2['SHA-256'](sData).toString('hex')
			let check = await mysqlConn.query(packageCheckQ, [shaString, deviceName]).then(([res]) => {
				return res
			})
			if (check.length > 0) {
				console.warn(pData)
				console.warn('DUPLICATE: Package already exists!')
				return false
			}
			/**
			 * Get the device
			 */
			let device = await this.getDevice(customerID, deviceName, regName)
			/**
			* Check if device accepts communication
			*/
			if (device && device.communication == 0) {
				console.warn('COMMUNICATION: Not allowed!')
				return false
			}
			console.log('STORING DATA BY DEVICE')
			console.log(customerID, regName, deviceName)
			if (device) {
				await this.storeData(pData, device)
			}
		}
		catch (e) {
			console.log(e.message)
		}
	}
}

module.exports = SecureStoreMqttHandler