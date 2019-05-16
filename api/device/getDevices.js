const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/:customerID/devices', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT d.id, d.name,d.uuid, type_id, reg_id, \`normalize\`, d.description, lat, lng, address, 
			locType, available, communication, tags, logging, r.name as reg_name, r.uuid as reg_uuid
						FROM Device d
						LEFT JOIN Device_metadata dm ON d.id = dm.device_id
						INNER JOIN Registry r on r.id = d.reg_id
						INNER JOIN Customer c on c.id = r.customer_id
			WHERE customer_id=? and d.deleted=0`
			// let query = `SELECT * from Device where customer_id=${customerID}`
			await mysqlConn.query(query, [customerID]).then(rs => {
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
