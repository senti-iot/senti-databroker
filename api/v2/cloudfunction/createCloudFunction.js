const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

var mysqlConn = require('../../../mysql/mysql_handler')

const RequestCloudFunction = require('../../../lib/cloudFunction/dataClasses/RequestCloudFunction')

const cloudFunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudFunctionService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const { request } = require('express')
const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

/**
 * Route serving login form.
 * @name POST/v2/cf
 * @function
 * @memberof module:routers/cloud-functions
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
router.post('/v2/cf', async (req, res) => {
	try {

		/**
		 * Check if the user is logged in and his lease is still good
		 */
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		/**
		 * Check if the user has access to create cloud functions and modify orgs to insert registry
		 */

		let access = await aclClient.testPrivileges(lease.uuid, req.body.org.uuid, [sentiAclPriviledge.cloudfunction.create, sentiAclPriviledge.organisation.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}

		/**
		 * Create the Cloud Function from the body request
		 * and get the DB OrgId
		 */
		let requestCF = new RequestCloudFunction(req.body)
		requestCF.orgId = await sentiDataCore.getOrganisationIdByUUID(request.org.uuid)

		/**
		 * Create the Cloud Function
		 */

		let cloudFunction = await cfService.createCloudFunction(requestCF)
		let aclOrgResources = await sentiDataCore.getAclOrgResourcesOnName(requestCF.orgId)

		if (cloudFunction) {
			/**
			 * Register the new registry with the ACL
			 */
			await aclClient.registerResource(cloudFunction.uuid, sentiAclResourceType.cloudFunction)
			/**
			 * Tie the registry to its organisation
			 */
			await aclClient.addResourceToParent(cloudFunction.uuid, aclOrgResources['devices'].uuid)
			/**
			 * Return the new registry
			 */
			return res.status(200).json(cloudFunction)
		}
		else {
			/**
			 * If there is no registry created, an error occured, throw 500
			 */
			return res.status(500).json(cloudFunction)
		}
	}

	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router