const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestDeviceType = require('../../../lib/deviceType/dataClasses/RequestDeviceType')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const databrokerCoreService = new sentiDatabrokerCoreService(mysqlConn)

router.post('/v2/devicetype', async (req, res) => {
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
		 * Create the DeviceType obj from the body request
		 */
		let requestDeviceType = new RequestDeviceType(req.body)
		/**
		 * Check if the user has access to create devicetypes in the requested Organisation
		 */
		let access = await aclClient.testPrivileges(lease.uuid, requestDeviceType.org.uuid, [sentiAclPriviledge.deviceType.create])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		/**
		 * Add organisation id to the DeviceType obj
		 */
		requestDeviceType.orgId = await databrokerCoreService.getOrganisationIdByUUID(requestDeviceType.org.uuid)
		/**
		 * Create the DeviceType
		 */
		let deviceType = await deviceTypeService.createDeviceType(requestDeviceType)
		if (deviceType) {
			let aclOrgResources = await databrokerCoreService.getAclOrgResourcesOnName(requestDeviceType.orgId)
			/**
			 * Register the new DeviceType with the ACL
			 */
			await aclClient.registerResource(deviceType.uuid, sentiAclResourceType.deviceType)
			/**
			 * Tie the DeviceType to its organisation
			 */
			await aclClient.addResourceToParent(deviceType.uuid, aclOrgResources['devices'].uuid)
			/**
			 * Return the new DeviceType
			 */
			res.status(200).json(await deviceTypeService.getDeviceTypeById(deviceType.id))
		} else {
			/**
			 * If there is no DeviceType created, an error occured, throw 500
			 */
			return res.status(500).json(deviceType)
		}
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}

})

module.exports = router