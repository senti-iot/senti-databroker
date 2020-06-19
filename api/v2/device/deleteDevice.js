const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

router.delete('/v2/device/:uuid', async (req, res) => {
	try {
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.delete])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		let device = await deviceService.getDeviceByUUID(req.params.uuid)
		if (!device) {
			return res.status(404).json()
		}
		res.status(200).json(await deviceService.deleteDevice(device))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router