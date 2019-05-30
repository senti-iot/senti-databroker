const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.put('/:version/devicetype', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			console.log('CREATING DEVICE_TYPE')
			let query = `INSERT INTO Device_type (name, customer_id, function_id) 
			SELECT ?, ?, c.id, ? from Customer c
			where c.ODEUM_org_id=?`
			let values = [data.name, data.function_id, data.customer_id]
			await mysqlConn.query(query, values).then(result => {
				res.status(200).json(result[0].insertId)
			}).catch(err => {
				res.status(500).json(err)
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
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
