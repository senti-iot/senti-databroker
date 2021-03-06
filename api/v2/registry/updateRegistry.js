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
	let requestRegistry = new RequestRegistry(req.body)
	let access = await aclClient.testPrivileges(lease.uuid, requestRegistry.org.uuid, [sentiAclPriviledge.registry.modify, sentiAclPriviledge.organisation.modify])
	if (access.allowed === false) {
		return res.status(403).json()
	}
	let registry = await registryService.getDbRegistryByUUID(requestRegistry.uuid)
	if (!registry) {
		return res.status(404).json()
	}
	console.log('[Registry]', registry)
	/**
	 * Update ACL
	 */
	let newOrg = await sentiDataCore.getDbOrganisationByUUID(requestRegistry.org.uuid)
	let oldOrg = await sentiDataCore.getDbOrganisationById(registry.orgId)
	/**
	 * If the orgs are different
	 */
	console.log("newOrg", newOrg)
	console.log("oldOrg", oldOrg)
	if (newOrg.uuid !== oldOrg.uuid) {
		console.log('Update registry ownership')
		let newOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(newOrg.id)
		let oldOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(oldOrg.id)

		await aclClient.removeResourceFromParent(registry.uuid, oldOrgAclResources['devices'].uuid)
		await aclClient.addResourceToParent(registry.uuid, newOrgAclResources['devices'].uuid)
		console.log(registry.orgId)
		requestRegistry.orgId = newOrg.id
		console.log(requestRegistry.orgId)
	}

	registry.assignDiff(requestRegistry)
	// console.log('[Registry] updReg', updReg)
	console.log(registry)
	let result = await registryService.updateRegistry(registry)
	console.log('[Registry] result', result)
	if (result) {
		return res.status(200).json(result)
	}

	// let registry = registryService.updateRegistry(requestRegistry)
	// if (registry) {
	// let res = await aclClient.
	// }

})

module.exports = router