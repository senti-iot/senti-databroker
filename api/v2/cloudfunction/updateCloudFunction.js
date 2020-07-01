const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, /* sentiAclResourceType */ } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestCloudFunction = require('../../../lib/cloudFunction/dataClasses/RequestCloudFunction')

const cloudFunctionService = require('../../../lib/cloudFunction/cloudFunctionService')
const cfService = new cloudFunctionService(mysqlConn)

const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const sentiDataCore = new sentiDatabrokerCoreService(mysqlConn)

router.put('/v2/cloudfunction', async (req, res) => {
	try {
		let lease = await authClient.getLease(req)
		if (lease === false) {
			res.status(401).json()
			return
		}
		let access = await aclClient.testPrivileges(lease.uuid, req.body.uuid, [sentiAclPriviledge.cloudfunction.modify])
		if (access.allowed === false) {
			res.status(403).json()
			return
		}
		let requestCloudFunc = new RequestCloudFunction(req.body)
		if (requestCloudFunc.uuid !== req.body.uuid) {
			res.status(400).json()
			return
		}
		let cloudFunction = await cfService.getCloudFunctionByUUID(req.body.uuid)
		console.log(cloudFunction)
		if (!cloudFunction) {
			return res.status(404).json()
		}
		/**
		 * Change ACL if cloudFunction is moved to new org
		 * @TODO Andrei
		 */
		/**
		 * Update ACL
		 */
		let newOrg = await sentiDataCore.getDbOrganisationByUUID(req.body.org.uuid)
		let oldOrg = await sentiDataCore.getDbOrganisationById(cloudFunction.orgId)
		/**
		 * If the orgs are different
		 */
		console.log("newOrg", newOrg)
		console.log("oldOrg", oldOrg)
		if (newOrg.uuid !== oldOrg.uuid) {
			console.log('Update cloudFunction ownership')
			let newOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(newOrg.id)
			let oldOrgAclResources = await sentiDataCore.getAclOrgResourcesOnName(oldOrg.id)

			await aclClient.removeResourceFromParent(cloudFunction.uuid, oldOrgAclResources['devices'].uuid)
			await aclClient.addResourceToParent(cloudFunction.uuid, newOrgAclResources['devices'].uuid)
			console.log(cloudFunction.orgId)
			requestCloudFunc.orgId = newOrg.id
			console.log(requestCloudFunc.orgId)
		}
		let dbCloudFunction = await cfService.getDbCloudFunctionByUUID(cloudFunction.uuid)
		// Assign changed data and update cloudFunction
		dbCloudFunction.assignDiff(requestCloudFunc)
		await cfService.updateCloudFunction(dbCloudFunction)
		res.status(200).json(await cfService.getCloudFunctionById(cloudFunction.id))
	}
	catch (error) {
		res.status(500).json({ message: error.message, stack: error.stack })
	}
})

module.exports = router