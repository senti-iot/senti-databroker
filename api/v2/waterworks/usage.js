const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient

/**
 * GET endpoint for usage from all ACL devices
 * @http GET
 * @url /v2/waterworks/data/usage/:from/:to
 * @param from - Start Date
 * @param to - End Date
 */
router.get('/v2/waterworks/data/usage/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''

	let select = `SELECT (vdiff/diff)*86400 as value, t as 'datetime', uuid, vdiff as volumeDifference, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, t, did
					FROM (
						SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did, d4.uuid
						FROM (
							SELECT val, t, @row:=@row+1 as r, d3.did, d3.uuid
							FROM ( SELECT @row:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did, dd.uuid
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did, d.uuid
									FROM device d
										INNER JOIN deviceDataClean dd
											ON dd.device_id = d.id
												AND dd.created >= ?
												AND dd.created <= ?
									WHERE 1 ${clause}
								) dd
								WHERE NOT ISNULL(dd.val)
								GROUP BY did,t
							) d3 ON 1
						) d4
						INNER JOIN (
							SELECT val, t, @row2:=@row2+1 as r, did, uuid
							FROM ( SELECT @row2:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did, dd.uuid
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did, d.uuid
									FROM device d
										INNER JOIN deviceDataClean dd
											ON dd.device_id = d.id
												AND dd.created >= ?
												AND dd.created <= ?
									WHERE 1 ${clause}
								) dd
								WHERE NOT ISNULL(dd.val)
								GROUP BY did,t
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})


module.exports = router