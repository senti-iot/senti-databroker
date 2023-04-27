/** Express router providing user related routes
 * @module routers/devices
 * @requires express
 * @requires senti-apicore
 */

/**
 * express module
 * @const
 */
const express = require('express')
/**
 * express router
 * @const
 */
const router = express.Router()

/**
 * MySQL connector
 * @const
 */
var mysqlConn = require('../../../mysql/mysql_handler')
const engineAPI = require('../../engine/engine')
const createAPI = require('apisauce').create
const moment = require('moment')
const SHA2 = require('sha2')
const uuidv4 = require('uuid/v4')

/**
 * ACL Privileges
 * @const sentiAclPriviledge
 */
/**
 * ACL Resource Types
 * @const sentiAclResourceType
 */
/**
 * ACL Client
 * @const aclClient
 */
/**
 * Auth Client
 * @const authClient
 */
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)


const format = 'YYYY-MM-DD HH:mm:ss'
const dateFormatter = (date, defaultDate) => {
	if(date === undefined) {
		return defaultDate
	}
	if (moment.unix(date).isValid()) {
		return moment.unix(date).format(format)
	}
	if (moment(date).isValid()) {
		return moment(date).format(format)
	}
	return defaultDate
}
const getDeviceType = async (deviceTypeId) => {
	let selectDeviceType = `SELECT * from deviceType where id=?`
	let [deviceType] = await mysqlConn.query(selectDeviceType, [deviceTypeId])
	return deviceType[0]
}

const updateDeviceGPS = async (device, deviceType, data) => {
	if (deviceType.metadata.sentiUpdateGPS === 'YES' && device.metadata.sentiUpdateGPS !== 'NO' && data[0].lat !== undefined && data[0].lat !== null && data[0].lon !== undefined && data[0].lon !== null) {
		try {
			let a = null
			const api = createAPI({
				baseURL: 'https://api.dataforsyningen.dk',
			})
			let rs = await api.get('/adgangsadresser/reverse', {
				x: data.message.lon,
				y: data.message.lat,
				struktur: 'mini'
			})
			if (rs.ok) {
				a = rs.data.betegnelse
			}
			mysqlConn.query(`UPDATE device SET lat = ?, lng = ?, address = ?  WHERE id=?`, [data[0].lat, data[0].lon, device.id, a])
		}
		catch (e) {
			console.log(e.message, device, deviceType, data)
		}
	}
}

/**
 * Route rescanning device data on UUID provided
 * @function GET /v2/device/:uuid
 * @memberof module:routers/devices
 * @param {String} req.params.uuid UUID of the Requested Device
 */
router.get('/v2/rescandevicedata/:uuid/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let device = await deviceService.getDeviceByUUID(req.params.uuid)
	if (device === false) {
		res.status(404).json()
		return
	}
	console.log(device)
	let deleteDataClean = `DELETE ddc 
				FROM deviceData dd
					INNER JOIN deviceDataClean ddc ON ddc.device_data_id = dd.id
				WHERE dd.device_id = ?
					AND dd.created >= ?
					AND dd.created < ?`
	await mysqlConn.query(deleteDataClean, [device.id, req.params.from, req.params.to])
	
	let select = `SELECT dd.created, dd.data, dd.id 
				FROM deviceData dd
				WHERE dd.device_id = ?
					AND dd.created >= ?
					AND dd.created < ?`
	let rs = await mysqlConn.query(select, [device.id, req.params.from, req.params.to])
	if (rs[0].length === 0) {
		res.status(404).json()
		return
	}
	
	let deviceType = await getDeviceType(device.type_id)
	console.log(deviceType)
	await Promise.all(rs[0].map(async (dd) => {
		let lastId = dd.id
		let pData = dd.data
		/**
		 * Device Data Clean Table insertion and CloudFunctions process
		 */
		if (deviceType.decoder !== null) {
			let decodedData = await engineAPI.post('/', { nIds: [deviceType.decoder], data: { ...pData, ...device.metadata } })
			pData = decodedData.data
		}
		if (!Array.isArray(pData)) {
			pData = [pData]
		}
		updateDeviceGPS(device, deviceType, pData)

		let insertClean = `INSERT INTO deviceDataClean(data, created, device_id, device_data_id) VALUES(?, ?, ?, ?)`

		await Promise.all(pData.map(async (d) => {
			let cleanData = d
			let normalized = null
			let dataTime = dateFormatter(cleanData.time, dd.created)

			if (deviceType.inbound.length >= 1) {
				normalized = await engineAPI.post('/', { nIds: deviceType.inbound.map(n => n.nId), data: { ...cleanData, ...device.metadata } }).then(rs => {
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
		}))
	}))
	res.status(200).json(device)
})


module.exports = router
