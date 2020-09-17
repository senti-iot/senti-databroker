const express = require('express')
const router = express.Router()
const moment = require('moment')

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient
const secureMqttClient = require('../../../server').secureMqttClient

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

router.post('/v2/waterworks/acldevice/:deviceid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT d.id, d.uuid, d.uuname, d.name, r.uuid as reguuid, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication
					FROM device d
						INNER JOIN registry r ON r.id = d.reg_id
						INNER JOIN customer c on c.id = r.customer_id
						LEFT JOIN deviceMetadata dm on dm.device_id = d.id
					WHERE d.id = ? AND d.deleted = 0`
	let rs = await mysqlConn.query(select, [req.params.deviceid])

	let result1 = await aclClient.registerResource(rs[0][0].uuid, sentiAclResourceType.device)
	let result2 = await aclClient.addResourceToParent(rs[0][0].uuid, rs[0][0].reguuid)
	rs[0][0].result1 = result1
	rs[0][0].result2 = result2
	res.status(200).json(rs[0][0])
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
	let select = `SELECT (vdiff/diff)*86400 as value, date(t) as 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, date(t) AS d, did
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

	let select = `SELECT (vdiff/diff)*86400 as value, date(t) as 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, date(t) AS d, did
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
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})
router.get('/v2/waterworks/data/usagebyhour/:from/:to', async (req, res) => {
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
	let select = `SELECT (vdiff/diff)*3600 as value, CONCAT(DATE(t),' ',HOUR(t),':00:00') as 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*3600 as averageFlowPerHour, CONCAT(DATE(t),' ',HOUR(t),':00:00') AS datehour, did
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
										WHERE 1 ${clause}
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
										WHERE 1 ${clause}
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,d,h
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})
router.post('/v2/waterworks/data/usagebyhour/:from/:to', async (req, res) => {
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
	let select = `SELECT (vdiff/diff)*3600 as value, CONCAT(DATE(t),' ',HOUR(t),':00:00') as 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*3600 as averageFlowPerHour, CONCAT(DATE(t),' ',HOUR(t),':00:00') AS datehour, did
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
										WHERE 1 ${clause}
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
										WHERE 1 ${clause}
									) dd
									WHERE NOT ISNULL(val)
								) ddd
								GROUP BY did,d,h
							) ddd ON 1
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did
					) kiddingme;`
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})
router.get('/v2/waterworks/data/totalusagebyday/:orguuid/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let resources = await aclClient.findResources(lease.uuid, req.params.orguuid, sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	// let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
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
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs, req.params.from, req.params.to, ...queryUUIDs])
	res.status(200).json(rs[0])
})

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
	let select = `SELECT (vdiff/diff)*86400 as value, date(t) as 'datetime', uuid, vdiff/diff as averageFlowPerSecond, (vdiff/diff)*86400 as averageFlowPerDay, date(t) AS d, did
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
router.get('/v2/waterworks/data/:field/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	console.time('get devices')
	let resources = await aclClient.findResources(lease.uuid, '00000000-0000-0000-0000-000000000000', sentiAclResourceType.device, sentiAclPriviledge.device.read)
	if (resources.length === 0) {
		res.status(404).json([])
		return
	}
	console.timeEnd('get devices')
	let queryUUIDs = (resources.length > 0) ? resources.map(item => { return item.uuid }) : []
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	// let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
	// 				FROM device d 
	// 					INNER JOIN deviceDataClean dd 
	// 						ON dd.device_id = d.id 
	// 							AND dd.created >= ?
	// 							AND dd.created <= ?
	// 				WHERE NOT ISNULL(dd.data->?) ${clause}`
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value
					FROM (
						SELECT  d.id
						FROM device d
						WHERE 1 ${clause}
					) t
					INNER JOIN deviceDataClean dd FORCE INDEX (index4)  ON dd.device_id = t.id
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE NOT ISNULL(dd.data->?)`

	console.log(mysqlConn.format(select, ['$.'+req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.'+req.params.field]))
	console.time('get result')
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.'+req.params.field])
	console.timeEnd('get result')
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
	console.time('test devices')
	let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	console.timeEnd('test devices')
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	// let select = `SELECT dd.created AS t, dd.data->? as val, d.uuid AS uuid
	// 				FROM device d 
	// 					INNER JOIN deviceDataClean dd 
	// 						ON dd.device_id = d.id 
	// 							AND dd.created >= ?
	// 							AND dd.created <= ?
	// 				WHERE NOT ISNULL(dd.data->?) ${clause}`
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value
					FROM (
						SELECT  d.id
						FROM device d
						WHERE 1 ${clause}
					) t
					INNER JOIN deviceDataClean dd FORCE INDEX (index4)  ON dd.device_id = t.id
								AND dd.created >= ?
								AND dd.created <= ?
					WHERE NOT ISNULL(dd.data->?)`

	console.log(mysqlConn.format(select, ['$.'+req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.'+req.params.field]))
	console.time('get result')
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, ...queryUUIDs, req.params.from, req.params.to, '$.'+req.params.field])
	console.timeEnd('get result')
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	// console.time('get result')
	// let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	// console.timeEnd('get result')
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
	let select = `SELECT dd.created AS 'datetime', dd.data->? as value, dd.created AS t, dd.data->? as val, d.uuid AS uuid
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
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})

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
					) t;`
	let rs = await mysqlConn.query(select, [req.params.orguuid, req.params.from, req.params.to, req.params.orguuid, req.params.from, req.params.to])
	res.status(200).json(rs[0])
})

router.get('/v2/waterworks/data/benchmark/byhour/:orguuid/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT 3600*totalflow/hourcount as value
						, d AS 'datetime'
						, 3600*totalflow as totalFlowPerHour
						, totalflow/hourcount as averageFlowPerSecond
						, 3600*totalflow/hourcount as averageFlowPerHour
						, d AS datehour
					FROM ( 
					SELECT SUM(flow) AS totalflow, count(*) AS hourcount, CONCAT(date(t),' ',HOUR(t),':00:00') AS d
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
										SELECT dd.val, DATE(dd.t) as d, HOUR(dd.t) AS h, dd.t, dd.did 
										FROM ( 
											SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did 
											FROM organisation o 
												INNER JOIN registry r on o.id = r.orgId 
												INNER JOIN device d on r.id = d.reg_id 
												INNER JOIN deviceDataClean dd ON dd.device_id = d.id 
											WHERE o.uuid = ? 
												AND dd.created >= DATE_SUB(?, INTERVAL 1 HOUR) 
												AND dd.created < ?
										) dd 
										WHERE NOT ISNULL(val)
									) ddd 
									GROUP BY did, d,h 
								) d3 ON 1 
							) d4 
						INNER JOIN ( 
							SELECT val, t, @row2:=@row2+1 as r, did 
							FROM ( SELECT @row2:=0) foo 
							INNER JOIN ( 
								SELECT MAX(ddd.val) AS val, max(ddd.t) AS t, ddd.did 
								FROM ( 
									SELECT dd.val, DATE(dd.t) as d, HOUR(dd.t) AS h, dd.t, dd.did 
									FROM ( 
										SELECT dd.created AS t, dd.data->'$.volume' as val, dd.device_id AS did 
										FROM organisation o 
											INNER JOIN registry r on o.id = r.orgId 
											INNER JOIN device d on r.id = d.reg_id 
											INNER JOIN deviceDataClean dd ON dd.device_id = d.id 
										WHERE o.uuid = ? 
											AND dd.created >= DATE_SUB(?,INTERVAL 1 HOUR) 
											AND dd.created < ?
									) dd 
									WHERE NOT ISNULL(val)
								) ddd 
								GROUP BY did,d,h
							) ddd ON 1 
						) d5 ON d5.r=d4.r-1 AND d4.did=d5.did 
					) kiddingme ) km2 
					GROUP BY date(t), HOUR(t)
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
router.get('/v2/waterworks/alarm/threshold/:orguuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT tttt.device_id, (vol2-vol1)*3600/timeDiff AS flowPerHour, ((vol2-vol1)*3600/timeDiff)*24 AS flowPerDay, (((vol2-vol1)*3600/timeDiff)*24)*1000 AS flowLitersPerDay, latest, earlier, sentiEventDeviceName
	FROM (
		SELECT DC1.device_id, DC2.data->'$.volume' AS vol2,  DC1.data->'$.volume' AS vol1, timestampdiff(SECOND, earlier, latest) AS timeDiff, latest, earlier, eid, lid, sentiEventDeviceName
		FROM (
			SELECT DC.device_id, MAX(DC.created) as earlier, tt.latest, tt.lid, MAX(DC.id) AS eid, sentiEventDeviceName
			FROM (
				SELECT latest, date_sub(latest, INTERVAL 24 HOUR) AS deadline, date_sub(latest, INTERVAL 7 day) AS earliest, t.device_id, t.lid, sentiEventDeviceName
				FROM (
					SELECT MAX(DC.created) AS latest, DC.device_id,MAX(DC.id) AS lid, D.name as sentiEventDeviceName
					FROM organisation O
					INNER JOIN registry R ON R.orgId=O.id
					INNER JOIN device D ON D.reg_id=R.id
					INNER JOIN deviceDataClean DC ON DC.device_id=D.id AND DC.created> date_sub(NOW(), INTERVAL 3 DAY) AND NOT ISNULL(DC.data->'$.volume')
					WHERE O.uuid = ?
					GROUP BY DC.device_id
				)t
			) tt
			INNER JOIN deviceDataClean DC ON DC.device_id=tt.device_id AND DC.created<tt.deadline AND DC.created >tt.earliest AND NOT ISNULL(DC.data->'$.volume')
			GROUP BY DC.device_id
		 ) ttt
		 INNER JOIN deviceDataClean DC1 ON DC1.id=eid
		 INNER JOIN deviceDataClean DC2 ON DC2.id=lid
	) tttt;`
	let rs = await mysqlConn.query(select, [req.params.orguuid])
	rs[0].map(flowData => {
		flowData.latestFormat = moment(flowData.latest).format('DD/MM-YYYY HH:mm:ss')
		secureMqttClient.sendMessage(`v1/event/data/0/0/${flowData.device_id}`, JSON.stringify(flowData))
	})
	res.status(200).json(rs[0])
})
/*

*/

module.exports = router