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
	try {
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		let requestDevice = new RequestDevice(req.body)
		let access = await aclClient.testPrivileges(lease.uuid, requestDevice.registry.uuid, [sentiAclPriviledge.device.create, sentiAclPriviledge.registry.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		requestDevice.reg_id = await registryService.getIdByUUID(requestDevice.registry.uuid)
		requestDevice.type_id = await deviceTypeService.getIdByUUID(requestDevice.deviceType.uuid)
		
		let device = await deviceService.createDevice(requestDevice)
		await aclClient.registerResource(device.uuid, sentiAclResourceType.device)
		await aclClient.addResourceToParent(device.uuid, requestDevice.registry.uuid)
		res.status(200).json(await deviceService.getDeviceById(device.id))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router