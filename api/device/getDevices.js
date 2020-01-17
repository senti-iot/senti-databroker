const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const getDevicesCIDQuery = `SELECT d.id, d.name, d.uuid, type_id, reg_id, d.description, lat, lng, address,
							locType, communication, tags, r.name as reg_name, r.uuid as reg_uuid
						FROM Device d
						LEFT JOIN device_metadata dm ON d.id = dm.device_id
						INNER JOIN registry r on r.id = d.reg_id
						INNER JOIN customer c on c.id = r.customer_id
			WHERE d.deleted=0 AND ODEUM_org_id=?`

const getDevicesQuery = `SELECT d.name, d.uuid, type_id, reg_id, d.description, lat, lng, address,
							locType, communication, tags, r.name as reg_name, r.uuid as reg_uuid
						FROM device d
						LEFT JOIN deviceMetadata dm ON d.id = dm.device_id
						INNER JOIN registry r on r.id = d.reg_id
						INNER JOIN customer c on c.id = r.customer_id
			WHERE d.deleted=0`

router.get('/:version/devices', async (req, res) => {
	console.log('GETTING ALL DEVICES AS SU');
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			await mysqlConn.query(getDevicesQuery).then(rs => {
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

router.get('/:version/:customerID/devices', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			await mysqlConn.query(getDevicesCIDQuery, [customerID]).then(rs => {
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
module.exports = router
