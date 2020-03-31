const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
// const aclClient = require('../../../server').aclClient

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const deviceService = new sentiDeviceService(mysqlConn)


router.post('/v2/climaidinsight/heatmap/building/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	if (!(req.body && req.body.devices && req.body.config)) {
		res.status(400).json()
		return
	}
	let queryUUIDs = (req.body.devices.length) ? req.body.devices : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT 
					CONCAT(date(created), ' ', hour(created)) AS ts, 
					sum(data->'$.temperature')/count(*) as T_gen60,
					sum(data->'$.humidity')/count(*) as RH_gen60,
					sum(data->'$.co2')/count(*) as CO2_gen60,
					sum(data->'$.temperature')/count(*) as T_rel,
					sum(data->'$.humidity')/count(*) as RH_rel,
					sum(data->'$.co2')/count(*) as CO2_rel
				FROM deviceDataClean ddc
				WHERE ddc.created >= ? 
					AND ddc.created < ?
					${clause}
				GROUP BY DATE(created), HOUR(created)`
	// console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])

	// test = {
	// 	ts: '2020-03-31 14',
	// 	T_gen60: 22.8267,
	// 	RH_gen60: 18.5667,
	// 	CO2_gen60: 324.0833,
	// 	T_rel: 22.8267,
	// 	RH_rel: 18.5667,
	// 	CO2_rel: 324.0833
	// }
	// testRel = {
	// 	ts: '2020-03-31 14',
	// 	T_rel: 23.4200,
	// 	RH_rel: 16.8000,
	// 	CO2_rel: 322.0000
	// }

	// testReal = {...test, ...testRel}

	// let skod = [testReal, testReal]

	// console.log(skod)

	// let ddd = skod.map(testColor)
	// console.log(ddd)
	//console.log(testReal, testColor(testReal))

	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	if (rs[0].length === 1) {
		let selectLatest = `SELECT 
							CONCAT(date(created), ' ', hour(created)) AS ts, 
							SUM(t)/count(*) AS T_rel,
							SUM(h)/count(*) AS RH_rel,
							SUM(co2)/count(*) AS CO2_rel
						FROM (
							SELECT data->'$.temperature' AS t, data->'$.humidity' AS h,  data->'$.co2' AS co2, d.device_id, d.created
							FROM (
								SELECT ddc.device_id, MAX(ddc.created) AS created
								FROM deviceDataClean ddc
								WHERE ddc.created >= ?
									AND ddc.created < ?
									${clause}
								GROUP BY ddc.device_id
							) t
							INNER JOIN deviceDataClean d ON t.device_id=d.device_id AND t.created=d.created
						) t2`
		// console.log(mysqlConn.format(selectLatest, [req.params.from, req.params.to, ...queryUUIDs]))
		let rsLatest = await mysqlConn.query(selectLatest, [req.params.from, req.params.to, ...queryUUIDs])
		if (rsLatest[0].length === 1) {
			rs[0][0] = { ...rs[0][0], ...rsLatest[0][0] }
			console.log(rs[0][0])
		}
	}

	const testColor = (d) => {
		let cfg = req.body.config
		let T_color = 1
		if (cfg.T_ben1 > d.T_gen60 || cfg.T_ben6 < d.T_rel) {
			T_color = 4
		} else if (d.T_gen60 < cfg.T_ben2 || cfg.T_ben5 < d.T_rel) {
			T_color = 3
		} else if (d.T_gen60 < cfg.T_ben3 || cfg.T_ben4 < d.T_rel) {
			T_color = 2
		}
		let RH_color = 1
		if (cfg.RH_ben1 > d.RH_gen60 || cfg.RH_ben6 < d.RH_rel) {
			RH_color = 4
		} else if (d.RH_gen60 < cfg.RH_ben2 || cfg.RH_ben5 < d.RH_rel) {
			RH_color = 3
		} else if (d.RH_gen60 < cfg.RH_ben3 || cfg.RH_ben4 < d.RH_rel) {
			RH_color = 2
		}
		let CO2_color = 1
		if (d.CO2_gen60 > cfg.CO2_ben3) {
			CO2_color = 4
		} else if (d.CO2_gen60 > cfg.CO2_ben2) {
			CO2_color = 3
		} else if (d.CO2_gen60 > cfg.CO2_ben1) {
			CO2_color = 2
		}
		console.log(d.ts, T_color, RH_color, CO2_color)
		return { ts: d.ts, color: Math.max(T_color, RH_color, CO2_color) }
	}
	let result = rs[0].map(testColor)
	res.status(200).json(result)

})
router.post('/v2/climaidinsight/heatmap/:field/:from/:to', async (req, res) => {
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
	// let access = await aclClient.testResources(lease.uuid, queryUUIDs, [sentiAclPriviledge.device.read])
	// if (access.allowed === false) {
	// 	res.status(403).json()
	// 	return
	// }
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT CONCAT(date(created), ' ', hour(created)) AS ts, 
					sum(data->?)/count(*) as average
					FROM deviceDataClean ddc
					WHERE ddc.created >= ? AND ddc.created < ?
						AND NOT ISNULL(ddc.data->?) 
						${clause}
					GROUP BY DATE(created), HOUR(created)`
	// console.log(mysqlConn.format(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, ['$.'+req.params.field, req.params.from, req.params.to, '$.'+req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})
module.exports = router