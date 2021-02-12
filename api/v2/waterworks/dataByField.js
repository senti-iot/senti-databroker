const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient


router.get('/v2/waterworks/data/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	console.time('get devices')
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	console.timeEnd('get devices')
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	// let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
	// 				FROM device d
	// 					INNER JOIN deviceDataClean dd
	// 						ON dd.device_id = d.id
	// 							AND dd.created >= ?
	// 							AND dd.created <= ?
	// 				WHERE NOT ISNULL(dd.data->?) ${clause}`
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value
					FROM (
						SELECT  d.id
						FROM device d
						WHERE 1 ${clause}
					) t
					INNER JOIN deviceDataClean dd FORCE INDEX (index4)  ON dd.device_id = t.id
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE NOT ISNULL(dd.data->?)`

	console.log(mysqlConn.format(select, ['$.' + req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.' + req.params.field]))
	console.time('get result')
	let rs = await mysqlConn.query(select, ['$.' + req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.' + req.params.field])
	console.timeEnd('get result')
	res.status(200).json(rs[0])
})

module.exports = router