const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient


router.get('/v2/waterworks/data/device/:deviceuuid/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.deviceuuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value, dd.created AS t, dd.data->? as val, d.uuid AS uuid
					FROM device d
						INNER JOIN deviceDataClean dd
							ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE d.uuid = ?
						AND NOT ISNULL(dd.data->?)`
	console.log(mysqlConn.format(select, ['$.' + req.params.field, req.params.from, req.params.to, req.params.deviceuuid, '$.' + req.params.field]))
	let rs = await mysqlConn.query(select, ['$.' + req.params.field, req.params.from, req.params.to, req.params.deviceuuid, '$.' + req.params.field])
	res.status(200).json(rs[0])
})

router.get('/v2/waterworks/data/totalbyday/:orguuid/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
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
							AND o.uuid = ?
						GROUP BY dd.device_id, date(dd.created)
					) t
					GROUP BY t.d`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, req.params.orguuid]))
	let rs = await mysqlConn.query(select, ['$.' + req.params.field, req.params.from, req.params.to, '$.' + req.params.field, req.params.orguuid])
	res.status(200).json(rs[0])
})

module.exports = router