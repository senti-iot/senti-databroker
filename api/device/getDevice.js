const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const authClient = require('../../server').authClient

const sentiDeviceService = require('../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

let getDeviceQuery = `SELECT d.uuid, d.name, d.uuname, d.description, lat, lng, address,
			locType, communication, tags, \`data\` as metadata, dm.outbound as dataKeys, dm.inbound,
			r.name as regName, r.protocol as protocol,
			c.name as customer_name
			FROM device d
			LEFT JOIN registry r on r.uuid = d.regHash
			INNER JOIN customer c on c.uuid = r.custHash
			LEFT JOIN deviceMetadata dm ON d.uuid = dm.deviceHash
			WHERE d.uuid=? and d.deleted=0`

let getDeviceByCustomerQuery = `SELECT d.uuid, d.name, type_id, d.description, lat, lng, address,
			locType, communication, tags, \`data\` as metadata, dm.outbound as dataKeys, dm.inbound, r.name as regName,
		 r.protocol as protocol, r.id as regId
			FROM Device d
			LEFT JOIN Registry r on r.uuid = d.regHash
			INNER JOIN Customer c on c.uuid = r.custHash
			LEFT JOIN Device_metadata dm ON d.id = dm.deviceHash
			WHERE c.ODEUM_org_id=? and d.uuid=? and d.deleted=0`

router.get('/v2/device/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	console.log(lease)
	if (lease === false) {
		res.status(401).json()
		return
	}

	res.status(200).json(lease)
})

router.get('/:version/device/:uuid', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.uuid
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let [device] = await mysqlConn.query(getDeviceQuery, [deviceID, deviceID]).catch(err => {
				if (err) { res.status(500).json(err) }
			})
			if (device[0]) {
				res.status(200).json(device[0])
			}
			else {
				res.status(404).json()
			}
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})
router.get('/:version/:customerID/device/:uuid', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.uuid
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {

			await mysqlConn.query(getDeviceByCustomerQuery, [customerID, deviceID]).then(rs => {
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
