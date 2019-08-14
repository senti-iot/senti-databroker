const express = require('express')
const router = express.Router()
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')
const tokenAPI = require('../engine/token')

const selectCleanData = `SELECT data
		FROM Device_data_clean
		WHERE device_id=? AND data NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`

let selectCleanDataIdDevice = `SELECT id, data, created, device_id
		FROM Device_data_clean
		WHERE device_id=? AND data NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`

const selectAllDevicesUnderReg = `SELECT d.*, data from Device d
		INNER JOIN Device_data_clean dd on dd.device_id = d.id
		WHERE d.reg_id=?
		AND data NOT LIKE '%null%'
		AND created >= ? AND created <= ? ORDER BY created`

const selectLatestAllDevicesUnderReg = `SELECT d.uuid, d.name, MAX(dd.created) as 'time', dd.data
		FROM Device d
			INNER JOIN Device_data_clean dd on dd.device_id = d.id
		WHERE d.reg_id=?
		GROUP BY dd.device_id`

const selectRegistryIDQ = `SELECT id from Registry where uuid=?`
const selectDeviceIDQ = `SELECT id from Device where uuid=?`

router.get('/:token/registry/:regID/:from/:to/', async (req, res, next) => {
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
	let isValid = await tokenAPI.get(`validateToken/${token}/registry/${regID}`).then(rs => rs.data)
	console.log(isValid)
	if (isValid) {
		let devices = await mysqlConn.query(selectAllDevicesUnderReg, [regID, from, to]).then(rs => rs[0])
		res.json(devices).status(200)
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

router.get('/:token/registry/:regID/latest', async (req, res, next) => {
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
	let isValid = await tokenAPI.get(`validateToken/${token}/registry/${regID}`).then(rs => rs.data)
	console.log(isValid)
	
	if (isValid) {
		let devices = await mysqlConn.query(selectLatestAllDevicesUnderReg, [regID]).then(rs => rs[0])
		res.json(devices).status(200)
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

router.get('/:token/devicedata/:deviceID/:from/:to/', async (req, res, next) => {
	let token = req.params.token
	let deviceID = req.params.deviceID
	let to = req.params.to
	let from = req.params.from

	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/device/${deviceID}`).then(rs => rs.data)

	if (isValid) {

		await mysqlConn.query(selectCleanData, [deviceID, from, to]).then(async rs => {
			let rawData = rs[0]
			res.status(200).json(rawData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(selectCleanData, [deviceID, from, to]) }) }
		})
	}
	else {
		res.status(500).json({ error: "Invalid Token" })
	}
})

router.get('/:token/devicedata/:deviceID/:from/:to/:dataKey/:cfId?', async (req, res, next) => {
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