const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { aclClient, authClient } = require('../../../server')

const RequestDeviceType = require('../../../lib/devicetype/dataClasses/RequestDevicetype')

// const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const deviceService = new sentiDeviceService(mysqlConn)
// const sentiRegistryService = require('../../../lib/registry/sentiRegistryDataService')
// const registryService = new sentiRegistryService(mysqlConn)


const sentiDeviceTypeService = require('../../../lib/deviceType/sentiDeviceTypeService')
const deviceTypeService = new sentiDeviceTypeService(mysqlConn)
const sentiDatabrokerCoreService = require('../../../lib/databrokerCore/sentiDatabrokerCoreService')
const databrokerCoreService = new sentiDatabrokerCoreService(mysqlConn)

router.post('/v2/devicetype', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	requestDeviceType = new RequestDeviceType(req.body)
	let access = await aclClient.testPrivileges(lease.uuid, requestDeviceType.orgUUID, [sentiAclPriviledge.deviceType.create])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	requestDeviceType.orgId = await databrokerCoreService.getOrganisationIdByUUID(requestDeviceType.orgUUID)
	let deviceType = await deviceTypeService.createDeviceType(requestDeviceType)
	let aclOrgResources = await databrokerCoreService.getAclOrgResourcesOnName(requestDeviceType.orgId)
	// console.log(requestDevice)
	await aclClient.registerResource(deviceType.uuid, sentiAclResourceType.deviceType)
	await aclClient.addResourceToParent(deviceType.uuid, aclOrgResources['devices'].uuid)
	res.status(200).json()
})

module.exports = router