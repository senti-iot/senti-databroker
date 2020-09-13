const express = require('express')
const router = express.Router()
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')
const tokenAPI = require('../engine/token')
const log = require('../../server').log

const selectLatestCleanData = `SELECT data
		FROM deviceDataClean
		WHERE deviceHash=? AND data NOT LIKE '%null%' ORDER BY created DESC LIMIT 1`

const selectCleanData = `SELECT data
		FROM deviceDataClean
		WHERE deviceHash=? AND data NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`

let selectCleanDataIdDevice = `SELECT id, data, created, deviceHash
		FROM deviceDataClean
		WHERE deviceHash=? AND data NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`

const selectAllDevicesUnderReg = `SELECT d.*, data from Device d
		INNER JOIN deviceDataClean dd on dd.device_id = d.id
		WHERE d.reg_id=?
		AND data NOT LIKE '%null%'
		AND created >= ? AND created <= ? ORDER BY created`

const selectLatestAllDevicesUnderReg = `SELECT tt.uuid, tt.name, dd.created, dd.data
FROM (
	SELECT max(dd.id) as did, t.uuid, t.name
	FROM (
		SELECT max(dd.created) as 'time', dd.deviceHash, d.uuid, d.name
		FROM Device d
		INNER JOIN deviceDataClean dd on dd.deviceHash = d.id  AND dd.data NOT LIKE '%null%'
		WHERE d.reg_id=16
		group by dd.deviceHash
	) t
	INNER JOIN deviceDataClean dd ON t.time=dd.created AND t.deviceHash=dd.deviceHash
	group by dd.deviceHash
) tt
LEFT JOIN deviceDataClean dd ON tt.did=dd.id`

const selectRegistryIDQ = `SELECT id from registry where uuid=?`
const selectDeviceIDQ = `SELECT id from device where uuid=?`
/**
 * Get all the devices & their data under the regID and between from / to period
 */
router.get('/:token/registry/:regID/:from/:to/', async (req, res) => {
	let token = req.params.token
	let rID = req.params.regID
	let to = req.params.to
	let from = req.params.from
	console.log(token, rID, to, from)
	let regID = await mysqlConn.query(selectRegistryIDQ, [rID]).then(rs => {
		console.log(rs)
		if (rs[0][0])
			return rs[0][0].id
		else
			return null
	})
	console.log(regID)
	let isValid = await tokenAPI.get(`validateToken/${token}/0/${rID}`).then(rs => rs.data)
	console.log(isValid)
	if (isValid) {
		// log({
		// 	msg: " Latest Datarequested externally for Registry",
		// 	regId: rID,
		// 	internalId: regID
		// }, 'info')
		let devices = await mysqlConn.query(selectAllDevicesUnderReg, [regID, from, to]).then(rs => rs[0])
		res.json(devices).status(200)
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})
/**
 * Get the last set of data for Registry
 */
router.get('/:token/registry/:regID/latest', async (req, res) => {
	let token = req.params.token
	let rID = req.params.regID
	console.log(token, rID)
	let regID = await mysqlConn.query(selectRegistryIDQ, [rID]).then(rs => {
		console.log(rs)
		if (rs[0][0])
			return rs[0][0].id
		else
			return null
	})
	console.log(regID)
	let isValid = await tokenAPI.get(`validateToken/${token}/0/${regID}`).then(rs => rs.data)
	console.log(isValid)

	if (isValid) {
		log({
			msg: "Latest Data requested externally for Registries' device",
			regId: rID
		}, 'info')
		let devices = await mysqlConn.query(selectLatestAllDevicesUnderReg, [regID]).then(rs => rs[0])

		res.json(devices).status(200)
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

/**
 * Get the last data set for a device
 */
router.get('/:token/devicedata/:deviceID/latest', async (req, res) => {
	let token = req.params.token
	let deviceID = req.params.deviceID

	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/1/${deviceID}`).then(rs => rs.data)

	if (isValid) {

		await mysqlConn.query(selectLatestCleanData, [deviceID]).then(async rs => {
			let rawData = rs[0]
			log({
				msg: "Latest Data requested externally for Device",
				deviceId: deviceID
			}, 'info')
			res.status(200).json(rawData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(selectLatestCleanData, [deviceID]) }) }
		})
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

router.get('/:token/devicedata/:deviceID/:from/:to/', async (req, res) => {
	let token = req.params.token
	let deviceID = req.params.deviceID
	let to = req.params.to
	let from = req.params.from

	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/1/${deviceID}`).then(rs => rs.data)

	if (isValid) {

		await mysqlConn.query(selectCleanData, [deviceID, from, to]).then(async rs => {
			let rawData = rs[0]
			log({
				msg: "Data requested externally for Device",
				deviceId: deviceID
			}, 'info')
			res.status(200).json(rawData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(selectCleanData, [deviceID, from, to]) }) }
		})
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

router.get('/:token/devicedata/:deviceID/:from/:to/:dataKey/:cfId?', async (req, res) => {
	let token = req.params.token
	let deviceID = req.params.deviceID
	let to = req.params.to
	let from = req.params.from
	let cfId = req.params.cfId
	let dataKey = req.params.dataKey

	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/${deviceID}`).then(rs => rs.data)

	if (isValid) {

		await mysqlConn.query(selectCleanDataIdDevice, [deviceID, from, to]).then(async rs => {
			let rawData = rs[0]
			let cleanData = {}
			// console.log('HERE', rawData)
			rawData.forEach(r => {
				console.log('bing', r.data, dataKey)
				if (r.data[dataKey])
					cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[dataKey]
				console.log(cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')])
			})
			console.log(rawData)
			console.log(cleanData)
			if (cfId > 0) {
				let cData = await engineAPI.post('/', { nIds: [cfId], data: cleanData }).then(rss => {
					console.log('EngineAPI Status:', rss.status);
					console.log('EngineAPI Response', rss.data)
					return rss.ok ? rss.data : null
				})
				return res.status(200).json(cData)
			}
			log({
				msg: "Data requested externally for Device",
				deviceId: deviceID
			}, 'info')
			res.status(200).json(cleanData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(selectCleanDataIdDevice, [deviceID, from, to]) }) }
		})
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

module.exports = router