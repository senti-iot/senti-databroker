const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge } = require('senti-apicore')

const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient


/**
 * Usage by Hour
 */
router.get('/v2/waterworks/data/device/:deviceuuid/usagebyhour/:from/:to', async (req, res) => {
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
	let select = `SELECT (vdiff/diff)*3600 as value, CONCAT(DATE(t),' ',HOUR(t),':00:00') AS 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*3600 as averageFlowPerHour, CONCAT(DATE(t),' ',HOUR(t),':00:00') AS datehour, did
					FROM (
						SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did, d4.uuid
						FROM (
							SELECT val, t, @row:=@row+1 as r, d3.did, d3.uuid
							FROM ( SELECT @row:=0) foo
							INNER JOIN (
								SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did, ddd.uuid
								FROM (
									SELECT dd.val, DATE(dd.t) AS d, HOUR(dd.t) As h, dd.t, dd.did, dd.uuid
									FROM (
										SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did, d.uuid
										FROM device d
											INNER JOIN deviceDataClean dd
												ON dd.device_id = d.id
													AND dd.created >= DATE_SUB(?, INTERVAL 1 HOUR)
													AND dd.created < ?
										WHERE d.uuid = ?
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,d,h
							) d3 ON 1
						) d4
						INNER JOIN (
							SELECT val, t, @row2:=@row2+1 as r, did
							FROM ( SELECT @row2:=0) foo
							INNER JOIN (
								SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
								FROM (
									SELECT dd.val, DATE(dd.t) AS d, HOUR(dd.t) As h, dd.t, dd.did
									FROM (
										SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
										FROM device d
											INNER JOIN deviceDataClean dd
												ON dd.device_id = d.id
													AND dd.created >= DATE_SUB(?, INTERVAL 1 HOUR)
													AND dd.created < ?
										WHERE d.uuid = ?
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,d,h
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, req.params.deviceuuid, req.params.from, req.params.to, req.params.deviceuuid]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, req.params.deviceuuid, req.params.from, req.params.to, req.params.deviceuuid])
	res.status(200).json(rs[0])
})

module.exports = router