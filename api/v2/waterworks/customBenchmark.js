const express = require('express')
const router = express.Router()
var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')
const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient
const sql = require('../../../lib/sql')

/**
 * POST endpoint for custom benchmark based on device UUIDS
 * @http POST
 * @url /v2/waterworks/data/custom-benchmark/:from/:to
 * @param from - Start Date
 * @param to - End Date
 * @param body - Device UUIDs
 */

router.post('/v2/waterworks/data/custom-benchmark/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	let startDate = req.params.from
	let endDate = req.params.to
	console.log(startDate, endDate)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let queryUUIDs = (req.body.length) ? req.body : []
	console.log('Query UUIDS', queryUUIDs)
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
	let select = sql`SELECT 86400*totalflow/daycount as value, d as 'datetime', 86400*totalflow as totalFlowPerDay, totalflow/daycount as averageFlowPerSecond, 86400*totalflow/daycount as averageFlowPerDay, d
	FROM (
		SELECT SUM(flow) AS totalflow, count(*) AS daycount, date(t) AS d
		FROM (
			SELECT vdiff/diff as flow, t, did
			FROM (
				SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did
				FROM (
					SELECT val, t, @row:=@row+1 as r, d3.did
					FROM ( SELECT @row:=0) foo
					INNER JOIN (
						SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
						FROM (
							SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did
							FROM (
								SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
								FROM device d
								INNER JOIN deviceDataClean dd ON dd.device_id = d.id
								WHERE 1 ${clause}
									AND dd.created >= DATE_SUB(?, INTERVAL 1 DAY)
									and dd.created <= ?
							) dd
							WHERE NOT ISNULL(val)
						) ddd
						GROUP BY did, y,m,d
					) d3 ON 1
				) d4
				INNER JOIN (
					SELECT val, t, @row2:=@row2+1 as r, did
					FROM ( SELECT @row2:=0) foo
					INNER JOIN (
						SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
						FROM (
							SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did
							FROM (
								SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
								FROM device d
								INNER JOIN deviceDataClean dd ON dd.device_id = d.id
								WHERE 1 ${clause}
									AND dd.created >= DATE_SUB(?, INTERVAL 1 DAY)
									and dd.created <= ?
							) dd
							WHERE NOT ISNULL(val)
						) ddd
						GROUP BY did,y,m,d
					) ddd ON 1
				) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
			) kiddingme
		) km2
		GROUP BY date(t)
	) t;`
	let formatSQL = await mysqlConn.format(select, [...queryUUIDs, startDate, endDate, ...queryUUIDs, startDate, endDate])
	console.log(formatSQL)
	let rs = await mysqlConn.query(select, [...queryUUIDs, startDate, endDate, ...queryUUIDs, startDate, endDate])
	return res.status(200).json(rs[0])

})
module.exports = router