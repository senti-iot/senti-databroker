const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')


const getDevicesCIDQuery = `SELECT d.id, d.name, d.description, lat, lng, address,
							locType, communication, tags, r.name as reg_name
						FROM device d
						LEFT JOIN deviceMetadata dm ON d.uuid = dm.deviceHash
						INNER JOIN registry r on r.uuid = d.regHash
						INNER JOIN customer c on c.uuid = r.custHash
			WHERE d.deleted=0 AND ODEUM_org_id=?`

const getDevicesQuery = `SELECT d.name, d.description, lat, lng, address,
							locType, communication, tags, r.name as reg_name
						FROM device d
						LEFT JOIN deviceMetadata dm ON d.uuid = dm.deviceHash
						INNER JOIN registry r on r.uuid = d.regHash
						INNER JOIN customer c on c.uuid = r.custHash
			WHERE d.deleted=0`

router.get('/:version/devices', async (req, res) => {
	console.log('GETTING ALL DEVICES AS SU')
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
