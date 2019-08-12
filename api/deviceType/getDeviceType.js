const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const getDeviceTypeQuery = `SELECT dt.id, dt.name, dt.description, dt.inbound, dt.outbound, dt.metadata, dt.deleted, c.name as customerName, c.ODEUM_org_id as orgId, dt.customer_id
			FROM Device_type dt
			INNER JOIN Customer c on c.id = dt.customer_id
			WHERE dt.id=? and dt.deleted=0;`

router.get('/:version/:customerID/deviceType/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			// let customerID = req.params.customerID
			let deviceTypeID = req.params.id
			await mysqlConn.query(getDeviceTypeQuery, [deviceTypeID]).then(rs => {
				if (rs[0][0]) {
					res.status(200).json(rs[0][0])
				}
				else {
					res.status(404).json(false)
				}
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

module.exports = router
