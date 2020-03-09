const express = require('express')
const router = express.Router()

var mysqlConn = require('../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../server').authClient
const aclClient = require('../../server').aclClient

const sentiDeviceService = require('../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)


const waterWorksQuery = `SELECT
							dd.data->'$.value' as value,
							dd.data->'$.maxFlow' as maxFlow,
							dd.data->'$.minFlow' as minFlow,
							dd.data->'$.minATemp' as minATemp,
							dd.data->'$.minWTemp' as minWTemp,
							dd.data->'$.time' as time,
							dd.created,
							dd.device_id
						FROM
							(
							SELECT
								d.uuid
							FROM
								customer c
							INNER JOIN registry r on
								c.uuid = r.customerHash
							INNER JOIN device d on
								r.uuid = d.regHash
							WHERE
								c.uuid = ? ) t
						INNER JOIN deviceDataClean dd ON
							t.uuid = dd.deviceHash
						WHERE
							dd.data->'$.time' >= ?
							and dd.data->'$.time' <= ?
						ORDER BY
							dd.created;`



/**
 * 
 * 
SELECT vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, t, did
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
					SELECT dd.created AS t, dd.data->'$.value' as val, dd.device_id AS did
					FROM deviceDataClean dd
					WHERE dd.device_id IN (45, 48)
						AND dd.created>='2020-01-01'
						and dd.created <= '2020-03-31'
				) dd
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
					SELECT dd.created AS t, dd.data->'$.value' as val, dd.device_id AS did
					FROM deviceDataClean dd
					WHERE dd.device_id IN (45, 48)
						AND dd.created>='2020-01-01'
						and dd.created <= '2020-03-31'
				) dd
			) ddd
			GROUP BY did,y,m,d
		) ddd ON 1
	) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
) kiddingme



SELECT totalflow/daycount as averageFlowPerSecond, 86400*totalflow/daycount as averageFlowPerDay, d
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
					SELECT dd.created AS t, dd.data->'$.value' as val, dd.device_id AS did
					FROM customer c
					INNER JOIN registry r on c.id = r.customer_id
					INNER JOIN device d on r.id = d.reg_id
                    INNER JOIN deviceDataClean dd ON dd.device_id = d.id
					WHERE c.uuid = '6186949c-d107-446d-8100-18a4f09a360c'
						AND dd.created>='2020-02-20'
						and dd.created <= '2020-03-31'
				) dd
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
					SELECT dd.created AS t, dd.data->'$.value' as val, dd.device_id AS did
					FROM customer c
					INNER JOIN registry r on c.id = r.customer_id
					INNER JOIN device d on r.id = d.reg_id
                    INNER JOIN deviceDataClean dd ON dd.device_id = d.id
					WHERE c.uuid = '6186949c-d107-446d-8100-18a4f09a360c'
						AND dd.created>='2020-02-20'
						and dd.created <= '2020-03-31'
				) dd
			) ddd
			GROUP BY did,y,m,d
		) ddd ON 1
	) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
) kiddingme
) km2
GROUP BY date(t)
) t
 */

router.get('/v2/waterworks/organisation/:orguuid/device/:uuname', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let device = await deviceService.getOrganisationDeviceByUUName(req.params.orguuid, req.params.uuname)
	if (device === false) {
		res.status(404).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, device.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}

	res.status(200).json(device)
})

router.post('/v2/waterworks/adddevice/:deviceuuid/touser/:useruuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testPrivileges(lease.uuid, req.params.deviceuuid, [sentiAclPriviledge.device.modify])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	await aclClient.addPrivileges(req.params.useruuid, req.params.deviceuuid, [sentiAclPriviledge.device.read])
	res.status(200).json()
})

router.get('/v2/waterworks/data/usage/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)

	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, date(t) AS d, did
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
											INNER JOIN deviceDataClean dd 
												ON dd.device_id = d.id 
													AND dd.created >= ?
													AND dd.created <= ?
										WHERE 1 ${clause}
									) dd
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
								) ddd
								GROUP BY did,y,m,d
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})

router.get('/v2/waterworks/data/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
					FROM device d 
						INNER JOIN deviceDataClean dd 
							ON dd.device_id = d.id 
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE 1 ${clause}`
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})

router.get('/v2/waterworks/data/benchmark/:orguuid/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT totalflow/daycount as averageFlowPerSecond, 86400*totalflow/daycount as averageFlowPerDay, d
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
								) ddd
								GROUP BY did,y,m,d
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme
					) km2
					GROUP BY date(t)
					) t;`
	let rs = await mysqlConn.query(select, [req.params.orguuid, req.params.from, req.params.to, req.params.orguuid, req.params.from, req.params.to])
	res.status(200).json(rs[0])
})
module.exports = router