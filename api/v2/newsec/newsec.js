
const express = require('express')
const router = express.Router()
// const moment = require('moment')

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient

// const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const deviceService = new sentiDeviceService(mysqlConn)

router.post('/v2/newsec/deviceco2byyear', async (req, res) => {
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
	// let select = `SELECT sum(CAST(dd.val AS DECIMAL(10,3))) as val, YEAR(dd.t) as y, dd.did, dd.uuid
	// 				FROM (
	// 					SELECT dd.created AS t, dd.data->'$.co2' as val, dd.device_id AS did, d.uuid
	// 						FROM device d 
	// 							INNER JOIN deviceDataClean dd ON dd.device_id = d.id
	// 						WHERE 1 ${clause}
	// 					) dd
	// 				WHERE NOT ISNULL(val)
	// 				GROUP BY y, uuid
	// 				ORDER BY y, did`

	let select = `SELECT sum(dd.val) as val, YEAR(dd.t) as y, dd.did, dd.uuid, dd.type_id, IF(dd.type_id=79, 'Fjernvarme', IF(dd.type_id=80, 'Vand', IF(dd.type_id=81, 'Elektricitet', null))) as type
					FROM (
						SELECT dd.created AS t, 1.000*dd.data->'$.co2' as val, dd.device_id AS did, d.uuid, d.type_id
							FROM device d 
								INNER JOIN deviceDataClean dd ON dd.device_id = d.id
							WHERE 1 ${clause}
						) dd
					WHERE NOT ISNULL(val)
					GROUP BY y, type_id
					ORDER BY y, type_id`

	console.log(mysqlConn.format(select, [...queryUUIDs]))
	let rs = await mysqlConn.query(select, [...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	let result = {}
	rs[0].forEach(row => {
		if (result[row.y] === undefined) {
			result[row.y] = {
				"year": row.y,
				"sum": 0,
				"Fjernvarme": 0,
				"Vand": 0,
				"Elektricitet": 0
			}
		}
		result[row.y][row.type] = row.val
		result[row.y].sum += parseFloat(row.val)
	})
	res.status(200).json(Object.values(result))
})

router.post('/v2/newsec/buildingsum/:from/:to', async (req, res) => {
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
	let select = `SELECT sum(dd.val) as val, dd.did, dd.uuid, REPLACE(dd.uuname, '-Emission', '') as buildingNo
					FROM (
						SELECT dd.created AS t, 1.000*dd.data->'$.co2' as val, dd.device_id AS did, d.uuid, d.uuname
							FROM device d 
								INNER JOIN deviceDataClean dd ON dd.device_id = d.id
									AND dd.created >= ?
									AND dd.created <= ?
							WHERE 1 ${clause}
						) dd
					WHERE NOT ISNULL(val)
					GROUP BY uuid`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])

	// let result = {}
	// let result2 = []
	// rs[0].forEach(row => {
	// 	if (result[row.y] === undefined) {
	// 		result[row.y] = {
	// 			"year": row.y,
	// 			"sum": 0
	// 		}
	// 	}
	// 	result[row.y][row.uuid] = row.val
	// 	result[row.y].sum += parseFloat(row.val)
	// })
	// res.status(200).json(Object.values(result))
})

router.get('/v2/newsec/benchmarkbyday/:reg/:type/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	// let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let select = `SELECT t as date, sum(dd.val) as total, sum(dd.val)/count(*) as value
					FROM (
						SELECT dd.created AS t, 1.000*dd.data->'$.co2' as val, dd.device_id AS did, d.uuid, d.uuname
						FROM device d
							INNER JOIN deviceDataClean dd ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created <= ?
						WHERE d.reg_id = ?
							AND d.type_id = ?
					) dd
					WHERE NOT ISNULL(val)
					GROUP BY t
					ORDER BY t`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, req.params.reg, req.params.type]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, req.params.reg, req.params.type])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	// rs[0].map(d => {
	// 	d.total = parseFloat(d.total)
	// 	d.value = parseFloat(d.value)
	// })
	res.status(200).json(rs[0])
})

router.post('/v2/newsec/benchmarkbyday/:from/:to', async (req, res) => {
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
	console.log(access)
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT t as date, sum(dd.val) as total, sum(dd.val)/count(*) as value
					FROM (
						SELECT dd.created AS t, 1.000*dd.data->'$.co2' as val, dd.device_id AS did, d.uuid, d.uuname
						FROM device d
							INNER JOIN deviceDataClean dd ON dd.device_id = d.id
								AND dd.created >= ?
								AND dd.created <= ?
						WHERE 1 ${clause}
					) dd
					WHERE NOT ISNULL(val)
					GROUP BY t
					ORDER BY t`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})

router.post('/v2/newsec/building/energyusage', async (req, res) => {
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
	let select = `SELECT YEAR(NOW()) as y, SUM(ddc.data->'$.usage' * 1.000) as v, d.name, d.uuid
					FROM deviceDataClean ddc
						INNER JOIN device d ON ddc.device_id = d.id
					WHERE 1 ${clause}
						AND YEAR(ddc.created) = YEAR(NOW())
					GROUP BY d.id`
	console.log(mysqlConn.format(select, [...queryUUIDs]))
	let rs = await mysqlConn.query(select, [...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})

router.get('/v2/newsec/building/emissionyeartodate/:uuid', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let access = await aclClient.testResource(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	let select = `SELECT YEAR(NOW()) as y, SUM(ddc.data->'$.co2' * 1.000) as co2, SUM(ddc.data->'$.co2Budget' * 1.000) as co2Budget, d.name, d.uuid
					FROM deviceDataClean ddc
						INNER JOIN device d ON ddc.device_id = d.id
					WHERE d.uuid = ?
						AND YEAR(ddc.created) = YEAR(NOW())`
	console.log(mysqlConn.format(select, [req.params.uuid]))
	let rs = await mysqlConn.query(select, [req.params.uuid])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0][0])
})

router.get('/v2/newsec/building/emissionbyyear', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	// let access = await aclClient.testResource(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let select = `SELECT YEAR(ddc.created) as y, SUM(ddc.data->'$.co2' * 1.000) as co2, SUM(ddc.data->'$.co2Budget' * 1.000) as co2Budget
					FROM deviceDataClean ddc
						INNER JOIN device d ON ddc.device_id = d.id
					WHERE d.reg_id = 74
						AND d.type_id = 82
					GROUP BY y`
	console.log(mysqlConn.format(select, []))
	let rs = await mysqlConn.query(select, [])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0][0])
})

module.exports = router