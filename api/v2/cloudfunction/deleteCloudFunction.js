const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge } = require('senti-apicore')

var mysqlConn = require('../../../mysql/mysql_handler')

const cloudfunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudfunctionService(mysqlConn)

router.delete('/v2/cloudfunction/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		return res.status(401).json()
	}

	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.registry.delete, sentiAclPriviledge.organisation.modify])
	if (access.allowed === false) {
		return res.status(403).json()
	}

	let cloudFunc = await cfService.getDbCloudFunctionByUUID(req.params.uuid)
	console.log(cloudFunc)
	if (!cloudFunc) {
		return res.status(404).json()
	}

	console.log('Delete cloudFunc')

	let result = await cfService.deleteCloudFunction(cloudFunc)
	await aclClient.deleteResource(cloudFunc.uuid)
	// let result = false
	console.log('[Registry] result', result)
	if (result) {
		return res.status(200).json(result)
	}

})

module.exports = router