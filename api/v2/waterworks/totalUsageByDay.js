const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient


router.post('/v2/waterworks/data/totalusagebyday/:from/:to', async (req, res) => {
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
	let select = `SELECT sum(vdiff) as value, 86400*sum(vdiff/diff) as totalFlowPerDay, SUM(vdiff/diff) as totalFlowPerSecond, date(t) as 'datetime'
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
					WHERE 1 AND ${clause}
                    GROUP BY did, dd.created
				) dd
				WHERE NOT ISNULL(val)
			) ddd
			GROUP BY did,y,m,d
		) ddd ON 1
	) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
) kiddingme
GROUP BY datetime;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})


module.exports = router



/*
	let select = `SELECT sum((vdiff/diff)*86400) as value, date(t) as 'datetime', uuid, sum(vdiff/diff) as totalFlowPerSecond, sum((vdiff/diff)*86400) as totalFlowPerDay, date(t) AS d
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
													AND dd.created <= ?
										WHERE 1 ${clause}
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
													AND dd.created <= ?
										WHERE 1 ${clause}
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,y,m,d
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme
					GROUP BY d;`
	*/