const express = require('express')
const router = express.Router()
const { aclClient, authClient } = require('../../../server')
const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

var mysqlConn = require('../../../mysql/mysql_handler')

const RequestCloudFunction = require('../../../lib/cloudFunction/dataClasses/RequestCloudFunction')

const cloudFunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudFunctionService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
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
router.post('/v2/cloudfunction', async (req, res) => {
	try {

		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}

		let access = await aclClient.testPrivileges(lease.uuid, req.body.org.uuid, [sentiAclPriviledge.cloudfunction.create, sentiAclPriviledge.organisation.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}

		let requestCF = new RequestCloudFunction(req.body)
		requestCF.orgId = await sentiDataCore.getOrganisationIdByUUID(req.body.org.uuid)

		let cloudFunction = await cfService.createCloudFunction(requestCF)
		let aclOrgResources = await sentiDataCore.getAclOrgResourcesOnName(requestCF.orgId)

		if (cloudFunction) {

			await aclClient.registerResource(cloudFunction.uuid, sentiAclResourceType.cloudFunction)
			await aclClient.addResourceToParent(cloudFunction.uuid, aclOrgResources['devices'].uuid)
			return res.status(200).json(cloudFunction)

		}

		else {

			return res.status(500).json(cloudFunction)
		}
	}

	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router