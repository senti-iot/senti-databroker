const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log

router.put('/:version/devicetype', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			console.log('CREATING DEVICE_TYPE')
			let query = `INSERT INTO Device_type (name, description, customer_id, outbound, inbound, metadata)
			SELECT ?, ?, c.id, ?, ?, ? from Customer c
			where c.ODEUM_org_id=?`
			let values = [data.name, data.description, JSON.stringify(data.outbound), JSON.stringify(data.inbound), JSON.stringify(data.metadata), data.orgId]

			await mysqlConn.query(query, values).then(result => {
				log({
					msg: "Device Type created",
					deviceTypeValues: values
				})
				console.log(result)

				res.status(200).json(result[0].insertId)
			}).catch(async err => {
				// if (err) {
				console.log("error: ", err);
				let uuid = await log({
					msg: 'Error Creating Device Type',
					error: err
				},
					"error")
				res.status(500).json(uuid)
				// }
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

module.exports = router
