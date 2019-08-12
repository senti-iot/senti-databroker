const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const getDeviceTypesCID = `SELECT t.name,t.id, t.inbound, t.outbound, t.customer_id, c.name AS customer_name, c.uuid FROM Device_type t
			INNER JOIN Customer c on c.id = t.customer_id
			WHERE c.ODEUM_org_id=? and t.deleted=0`

const getDeviceTypes = `SELECT t.*, c.name AS customer_name FROM Device_type t
			INNER JOIN Customer c on c.id = t.customer_id
			WHERE t.deleted=0`

router.get('/:version/:customerID/devicetypes', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			await mysqlConn.query(getDeviceTypesCID, [customerID]).then(rs => {
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
router.get('/:version/devicetypes', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			await mysqlConn.query(getDeviceTypes).then(rs => {
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
