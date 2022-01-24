const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient

router.post('/v2/waterworks/data/:field/:from/:to', async (req, res) => {
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
	console.time('test devices')
	let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	console.timeEnd('test devices')
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	// let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
	// 				FROM device d
	// 					INNER JOIN deviceDataClean dd
	// 						ON dd.device_id = d.id
	// 							AND dd.created >= ?
	// 							AND dd.created <= ?
	// 				WHERE NOT ISNULL(dd.data->?) ${clause}`
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value, t.uuid as uuid, t.uuname as uuname, t.name as name
					FROM (
						SELECT  d.id, d.uuid, d.uuname, d.name
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
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	// console.time('get result')
	// let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	// console.timeEnd('get result')
	res.status(200).json(rs[0])
})

module.exports = router