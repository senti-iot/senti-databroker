const express = require('express')
const router = express.Router()
// const { aclClient, authClient } = require('../../../server')
// const { sentiAclPriviledge } = require('senti-apicore')

// var mysqlConn = require('../../../mysql/mysql_handler')

// const sentiRegistryService = require('../../../lib/registry/sentiRegistryService')
// const registryService = new sentiRegistryService(mysqlConn)
// const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
// const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

router.delete('/v2/devicetype/:uuid', async (req, res) => {
	return res.status(404)
	// let lease = await authClient.getLease(req)
	// if (lease === false) {
	// 	return res.status(401).json()
	// }

	// /**
	//  * Check if the user has access to the registry
	//  */

	// let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.registry.delete, sentiAclPriviledge.organisation.modify])
	// if (access.allowed === false) {
	// 	return res.status(403).json()
	// }
	// /**
	//  * Get the Registry from the DB
	//  */
	// let registry = await registryService.getDbRegistryByUUID(req.params.uuid)
	// console.log(registry)
	// if (!registry) {
	// 	return res.status(404).json()
	// }

	// console.log('Delete registry')

	// let result = await registryService.deleteRegistry(registry)
	// await aclClient.deleteResource(registry.uuid)
	// // let result = false
	// console.log('[Registry] result', result)
	// if (result) {
	// 	return res.status(200).json(result)
	// }

})

module.exports = router