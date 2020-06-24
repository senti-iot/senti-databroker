const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.get('/v2/devicetype/:uuid', async (req, res) => {
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
		 * Check if the user has access to the devicetype
		 */
		let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.deviceType.read])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		/**
		 * Get the DeviceType
		 */
		let deviceType = await deviceTypeService.getDeviceTypeByUUID(req.params.uuid)
		if (deviceType === false) {
			res.status(404).json()
			return
		}
		res.status(200).json(deviceType)
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})
module.exports = router