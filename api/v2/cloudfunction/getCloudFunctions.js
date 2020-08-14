const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const cloudFunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudFunctionService(mysqlConn)
/**
 * Get all registries
 */
router.get('/v2/cloudfunctions', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.cloudFunction, sentiAclPriviledge.cloudfunction.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}

	let queryUUIDs = resources.map(i => i.uuid)
	let registries = await cfService.getCloudFunctionsByUUIDS(queryUUIDs)

	res.status(200).json(registries)
})

router.get('/v2/cloudfunctions/:orguuid', async (req, res) => {

	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let resources = await aclClient.findResources(lease.uuid, req.params.orguuid, sentiAclResourceType.cloudFunction, sentiAclPriviledge.cloudfunction.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}

	let queryUUIDs = resources.map(i => i.uuid)

	let registries = await cfService.getCloudFunctionsByUUIDS(queryUUIDs)

	res.status(200).json(registries)
})

module.exports = router