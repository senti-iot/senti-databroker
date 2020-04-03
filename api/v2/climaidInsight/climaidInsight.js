const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
// const aclClient = require('../../../server').aclClient

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const deviceService = new sentiDeviceService(mysqlConn)

const colorState = (d, cfg) => {
	let T_color = 1
	if (cfg.T_ben1 > d.T || cfg.T_ben6 < d.T) {
		T_color = 4
	} else if (d.T < cfg.T_ben2 || cfg.T_ben5 < d.T) {
		T_color = 3
	} else if (d.T < cfg.T_ben3 || cfg.T_ben4 < d.T) {
		T_color = 2
	}
	let RH_color = 1
	if (cfg.RH_ben1 > d.RH || cfg.RH_ben6 < d.RH) {
		RH_color = 4
	} else if (d.RH < cfg.RH_ben2 || cfg.RH_ben5 < d.RH) {
		RH_color = 3
	} else if (d.RH < cfg.RH_ben3 || cfg.RH_ben4 < d.RH) {
		RH_color = 2
	}
	let CO2_color = 1
	if (d.CO2 !== null) {
		if (d.CO2 > cfg.CO2_ben3) {
			CO2_color = 4
		} else if (d.CO2 > cfg.CO2_ben2) {
			CO2_color = 3
		} else if (d.CO2 > cfg.CO2_ben1) {
			CO2_color = 2
		}
	}
	return { ts: d.ts, color: Math.max(T_color, RH_color, CO2_color) }
}

router.post('/v2/climaidinsight/qualitative/byhour/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	if (!(req.body && req.body.devices)) {
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
					sum(data->'$.cold') as cold,
					sum(data->'$.warm') as warm,
					sum(data->'$.noisy') as noisy,
					sum(data->'$.tired') as tired,
					sum(data->'$.windy') as windy,
					sum(data->'$.blinded') as blinded,
					sum(data->'$.heavyair') as heavyair,
					sum(data->'$.lighting') as lighting,
					sum(data->'$.itchyeyes') as itchyeyes,
					sum(data->'$.concentration') as concentration
				FROM deviceDataClean ddc
				WHERE ddc.created >= ? 
					AND ddc.created < ?
					${clause}
				GROUP BY DATE(created), HOUR(created)`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})

router.post('/v2/climaidinsight/colorstate/room', async (req, res) => {
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
						SUM(t)/count(*) AS T_rel,
						SUM(h)/count(*) AS RH_rel,
						SUM(co2)/count(*) AS CO2_rel
					FROM (
						SELECT data->'$.temperature' AS t, data->'$.humidity' AS h,  data->'$.co2' AS co2, d.device_id, d.created
						FROM (
							SELECT ddc.device_id, MAX(ddc.created) AS created
							FROM deviceDataClean ddc
							WHERE 1
								${clause}
							GROUP BY ddc.device_id
						) t
						INNER JOIN deviceDataClean d ON t.device_id=d.device_id AND t.created=d.created
					) t2`
	console.log(mysqlConn.format(select, [...queryUUIDs]))
	let rs = await mysqlConn.query(select, [...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(colorState({ T: rs[0][0].T_rel, RH: rs[0][0]. RH_rel, CO2: rs[0][0].CO2_rel }, req.body.config))
})
router.post('/v2/climaidinsight/colorstate/building/:from/:to', async (req, res) => {
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
					sum(data->'$.co2')/count(*) as CO2_gen60
				FROM deviceDataClean ddc
				WHERE ddc.created >= ? 
					AND ddc.created < ?
					${clause}
				GROUP BY DATE(created), HOUR(created)`
	// console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	let result = rs[0].map((d) => {
		return colorState({ T: d.T_gen60, RH: d.RH_gen60, CO2: d.CO2_gen60 }, req.body.config)
	})
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