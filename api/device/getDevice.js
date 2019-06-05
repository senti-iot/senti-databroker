const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/device/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT d.id, d.name, d.uuid, type_id, reg_id, d.description, lat, lng, address, 
			locType, communication, tags, JSON_REMOVE(\`data\`,'$.key') as metadata, dm.outbound as dataKeys, dm.inbound, 
			r.name as regName, r.uuid as regUUID, r.protocol as protocol, r.id as regId,
			c.name as customer_name, c.uuid as customer_uuid
			FROM Device d
			LEFT JOIN Registry r on r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			LEFT JOIN Device_metadata dm ON d.id = dm.device_id
			WHERE d.id=? and d.deleted=0`
			await mysqlConn.query(query, [deviceID]).then(rs => {
				res.status(200).json(rs[0][0])
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
router.get('/:version/:customerID/device/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT d.id, d.name,d.uuid, type_id, reg_id, d.description, lat, lng, address, 
			locType, communication, tags, JSON_REMOVE(\`data\`,'$.key') as metadata, dm.outbound as dataKeys, dm.inbound, r.name as regName, 
			r.uuid as regUUID, r.protocol as protocol, r.id as regId
			FROM Device d
			LEFT JOIN Registry r on r.id = d.reg_id
			INNER JOIN Customer c on c.id = r.customer_id
			LEFT JOIN Device_metadata dm ON d.id = dm.device_id
			WHERE c.ODEUM_org_id=? and d.id=? and d.deleted=0`
			await mysqlConn.query(query, [customerID, deviceID]).then(rs => {
				res.status(200).json(rs[0][0])
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
