const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient


router.post('/v2/waterworks/data/totalbyday/:field/:from/:to', async (req, res) => {
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
	let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT t.d as 'datetime', sum(t.val) as value, t.d, sum(t.val) as total
					FROM (
						SELECT date(dd.created) AS d, max(dd.data->?) as val, dd.device_id
						FROM  organisation o
							INNER JOIN registry r on o.id = r.orgId
							INNER JOIN device d on r.id = d.reg_id
							INNER JOIN deviceDataClean dd
								ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created <= ?
						WHERE NOT ISNULL(dd.data->?)
							${clause}
						GROUP BY dd.device_id, date(dd.created)
					) t
					GROUP BY t.d`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, ['$.' + req.params.field, req.params.from, req.params.to, '$.' + req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})



module.exports = router