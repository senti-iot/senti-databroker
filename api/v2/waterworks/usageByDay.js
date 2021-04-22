const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient

/**
 * Usage by day with all access to devices
 */
router.get('/v2/waterworks/data/usagebyday/:from/:to', async (req, res) => {
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
	// 	let select = `SELECT sum(vdiff) as value, date(t) as 'datetime', uuid, SUM(vdiff)/SUM(diff) as totalFlowPerSecond, sum(vdiff) as totalFlowPerDay, date(t) AS datetime
	// FROM (
	// 	SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did, d4.uuid
	// 	FROM (
	// 		SELECT val, t, @row:=@row+1 as r, d3.did, d3.uuid
	// 		FROM ( SELECT @row:=0) foo
	// 		INNER JOIN (
	// 			SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did, ddd.uuid
	// 			FROM (
	// 				SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did, dd.uuid
	// 				FROM (
	// 					SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did, d.uuid
	// 					FROM device d
	// 						INNER JOIN deviceDataClean dd
	// 							ON dd.device_id = d.id
	// 								AND dd.created >= ?
	// 								AND dd.created < DATE_ADD(?, INTERVAL 1 day)
	// 					WHERE 1 ${clause}
	// 				) dd
	// 				WHERE NOT ISNULL(val)
	// 			) ddd
	// 			GROUP BY did,y,m,d
	// 		) d3 ON 1
	// 	) d4
	// 	INNER JOIN (
	// 		SELECT val, t, @row2:=@row2+1 as r, did
	// 		FROM ( SELECT @row2:=0) foo
	// 		INNER JOIN (
	// 			SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
	// 			FROM (
	// 				SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did
	// 				FROM (
	// 					SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
	// 					FROM device d
	// 						INNER JOIN deviceDataClean dd
	// 							ON dd.device_id = d.id
	// 								AND dd.created >= ?
	// 								AND dd.created < DATE_ADD(?, INTERVAL 1 day)
	// 					WHERE 1 ${clause}
	// 				) dd
	// 				WHERE NOT ISNULL(val)
	// 			) ddd
	// 			GROUP BY did,y,m,d
	// 		) ddd ON 1
	// 	) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
	// ) kiddingme
	// GROUP BY datetime;`
	let select = `SELECT sum(vdiff) as value, sum(vdiff/diff)*86400 as totalFlowPerDay, SUM(vdiff)/SUM(diff) as totalFlowPerSecond, date(t) as 'datetime'
FROM (
	SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did, d4.uuid
	FROM (
		SELECT val, t, @row:=@row+1 as r, d3.did, d3.uuid
		FROM ( SELECT @row:=0) foo
		INNER JOIN (
			SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did, ddd.uuid
			FROM (
				SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did, dd.uuid
				FROM (
					SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did, d.uuid
					FROM device d
						INNER JOIN deviceDataClean dd
							ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created < DATE_ADD(?, INTERVAL 1 day)
					WHERE 1 ${clause}
                    GROUP BY did, dd.created
				) dd
				WHERE NOT ISNULL(val)
			) ddd
			GROUP BY did,y,m,d
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
						INNER JOIN deviceDataClean dd
							ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created < DATE_ADD(?, INTERVAL 1 day)
					WHERE 1 ${clause}
                    GROUP BY did, dd.created
				) dd
				WHERE NOT ISNULL(val)
			) ddd
			GROUP BY did,y,m,d
		) ddd ON 1
	) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
) kiddingme
GROUP BY datetime;`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})


module.exports = router