const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

/**
 * Route serving all devices
 * @function GET /v2/devices
 * @memberof module:routers/devices
 */
router.get('/v2/devices', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	// console.log(resources)
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : false
	res.status(200).json(await deviceService.getDevicesByUUID(queryUUIDs))
})

router.get(`/v2/total-devices/:orgUUID`, async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let orgUUID = req.params.orgUUID
	let result = await deviceService.getTotalDevices(orgUUID)
	return res.status(200).json(result)
})
/**
 * Route serving all devices based on the owner UUID of the devices
 * @function GET /v2/devices/:uuid
 * @memberof module:routers/devices
 * @param {UUIDv4} req.params.uuid - Owner UUID
 */
router.get('/v2/devices/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let resources = await aclClient.findResources(lease.uuid, req.params.uuid, sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : false
	res.status(200).json(await deviceService.getDevicesByUUID(queryUUIDs))
})

module.exports = router
