const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestDevice = require('../../../lib/device/dataClasses/RequestDevice')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)
const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)
const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.post('/v2/device', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let requestDevice = new RequestDevice(req.body)
	let access = await aclClient.testPrivileges(lease.uuid, requestDevice.regUUID, [sentiAclPriviledge.device.create, sentiAclPriviledge.registry.modify])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	requestDevice.reg_id = await registryService.getIdByUUID(requestDevice.regUUID)
	requestDevice.type_id = await deviceTypeService.getIdByUUID(requestDevice.typeUUID)
	console.log(requestDevice)
	let device = await deviceService.createDevice(requestDevice)
	await aclClient.registerResource(device.uuid, sentiAclResourceType.device)
	await aclClient.addResourceToParent(device.uuid, requestDevice.regUUID)
	console.log(device)
	res.status(200).json(device)
})

module.exports = router