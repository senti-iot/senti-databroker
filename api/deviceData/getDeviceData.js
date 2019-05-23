const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')

router.get('/:version/devicedata-clean/:deviceID/:from/:to/:type/:nId', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.deviceID
	let from = req.params.from
	let to = req.params.to
	let type = req.params.type
	let nId = req.params.nId
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT id, \`data\`, created, device_id
			FROM Device_data_clean	
			WHERE device_id=? AND \`data\` NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`
			await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
				let rawData = rs[0]
				let cleanData = {}
				rawData.forEach(r => {
					cleanData[moment(r.created).format('YYYY-MM-DD HH:mm')] = r.data[type]
				})
				if(nId>0) {
					let cData = await engineAPI.post('/', {nId: nId, data: cleanData}).then(rs => { console.log('EngineAPI Response:', rs.status); return rs.ok ? rs.data : null })
					return res.status(200).json(cData)
				}
				res.status(200).json(cleanData)
			}).catch(err => {
				if (err) { res.status(500).json({ err, query }) }
			})
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})

router.get('/:version/devicedata/:deviceID', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.deviceID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT id, \`data\`, topic, created, device_id
			FROM Device_data			
			WHERE device_id=${deviceID}`
			await mysqlConn.query(query).then(rs => {
				res.status(200).json(rs[0])
			}).catch(err => {
				if (err) { res.status(500).json(err) }
			})
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})
// router.get('/', async (req,res, netxt)=> {
// 	res.json('API/MessageBroker GET Success!')
// })
module.exports = router
