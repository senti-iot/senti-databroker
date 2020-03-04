const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../server').authClient
const aclClient = require('../../server').aclClient

const sentiDeviceService = require('../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

let getDeviceQuery = `SELECT d.uuid, d.name, d.uuname, d.description, lat, lng, address,
						locType, communication, tags, \`data\` as metadata, dm.outbound as dataKeys, dm.inbound,
						r.name as regName, r.protocol as protocol,
						c.name as customer_name
						FROM device d
						LEFT JOIN registry r on r.id = d.reg_id
						INNER JOIN customer c on c.id = r.customer_id
						LEFT JOIN deviceMetadata dm ON d.id = dm.id
						WHERE (d.id=? OR d.uuid=?) and d.deleted=0`

let getDeviceByCustomerQuery = `SELECT d.uuid, d.name, type_id, d.description, lat, lng, address,
						locType, communication, tags, \`data\` as metadata, dm.outbound as dataKeys, dm.inbound, r.name as regName,
						r.protocol as protocol, r.id as regId
						FROM device d
						LEFT JOIN registry r on r.id = d.reg_id
						INNER JOIN customer c on c.id = r.customer_id
						LEFT JOIN deviceMetadata dm ON d.id = dm.id
						WHERE c.ODEUM_org_id=? and d.id=? and d.deleted=0`

router.get('/v2/device/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	console.log(lease)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let device = await deviceService.getDeviceByUUID(req.params.uuid)
	if (device === false) {
		res.status(404).json()
		return
	}
	res.status(200).json(device)
})

router.get('/v2/internal/fixaclreg', async (req, res) => {
	let select = `SELECT R.name as regname, R.uuid as reguuid, O.name as orgname, O.uuid as orguuid, AOR.uuid as orgresuuid 
					FROM registry R
						INNER JOIN organisation O ON R.orgId = O.id
						INNER JOIN aclOrganisationResource AOR ON AOR.orgId = O.id
						INNER JOIN aclResource AR ON AR.id = AOR.resourceId AND AR.type = 8`
	let rs = await mysqlConn.query(select, [])
	if (rs[0].length === 0) {
		res.status(404).json()
		return
	}
	let result = []
	rs[0].forEach(async row => {
		console.log(row)
		await aclClient.registerResource(row.reguuid, 9)
		await aclClient.addResourceToParent(row.reguuid, row.orgresuuid)
		result.push(row)
	})
	res.status(200).json(result)
})

router.get('/v2/internal/fixacldevice', async (req, res) => {
	let select = `SELECT D.id, D.uuid as devuuid, D.name, R.uuid as reguuid
	FROM device D
		INNER JOIN registry R ON R.id = D.reg_id`
	let rs = await mysqlConn.query(select, [])
	if (rs[0].length === 0) {
		res.status(404).json()
		return
	}
	let result = []
	
	await rs[0].reduce(async (promise, row) => {
		await promise;
		console.log(row)
		await aclClient.registerResource(row.devuuid, 11)
		await aclClient.addResourceToParent(row.devuuid, row.reguuid)
	}, Promise.resolve());
	res.status(200).json()
})

router.get('/:version/device/:id', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.id
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
router.get('/:version/:customerID/device/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let deviceID = req.params.id
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
