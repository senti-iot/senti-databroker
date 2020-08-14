const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)

router.get('/v2/registry/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.registry.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let registry = await registryService.getRegistryByUUID(req.params.uuid)
	if (registry === false) {
		res.status(404).json()
		return
	}
	res.status(200).json(registry)
})

module.exports = router