const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/devicedata-clean/:deviceID/:from/:to', async (req, res, next) => { 
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.deviceID
	let from = req.params.from
	let to = req.params.to
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT id, \`data\`, created, device_id
			FROM Device_data_clean;			
			WHERE device_id=${deviceID} AND \`data\` NOT LIKE '%null%' AND created >= '${from}' AND created <= '${to}'`
			await mysqlConn.query(query).then(rs => {
					res.status(200).json(rs[0])
				}).catch(err => {
					if(err) {res.status(500).json({err, query})}
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
			FROM Device_data;			
			WHERE device_id=${deviceID}`
			await mysqlConn.query(query).then(rs => {
					res.status(200).json(rs[0])
				}).catch(err => {
					if(err) {res.status(500).json(err)}
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
