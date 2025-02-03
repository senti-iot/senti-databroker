/** Express router providing user related routes
 * @module routers/devices
 * @requires express
 * @requires senti-apicore
 */

/**
 * express module
 * @const
 */
const express = require('express')
/**
 * express router
 * @const
 */
const router = express.Router()

/**
 * MySQL connector
 * @const
 */
var mysqlConn = require('../../../mysql/mysql_handler')

/**
 * ACL Privileges
 * @const sentiAclPriviledge
 */
/**
 * ACL Resource Types
 * @const sentiAclResourceType
 */
/**
 * ACL Client
 * @const aclClient
 */
/**
 * Auth Client
 * @const authClient
 */
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

/**
 * Route serving a device based on UUID provided
 * @function GET /v2/device/:uuid
 * @memberof module:routers/devices
 * @param {String} req.params.uuid UUID of the Requested Device
 */
router.get('/v2/device/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
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

/**
 * Route serving a device based on UUName provided
 * @function GET /v2/deviceByUUname/:uuname
 * @memberof module:routers/devices
 * @param {String} req.params.uuname UUName of the Requested Device
 */
router.get('/v2/deviceByUUname/:uuname', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let deviceId = await deviceService.getIdByUUName(req.params.uuname)
	console.log('get devicebyuuname ' + deviceId)
	let device = await deviceService.getDeviceById(deviceId)
	if (device === false) {
		res.status(404).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, device.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	res.status(200).json(device)
})


router.get('/v2/internal/fixaclcloudfunctions', async (req, res) => {
	let select = `SELECT CF.name as dtname, CF.uuid as dtuuid, O.name as orgname, O.uuid as orguuid, AOR.uuid as orgresuuid
					FROM cloudFunction CF
						INNER JOIN organisation O ON CF.orgId = O.id
						INNER JOIN aclOrganisationResource AOR ON AOR.orgId = O.id
						INNER JOIN aclResource AR ON AR.id = AOR.resourceId AND AR.type = 8`
	let rs = await mysqlConn.query(select, [])
	if (rs[0].length === 0) {
		res.status(404).json()
		return
	}
	let result = []
	await rs[0].forEach(async row => {
		console.log(row)
		await aclClient.registerResource(row.dtuuid, sentiAclResourceType.cloudFunction)
		await aclClient.addResourceToParent(row.dtuuid, row.orgresuuid)
		result.push(row)
	})
	res.status(200).json(result)
})

router.get('/v2/internal/fixacldevicetype', async (req, res) => {
	let select = `SELECT DT.name as dtname, DT.uuid as dtuuid, O.name as orgname, O.uuid as orguuid, AOR.uuid as orgresuuid
					FROM deviceType DT
						INNER JOIN organisation O ON DT.orgId = O.id
						INNER JOIN aclOrganisationResource AOR ON AOR.orgId = O.id
						INNER JOIN aclResource AR ON AR.id = AOR.resourceId AND AR.type = 8`
	let rs = await mysqlConn.query(select, [])
	if (rs[0].length === 0) {
		res.status(404).json()
		return
	}
	let result = []
	await rs[0].forEach(async row => {
		console.log(row)
		await aclClient.registerResource(row.dtuuid, sentiAclResourceType.deviceType)
		await aclClient.addResourceToParent(row.dtuuid, row.orgresuuid)
		result.push(row)
	})
	res.status(200).json(result)
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
		await aclClient.registerResource(row.reguuid, sentiAclResourceType.registry)
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
	// let result = []

	await rs[0].reduce(async (promise, row) => {
		await promise;
		console.log(row)
		await aclClient.registerResource(row.devuuid, sentiAclResourceType.device)
		await aclClient.addResourceToParent(row.devuuid, row.reguuid)
	}, Promise.resolve());
	res.status(200).json()
})
module.exports = router
