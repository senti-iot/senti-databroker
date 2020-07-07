const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, /* sentiAclResourceType */ } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestDeviceType = require('../../../lib/deviceType/dataClasses/RequestDeviceType')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

router.put('/v2/devicetype', async (req, res) => {
	// return res.status(404)
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
		 * Check if the user has access to modify the devicetype
		 */
		let access = await aclClient.testPrivileges(lease.uuid, req.body.uuid, [sentiAclPriviledge.deviceType.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		/**
		 * Create the DeviceType obj from the body request and test against param
		 */
		let requestDeviceType = new RequestDeviceType(req.body)
		if (requestDeviceType.uuid !== req.body.uuid) {
			res.status(400).json()
			return
		}
		/**
		 * Get the existing DeviceType
		 */
		let deviceType = await deviceTypeService.getDeviceTypeByUUID(requestDeviceType.uuid)
		if (!deviceType) {
			return res.status(404).json()
		}
		/**
		 * Check if the organisation has changed
		 */
		if (deviceType.org.uuid !== requestDeviceType.org.uuid) {
			/**
			 * Update ACL
			 */
			let newOrg = await sentiDataCore.getDbOrganisationByUUID(requestDeviceType.org.uuid)
			let oldOrg = await sentiDataCore.getDbOrganisationByUUID(deviceType.org.uuid)
			/**
			 * Get the ACL Org resources
			 */
			let newOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(newOrg.id)
			let oldOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(oldOrg.id)
			/**
			 * Update ACL with new org resources
			 */
			await aclClient.removeResourceFromParent(deviceType.uuid, oldOrgAclResources['devices'].uuid)
			await aclClient.addResourceToParent(deviceType.uuid, newOrgAclResources['devices'].uuid)
			requestDeviceType.orgId = newOrg.id
		}
		deviceType.assignDiff(requestDeviceType)
		/**
		 * Update deviceType
		 */
		let result = await deviceTypeService.updateDeviceType(deviceType)
		if (result) {
			return res.status(200).json(result)
		} else {
			return res.status(500).json(deviceType)
		}
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}

})

module.exports = router