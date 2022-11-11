const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const authClient = require('../../../server').authClient



router.get('/v2/waterworks/data/benchmark/:orguuid/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT 86400*totalflow/daycount as value, d as 'datetime', 86400*totalflow as totalFlowPerDay, totalflow/daycount as averageFlowPerSecond, 86400*totalflow/daycount as averageFlowPerDay, d
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
										FROM organisation o
										INNER JOIN registry r on o.id = r.orgId
										INNER JOIN device d on r.id = d.reg_id
										INNER JOIN deviceDataClean dd ON dd.device_id = d.id
										WHERE o.uuid = ?
											AND dd.created >= ?
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
										FROM organisation o
										INNER JOIN registry r on o.id = r.orgId
										INNER JOIN device d on r.id = d.reg_id
										INNER JOIN deviceDataClean dd ON dd.device_id = d.id
										WHERE o.uuid = ?
											AND dd.created >= ?
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
					) t
					ORDER BY datetime;`
	let rs = await mysqlConn.query(select, [req.params.orguuid, req.params.from, req.params.to, req.params.orguuid, req.params.from, req.params.to])
	res.status(200).json(rs[0])
})



module.exports = router