const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
// const aclClient = require('../../../server').aclClient

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const deviceService = new sentiDeviceService(mysqlConn)

router.post('/v2/climaidinsight/heatmap/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let queryUUIDs = (req.body.length) ? req.body : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	// let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT CONCAT(date(created), ' ', hour(created)) AS ts, 
					sum(data->?)/count(*) as average
					FROM deviceDataClean ddc
					WHERE ddc.created >= ? AND ddc.created < ?
						AND NOT ISNULL(ddc.data->?) 
						${clause}
					GROUP BY DATE(created), HOUR(created)`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})
module.exports = router