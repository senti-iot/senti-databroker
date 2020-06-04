const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)
/**
 * Get all registries
 */
router.get('/v2/registries', async (req, res) => {
	/**
	 * Check if lease is valid
	 */
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	/**
	 * Return all resources the user has access
	 */
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.registry, sentiAclPriviledge.registry.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	/**
	 * get the list of UUIDs for the registries
	 */
	let queryUUIDs = resources.map(i => i.uuid)
	/**
	 * Generate the Registries body
	 */
	let registries = await registryService.getRegistriesByUUID(queryUUIDs)
	// console.log(registries)
	res.status(200).json(registries)
})

module.exports = router