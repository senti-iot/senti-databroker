const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge } = require('senti-apicore')

var mysqlConn = require('../../../mysql/mysql_handler')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.delete('/v2/devicetype/:uuid', async (req, res) => {
	try {
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.deviceType.delete])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		let deviceType = await deviceTypeService.getDeviceTypeByUUID(req.params.uuid)
		if (!deviceType) {
			return res.status(404).json()
		}
		res.status(200).json(await deviceTypeService.deleteDevice(deviceType))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router