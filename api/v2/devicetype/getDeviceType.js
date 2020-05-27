const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)

router.get('/v2/devicetype/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	// let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.deviceType.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let deviceType = await deviceTypeService.getDeviceTypeByUUID(req.params.uuid)
	if (deviceType === false) {
		res.status(404).json()
		return
	}
	res.status(200).json(deviceType)
})
module.exports = router