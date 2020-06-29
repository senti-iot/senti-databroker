const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

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
	let result = []
	
	await rs[0].reduce(async (promise, row) => {
		await promise;
		console.log(row)
		await aclClient.registerResource(row.devuuid, sentiAclResourceType.device)
		await aclClient.addResourceToParent(row.devuuid, row.reguuid)
	}, Promise.resolve());
	res.status(200).json()
})
module.exports = router
