// var SecureMqttHandler = require('./SecureMqttHandler')
const SecureMqttHandler = require(`senti-apicore`).secureMqttHandler
var mysqlConn = require('../mysql/mysql_handler')
const engineAPI = require('../api/engine/engine')
const asyncForEach = require('../utils/asyncForEach')
// const logService = require('../server').logService
const moment = require('moment')
const SHA2 = require('sha2')
const uuidv4 = require('uuid/v4')

const { /* sentiAclPriviledge, */ sentiAclResourceType } = require('senti-apicore')
const { aclClient, /* authClient */ } = require('../server')

const format = 'YYYY-MM-DD HH:mm:ss'
const dateFormatter = (date) => {
	if (moment.unix(date).isValid()) {
		if (date.toString().length > 11) {
			date = date / 1000
		}
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
			lat, devicelng, address,
			locType,			communication, uuid, created, modified)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`

const createMetaDataQuery = `INSERT INTO deviceMetadata
			(device_id, data, inbound, outbound)
			VALUES(?, ?, ?, ?);`

const selectDeviceType = `SELECT * from deviceType where id=?`
const updateDeviceGPS = `UPDATE device SET lat = ?, lng = ? WHERE id=?`

// function cleanUpSpecialChars(str) {
// 	return str.toString()
// 		.replace(/[øØ]/g, "ou")
// 		.replace(/[æÆ]/g, "ae")
// 		.replace(/[åÅ]/g, "aa")
// 		.replace(/[^a-z0-9]/gi, '-'); // final clean up
//}

class SecureStoreMqttHandler extends SecureMqttHandler {
	init() {
		this.topics = ['v1/+/location/+/registries/+/devices/+/publish', 'v1/+/location/+/registries/+/publish', 'v1/ttn-application', 'v1/ttn-application-v3', 'v1/comadan-application', 'v1/sigfox-application', 'v2/#']
		this.mqttClient.on('message', (topic, message) => {
			let arr = topic.split('/')
			// console.log('mqttarr', arr, message.toString())
			switch (arr[0]) {
				default:
				case 'v1':
					if (arr.length === 9 && arr.indexOf('devices' > -1)) {
						this.storeDataByDevice(message.toString(), { deviceName: arr[7], regName: arr[5], customerID: arr[1] })
					}
					if (arr.length === 7) {
						// console.log(arr)
						this.storeDataByRegistry(message.toString(), { regName: arr[5], customerID: arr[1] })
					}
					if (arr[1] === 'ttn-application') {
						this.ttnApplicationHandler(message)
					}
					if (arr[1] === 'ttn-application-v3') {
						this.ttnV3ApplicationHandler(message)
					}
					if (arr[1] === 'comadan-application') {
						this.comadanApplicationHandler(message)
					}
					if (arr[1] === 'sigfox-application') {
						this.sigfoxApplicationHandler(message)
					}
					break
				case 'v2':
					this.getV2Handler(arr, message.toString())
					break

			}
		})
	}

	getV2Handler(topic, message) {
		switch (topic[1]) {
			default:
				break
			case 'ttn-application':
				this.ttnApplicationHandler(message)
				break
			case 'prefix-uuname':
				this.prefixUunameHandler(topic[2], message)
				break
			case 'prefix-handler':
				this.prefixHandler(topic[2], topic[3], message)
				break
	
		}
	}

	async ttnApplicationHandler(message) {
		let data = JSON.parse(message)
		let deviceUuname = data.app_id + '-' + data.dev_id
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			let config = await this.getDeviceDataHandlerConfigByUuname(data.app_id)
			// console.log(config)
			if (config !== false && config.handlerType === 'ttn-application') {
				// console.log(config.data)
				data.sentiTtnDeviceId = deviceUuname
				this.storeDataByRegistry(JSON.stringify(data), { regName: config.data.reguuname, customerID: config.data.orguuname })
			}
		}
	}
	async ttnV3ApplicationHandler(message) {
		let data = JSON.parse(message)
		let applicationId = data.end_device_ids.application_ids.application_id
		let deviceUuname = applicationId + '-' + data.end_device_ids.device_id
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			let config = await this.getDeviceDataHandlerConfigByUuname(applicationId)
			// console.log(config)
			if (config !== false && config.handlerType === 'ttn-application-v3') {
				// console.log(config.data)
				data.sentiTtnDeviceId = deviceUuname
				this.storeDataByRegistry(JSON.stringify(data), { regName: config.data.reguuname, customerID: config.data.orguuname })
			}
		}
	}
	async comadanApplicationHandler(message) {
		let data = JSON.parse(message)
		let deviceUuname = data.ID
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			let config = await this.getDeviceDataHandlerConfigByUuname('COMA-' + data.TYPE)
			// console.log(config)
			if (config !== false && config.handlerType === 'comadan-application') {
				// console.log(config.data)
				data.sentiTtnDeviceId = deviceUuname
				this.storeDataByRegistry(JSON.stringify(data), { regName: config.data.reguuname, customerID: config.data.orguuname })
				// Lav selv device med
				// await this.createDevice({ name: deviceName, communication: 1, ...pData }, registry[0].id, deviceTypeId)
				// device = await this.getDevice(customerID, deviceName, regName)
				// // ADD DEVICE TO ACL
				// await aclClient.registdeviceerResource(device.uuid, sentiAclResourceType.device)
				// await aclClient.addResourceTParent(device.uuid, device.reguuid)
	

			}
		}
	}
	async sigfoxApplicationHandler(message) {
		let data = JSON.parse(message)
		let deviceUuname = data.deviceHandler + '-' + data.device_id
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			let config = await this.getDeviceDataHandlerConfigByUuname(data.deviceHandler)
			// console.log(data, config)
			if (config !== false && config.handlerType === 'sigfox-application') {
				// console.log(config.data)
				data.sentiDeviceId = deviceUuname
				this.storeDataByRegistry(JSON.stringify(data), { regName: config.data.reguuname, customerID: config.data.orguuname })
			}
		}
	}
	async prefixHandler(configUuname, deviceUuname, message) {
		console.log('prefixHandler', configUuname, deviceUuname, message)
		let data = JSON.parse(message)
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			let config = await this.getDeviceDataHandlerConfigByUuname(configUuname)
			console.log(data, config)
			if (config !== false && config.handlerType === 'prefix-handler') {
				console.log(config.data)
				data.sentiDeviceId = deviceUuname
				// Lav selv device med
				await this.createDevice({ name: deviceUuname, communication: 1, ...data }, config.data.regId, config.data.deviceTypeId)
				device = await this.getDevice(customerID, deviceName, regName)
				// // ADD DEVICE TO ACL
				console.log(device)
				await aclClient.registerResource(device.uuid, sentiAclResourceType.device)
				await aclClient.addResourceToParent(device.uuid, device.reguuid)
				this.storeDataByDevice(JSON.stringify(data), { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
			}
		}
	}
	async prefixUunameHandler(deviceUuname, message) {
		let data = JSON.parse(message)
		let device = await this.getDeviceByUuname(deviceUuname)
		if (device !== false) {
			this.storeDataByDevice(message, { deviceName: deviceUuname, regName: device.reguuname, customerID: device.orguuname })
		} else {
			console.log('prefixUunameHandler device not found: ', deviceUuname, data)
		}
	}
	async getDeviceDataHandlerConfigByUuname(uuname) {
		let uunameSql = `SELECT d.id, d.uuid, d.uuname, d.handlerType, d.data
							FROM deviceDataHandlerConfig d
							WHERE d.uuname=? AND d.deleted = 0;`
		// console.log(await mysqlConn.format(uunameSql, [uuname]))
		let rs = await mysqlConn.query(uunameSql, [uuname])
		if (rs[0].length === 1) {
			return rs[0][0]
		}
		return false
	}
	async createDevice(data, regId, deviceTypeId) {
		let uuname = data.uuname ? data.uuname : data.name
		let arr = [uuname, data.name, deviceTypeId, regId, '', data.lat, data.lng, data.address, data.locType, data.communication, uuidv4()]
		return await devicemysqlConn.query(createDeviceQuery, arr).then(async rs => {
			// console.log(Device Created', rs[0].insertId)
			// console.log(data, regId, deviceTypeId)
			let [deviceType] = await mysqlConn.qdeviceuery(selectDeviceType, [deviceTypeId])
			// console.log(deviceType[0])			let mtd = deviceType[0]
			let mtdArr = [rs[0].insertId, JSON.stringify(mtd.metadata), JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
			await mysqlConn.query(createMetaDataQuery, mtdArr).then(() => {
				// console.log('Device Metadata Created', r[0].insertId)
			}).catch(err => {
				console.log("error: ", err, data, regId, deviceTypeId)
			})
			return rs[0].insertId
		}).catch(async err => {
			// if (err) {
			console.log("error: ", err, data, regId, deviceTypeId)
		})
	}
	async getDevice(customerID, deviceName, regName) {
		// console.log(await mysqlConn.format(deviceQuery, [customerID, deviceName, regName]))
		let [device] = await mysqlConn.query(deviceQuery, [customerID, deviceName, regName])
		return device[0]
	}
	async getDeviceByUuname(uuname) {
		let uunameSql = `SELECT d.id, d.uuid, d.name, d.type_id, d.reg_id, r.uuid as reguuid, d.metadata, d.communication, o.uuname as orguuname, r.uuname as reguuname
							FROM device d
								INNER JOIN registry r ON r.id = d.reg_id
								INNER JOIN organisation o on o.id = r.orgId
							WHERE d.uuname=? AND d.deleted = 0;`
		// console.log(await mysqlConn.format(uunameSql, [uuname]))
		let rs = await mysqlConn.query(uunameSql, [uuname])
		if (rs[0].length === 1) {
			return rs[0][0]
		}
		return false
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
			this.updateDeviceGPS(device, deviceType, pData)

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
				let dataInsertRs = await mysqlConn.query(insertClean, [sCleanData, dataTime, device.id, lastId]).then((rs) => {
					return rs
				}).catch(e => {
					console.log(e)
				})
				// SEND MESSAGE TO EVENT BROKER device.type_id, device.reg_id, device.id
				if (process.env.NODE_ENV === 'production' && cleanData.sentiNoEvent !== true) {
					// V2 event
					let eventMessage = {
						message: cleanData,
						device: device,
						deviceType: deviceType,
						messageMeta: {
							cleanId: dataInsertRs[0].insertId,
							cleanTime: dataTime
						}
					}
					this.sendMessage(`v2/event/data/${deviceType.uuid}/${device.reguuid}/${device.uuid}`, JSON.stringify(eventMessage))
					// V1 Event
					cleanData.sentiEventDeviceName = device.name
					cleanData.sentiEventDevice = device
					cleanData.sentiEventDeviceDataCleanId = dataInsertRs[0].insertId
					cleanData.sentiEventDeviceDataCleanTime = dataTime
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
		// console.log(deviceName)
		/**
		 *  Check if the device exists
		 * */
		let device = await this.getDevice(customerID, deviceName, regName)
		/**
		 * If the device doesn't exist create it
		 */
		if (!device) {
			let deviceTypeId = registry[0].config.deviceTypeId
			// console.log(`DEVICE ${deviceName} DOES NOT EXIST`)
			await this.createDevice({ name: deviceName, communication: 1, ...pData }, registry[0].id, deviceTypeId)
			device = await this.getDevice(customerID, deviceName, regName)
			// ADD DEVICE TO ACL
			await aclClient.registdeviceerResource(device.uuid, sentiAclResourceType.device)
			await aclClient.addResourceTParent(device.uuid, device.reguuid)
			// console.log(device)
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
				// console.log(pData)
				// console.log('DUPLICATE: Package already exists!')
				return false
			}
			await this.storeData(pData, device)
		}
	}

	async storeDataByRegistry(data, { regName, customerID }) {
		try {
			// console.log('STORING DATA BY REGISTRY')
			// console.log(regName, customerID)
			let pData = JSON.parse(data)
			// console.log(pData)

			/**
			 * Get the registry
			 */
			let [registry] = await mysqlConn.query(getRegistry, [regName])
			if (registry[0]) {
				// console.log('STORING DATA BY REGISTRY', registry)
				let deviceName = pData[registry[0].config.deviceId]
				// console.log(customerID, regName, deviceName)
				if (deviceName === undefined) {
					console.log(customerID, regName)
					console.log(pData)
				}
				if (!Array.isArray(pData)) {
					await this.storeDeviceData(pData, registry, customerID, regName)
				}
				else {
					if (Array.isArray(pData)) {
						asyncForEach(pData, async (d) => {
							// console.log(d)
							await this.storeDeviceData(d, registry, customerID, regName)
						})
					}
				}
			}
		}
		catch (e) {
			console.log('storeDataByRegistry', e.message, JSON.parse(data), regName, customerID)
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
				// console.warn(pData)
				// console.warn('DUPLICATE: Package already exists!')
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
			// console.log('STORING DATA BY DEVICE')
			// console.log(customerID, regName, deviceName)
			// console.log(device)
			if (device) {
				await this.storeData(pData, device)
			}
		}
		catch (e) {
			console.log('storeDataByDevice', e.message, JSON.parse(data), deviceName, regName, customerID)
		}
	}
	/**
	 * Find metadata Key
	 * @Mikkel
	 */
	// fmk(key, arr) {
	// 	let obj = false
	// 	let index = arr.findIndex(i => i.key === key)
	// 	if (index > -1) {

	// 		obj = {
	// 			key: arr[index].key,
	// 			value: arr[index].value
	// 		}
	// 	}
	// 	return obj
	// }
	updateDeviceGPS(device, deviceType, data) {

		/**
		 * @Mikkel
		 */
		// let updDTGPS = this.fmk('sentiUpdateGPS', deviceType.metadata)
		// let updDGPS = this.fmk('sentiUpdateGPS', device.metadata)

		// if (updDTGPS.value === 'YES' && updDGPS.value !== 'NO' && data[0].lat !== undefined && data[0].lat !== null && data[0].lon !== undefined && data[0].lon !== null) {
		// 	try {
		// 		mysqlConn.query(updateDeviceGPS, [data[0].lat, data[0].lon, device.id])
		// 	}
		// 	catch (e) {
		// 		console.log(e.message, device, deviceType, data)
		// 	}
		// }



		if (deviceType.metadata.sentiUpdateGPS === 'YES' && device.metadata.sentiUpdateGPS !== 'NO' && data[0].lat !== undefined && data[0].lat !== null && data[0].lon !== undefined && data[0].lon !== null) {
			try {
				mysqlConn.query(updateDeviceGPS, [data[0].lat, data[0].lon, device.id])
			}
			catch (e) {
				console.log(e.message, device, deviceType, data)
			}
		}
	}
}

module.exports = SecureStoreMqttHandler