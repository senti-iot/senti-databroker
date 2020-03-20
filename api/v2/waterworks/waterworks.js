const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

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
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	
	let select = `SELECT vdiff as volumeDifference, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, t, did
					FROM (
						SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did
						FROM (
							SELECT val, t, @row:=@row+1 as r, d3.did
							FROM ( SELECT @row:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
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
							SELECT val, t, @row2:=@row2+1 as r, did
							FROM ( SELECT @row2:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
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
router.get('/v2/waterworks/data/device/:deviceuuid/usage/:from/:to', async (req, res) => {
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
	let select = `SELECT vdiff as volumeDifference, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, t, did
					FROM (
						SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did
						FROM (
							SELECT val, t, @row:=@row+1 as r, d3.did
							FROM ( SELECT @row:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
									FROM device d 
										INNER JOIN deviceDataClean dd 
											ON dd.device_id = d.id 
												AND dd.created >= ?
												AND dd.created <= ?
									WHERE d.uuid = ?
								) dd
								WHERE NOT ISNULL(dd.val)
								GROUP BY did,t
							) d3 ON 1
						) d4
						INNER JOIN (
							SELECT val, t, @row2:=@row2+1 as r, did
							FROM ( SELECT @row2:=0) foo
							INNER JOIN (
								SELECT dd.val, dd.t, dd.did
								FROM (
									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
									FROM device d 
										INNER JOIN deviceDataClean dd 
											ON dd.device_id = d.id 
												AND dd.created >= ?
												AND dd.created <= ?
									WHERE d.uuid = ?
								) dd
								WHERE NOT ISNULL(dd.val)
								GROUP BY did,t
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, req.params.deviceuuid, req.params.from, req.params.to, req.params.deviceuuid])
	res.status(200).json(rs[0])
})
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
					) kiddingme;`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})
router.post('/v2/waterworks/data/usagebyday/:from/:to', async (req, res) => {
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
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})
router.get('/v2/waterworks/data/device/:deviceuuid/usagebyday/:from/:to', async (req, res) => {
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
										WHERE d.uuid = ?
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
										WHERE d.uuid = ?
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,y,m,d
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, req.params.deviceuuid, req.params.from, req.params.to, req.params.deviceuuid])
	res.status(200).json(rs[0])
})
router.get('/v2/waterworks/data/:field/:from/:to', async (req, res) => {
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
	let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
					FROM device d 
						INNER JOIN deviceDataClean dd 
							ON dd.device_id = d.id 
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE NOT ISNULL(dd.data->?) ${clause}`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})
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
	let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
					FROM device d 
						INNER JOIN deviceDataClean dd 
							ON dd.device_id = d.id 
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE NOT ISNULL(dd.data->?) ${clause}`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})

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
	let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
					FROM device d 
						INNER JOIN deviceDataClean dd 
							ON dd.device_id = d.id 
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE d.uuid = ? 
						AND NOT ISNULL(dd.data->?)`
	console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, req.params.deviceuuid, '$.'+req.params.field]))
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, req.params.deviceuuid, '$.'+req.params.field])
	res.status(200).json(rs[0])
})

router.get('/v2/waterworks/data/totalbyday/:orguuid/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT t.d, sum(t.val) as total
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
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, req.params.orguuid])
	res.status(200).json(rs[0])
})
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
	let select = `SELECT t.d, sum(t.val) as total
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
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
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
router.post('/v2/waterworks/data/benchmark/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testResources(lease.uuid, req.body, [sentiAclPriviledge.device.read])
	console.log(access)
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	res.status(200).json(access)
	// let select = `SELECT totalflow/daycount as averageFlowPerSecond, 86400*totalflow/daycount as averageFlowPerDay, d
	// 				FROM (
	// 				SELECT SUM(flow) AS totalflow, count(*) AS daycount, date(t) AS d
	// 				FROM (
	// 				SELECT vdiff/diff as flow, t, did
	// 				FROM (
	// 					SELECT d4.val-d5.val as vdiff, time_to_sec((timediff(d4.t,d5.t))) as diff, d4.t, d4.did
	// 					FROM (
	// 						SELECT val, t, @row:=@row+1 as r, d3.did
	// 						FROM ( SELECT @row:=0) foo
	// 						INNER JOIN (
	// 							SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
	// 							FROM (
	// 								SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did
	// 								FROM (
	// 									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
	// 									FROM organisation o
	// 									INNER JOIN registry r on o.id = r.orgId
	// 									INNER JOIN device d on r.id = d.reg_id
	// 									INNER JOIN deviceDataClean dd ON dd.device_id = d.id
	// 									WHERE o.uuid = ?
	// 										AND dd.created >= ?
	// 										and dd.created <= ?
	// 								) dd
	// 							) ddd
	// 							GROUP BY did, y,m,d
	// 						) d3 ON 1
	// 					) d4
	// 					INNER JOIN (
	// 						SELECT val, t, @row2:=@row2+1 as r, did
	// 						FROM ( SELECT @row2:=0) foo
	// 						INNER JOIN (
	// 							SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did
	// 							FROM (
	// 								SELECT dd.val, YEAR(dd.t) as y, MONTH(dd.t) as m, DAY(dd.t) AS d, dd.t, dd.did
	// 								FROM (
	// 									SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did
	// 									FROM organisation o
	// 									INNER JOIN registry r on o.id = r.orgId
	// 									INNER JOIN device d on r.id = d.reg_id
	// 									INNER JOIN deviceDataClean dd ON dd.device_id = d.id
	// 									WHERE o.uuid = ?
	// 										AND dd.created >= ?
	// 										and dd.created <= ?
	// 								) dd
	// 							) ddd
	// 							GROUP BY did,y,m,d
	// 						) ddd ON 1
	// 					) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
	// 				) kiddingme
	// 				) km2
	// 				GROUP BY date(t)
	// 				) t;`
	// let rs = await mysqlConn.query(select, [req.params.orguuid, req.params.from, req.params.to, req.params.orguuid, req.params.from, req.params.to])
	// res.status(200).json(rs[0])
})
module.exports = router