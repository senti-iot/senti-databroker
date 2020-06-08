const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge } = require('senti-apicore')

var mysqlConn = require('../../../mysql/mysql_handler')

const RequestRegistry = require('../../../lib/registry/dataClasses/RequestRegistry')

const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

router.put('/v2/registry', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		return res.status(401).json()
	}
	/**
	 * Create a request Registry
	 */
	let requestRegistry = new RequestRegistry(req.body)
	/**
	 * Check if the user has access to the registry
	 */
	let access = await aclClient.testPrivileges(lease.uuid, requestRegistry.org.uuid, [sentiAclPriviledge.registry.delete, sentiAclPriviledge.organisation.modify])
	if (access.allowed === false) {
		return res.status(403).json()
	}
	/**
	 * Get the Registry from the DB
	 */
	let registry = await registryService.getDbRegistryByUUID(requestRegistry.uuid)
	if (!registry) {
		return res.status(404).json()
	}
	/**
	 * Update ACL
	 */
	let oldOrg = await sentiDataCore.getDbOrganisationById(registry.orgId)

	/**
	 * If the orgs are different
	 */
	if (oldOrg.uuid) {
		console.log('Update registry ownership')
		let oldOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(oldOrg.id)
		let hasDevices = await aclClient.findResources(registry.uuid, oldOrgAclResources['devices'].uuid)
		console.log('hasDevices', hasDevices)
		// await aclClient.removeResourceFromParent(registry.uuid, oldOrgAclResources['devices'].uuid)
	}

	// let result = await registryService.deleteRegistry(registry)
	let result = false
	console.log('[Registry] result', result)
	if (result) {
		return res.status(200).json(result)
	}

})

module.exports = router