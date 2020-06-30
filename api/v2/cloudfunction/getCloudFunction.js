const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const cloudFunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudFunctionService(mysqlConn)

router.get('/v2/cloudfunction/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.cloudfunction.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let cloudFunc = await cfService.getCloudFunctionByUUID(req.params.uuid)
	if (cloudFunc === false) {
		res.status(404).json()
		return
	}
	res.status(200).json(cloudFunc)
})

module.exports = router