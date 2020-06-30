const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, /* sentiAclResourceType */ } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestDevice = require('../../../lib/device/dataClasses/RequestDevice')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)
const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)
const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.put('/v2/device/:uuid', async (req, res) => {
	try {
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		let requestDevice = new RequestDevice(req.body)
		if (requestDevice.uuid !== req.params.uuid) {
			res.status(400).json()
			return
		}
		let device = await deviceService.getDeviceByUUID(req.params.uuid)
		if (!device) {
			return res.status(404).json()
		}
		requestDevice.reg_id = await registryService.getIdByUUID(requestDevice.registry.uuid)
		requestDevice.type_id = await deviceTypeService.getIdByUUID(requestDevice.deviceType.uuid)
		/**
		 * Change ACL if device is moved to new registry
		 */
		if (requestDevice.reg_id !== device.reg_id) {
			let registryModifyAccess = await aclClient.testPrivileges(lease.uuid, requestDevice.registry.uuid, [sentiAclPriviledge.device.create, sentiAclPriviledge.registry.modify])
			if (registryModifyAccess.allowed === false) {
				res.status(403).json()
				return
			}
			await aclClient.removeResourceFromParent(device.uuid, device.registry.uuid)
			await aclClient.addResourceToParent(device.uuid, requestDevice.registry.uuid)
		}
		let dbDevice = await deviceService.getDbDeviceByUUID(device.uuid)
		// Assign changed data and update device
		dbDevice.assignDiff(requestDevice)
		await deviceService.updateDevice(dbDevice)
		res.status(200).json(await deviceService.getDeviceById(device.id))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router