const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')

router.get('/:version/messages/', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	// let customerID = req.params.customerID
	// let deviceID = req.params.deviceID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT dd.id, \`data\`, dd.created, device_id FROM Device_data dd ORDER BY created DESC`
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
router.get('/:version/messages/:cId', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.cId
	// let deviceID = req.params.deviceID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT dd.id, \`data\`, dd.created, device_id FROM Device_data dd
			LEFT JOIN Device d on d.id = dd.device_id
			LEFT JOIN Registry r on r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			where c.ODEUM_org_id=? ORDER BY dd.created DESC`
			await mysqlConn.query(query, customerID).then(rs => {
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
