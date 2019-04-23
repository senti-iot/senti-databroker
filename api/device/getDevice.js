const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/:customerID/device/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT  Device.id, Device.name, type_id, reg_id, \`normalize\`, Device.description, lat, lng, address, locType, available, communication, tags, logging, \`data\` as metadata, Registry.name as regName, Registry.uuid as regUUID
			FROM Device
			LEFT JOIN Registry on Registry.id = Device.reg_id
			INNER JOIN Customer on Customer.id = Registry.customer_id
			LEFT JOIN Device_metadata ON Device.id = Device_metadata.device_id
			WHERE customer_id=${customerID} and Device.id=${deviceID}`
			await mysqlConn.query(query).then(rs => {
					res.status(200).json(rs[0][0])
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
