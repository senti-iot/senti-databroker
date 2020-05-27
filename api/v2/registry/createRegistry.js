const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')

var mysqlConn = require('../../../mysql/mysql_handler')

const RequestRegistry = require('../../../lib/registry/dataClasses/RequestRegistry')

const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
const registryService = new sentiRegistryService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

router.post('/v2/registry', async (req, res) => {
	/**
	 * Check if the user is logged in and his lease is still good
	 */
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	/**
	 * Check if the user has access to create registries and modify orgs to insert registry
	 */

	let access = await aclClient(testPrivileges(lease.uuid, requestRegistry.orgUUID, [sentiAclPriviledge.registry.create, sentiAclPriviledge.organisation.modify]))
	if (access.allowed === false) {
		res.status(403).json()
		return
	}

	/**
	 * Create the Registry obj from the body request
	 * and get the DB OrgId
	 */
	let requestRegistry = new RequestRegistry(req.body)
	requestRegistry.orgId = await sentiDataCore.getOrganisationIdByUUID(requestRegistry.org.uuid)

	/**
	 * Create the Registry
	 */
	let registry = await registryService.createRegistry(requestRegistry)

	if (registry) {
		/**
		 * Register the new registry with the ACL
		 */
		await aclClient.registerResource(registry.uuid, sentiAclResourceType.registry)
		/**
		 * Tie the registry to its organisation
		 */
		await aclClient.addResourceToParent(registry.uuid, requestRegistry.org.uuid)
		/**
		 * Return the new registry
		 */
		return res.status(200).json(registry)
	}
	else {
		/**
		 * If there is no registry created, an error occured, throw 500
		 */
		return res.status(500).json(registry)
	}

})

module.exports = router