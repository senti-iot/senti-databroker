const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.get('/v2/devicetypes', async (req, res) => {
	try {
		/**
		 * Check if the user is logged in and his lease is still good
		 */
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		/**
		 * Fetch all the devicetypes uuids the user has access to. Return 404 if none is found
		 */
		let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.deviceType, sentiAclPriviledge.deviceType.read)
		if (resources.length === 0) {
			res.status(404).json([])
			return
		}
		/**
		 * Return an array of DeviceType
		 */
		let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : false
		res.status(200).json(await deviceTypeService.getDeviceTypesByUUID(queryUUIDs))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}

})

router.get('/v2/devicetypes/:uuid', async (req, res) => {
	try {
		/**
		 * Check if the user is logged in and his lease is still good
		 */
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		/**
		 * Fetch all the devicetypes uuids the user has access to below the given uuid. Return 404 if none is found
		 */
		let resources = await aclClient.findResources(lease.uuid, req.params.uuid, sentiAclResourceType.deviceType, sentiAclPriviledge.deviceType.read)
		if (resources.length === 0) {
			res.status(404).json([])
			return
		}
		/**
		 * Return an array of DeviceType
		 */
		let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : false
		res.status(200).json(await deviceTypeService.getDeviceTypesByUUID(queryUUIDs))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router
