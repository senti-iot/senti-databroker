const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
// const aclClient = require('../../../server').aclClient

// const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
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
router.get('/v2/climaidinsight/northq/occupancy/:registry/:min/:prhour', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT device_id, IF(ppmperhour > ? OR co2 > ?, 1 , 0) AS occupancy
					FROM (
						SELECT device_id, co2diff*3600/co2time AS ppmperhour, co2, oldco2
						FROM (
							SELECT device_id, time_to_sec(timediff(recent, older)) AS co2time, co2-oldco2 AS co2diff, co2, oldco2
							FROM (
								SELECT t2.device_id, t2.co2, t2.recent, DDC.created AS older, DDC.data->'$.co2'*1.0 AS oldco2
								FROM (
									SELECT t1.*, maX(DDC.id) AS oldid
									FROM (
										SELECT DDC.device_id, DDC.data->'$.co2'*1.0 AS co2, DDC.created AS recent
										FROM (
											SELECT max(id) AS id
											FROM sentidatastorage.deviceDataClean DDC 
											WHERE DDC.device_id IN (
												SELECT D.id 
												FROM sentidatastorage.registry R
												INNER JOIN sentidatastorage.device D ON D.reg_id=R.id AND D.deleted=0
												WHERE R.uuid=? 
											)
											AND DDC.created > DATE_SUB(NOW(), interval 60 minute) AND NOT ISNULL(DDC.data->'$.co2')
											GROUP BY DDC.device_id
										) t
										INNER JOIN sentidatastorage.deviceDataClean DDC  ON DDC.id=t.id
									) t1
									INNER JOIN sentidatastorage.deviceDataClean DDC ON DDC.device_id=t1.device_id AND DDC.created<DATE_SUB(recent,INTERVAL 60 MINUTE) AND DDC.created>DATE_SUB(recent, INTERVAL 120 MINUTE) AND NOT ISNULL(DDC.data->'$.co2')
									GROUP BY DDC.device_id
								) t2
								INNER JOIN sentidatastorage.deviceDataClean DDC ON t2.oldid=DDC.id
							) t3
						) t4
					) t5`
	console.log(mysqlConn.format(select, [req.params.prhour, req.params.min, req.params.registry]))
	let rs = await mysqlConn.query(select, [req.params.prhour, req.params.min, req.params.registry])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})
router.get('/v2/climaidinsight/northq/kkpressed/:registry', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	let select = `SELECT t.device_id, IF(cold>0, 1,0) AS kkpressed, recent as mostrecent
					FROM (
						SELECT DDC.device_id, SUM(DDC.data->'$.cold'*1.0) AS cold, count(*) AS antal, MAX(DDC.created) AS recent
						FROM (
							SELECT D.id 
							FROM sentidatastorage.registry R
							INNER JOIN sentidatastorage.device D ON D.reg_id=R.id AND D.deleted=0
							WHERE R.uuid=? 
						) D
						LEFT JOIN sentidatastorage.deviceDataClean DDC ON DDC.device_id=D.id
						WHERE DDC.created > DATE_SUB(NOW(), interval 60 minute) AND NOT ISNULL(DDC.data->'$.cold')
						GROUP BY D.id
					) t`
	console.log(mysqlConn.format(select, [req.params.registry]))
	let rs = await mysqlConn.query(select, [req.params.registry])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})

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
					UNIX_TIMESTAMP(CAST(CONCAT(date(created), ' ', hour(created))  AS DATETIME)) as uts,
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

router.post('/v2/climaidinsight/qualitative/byday/:from/:to', async (req, res) => {
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
					date(created) AS ts,
					UNIX_TIMESTAMP(date(created)) as uts,
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
				GROUP BY DATE(created)`
	console.log(mysqlConn.format(select, [req.params.from, req.params.to, ...queryUUIDs]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.to, ...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})

router.post('/v2/climaidinsight/activity/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	if (!(req.body && req.body.devices && req.body.config)) {
		res.status(400).json()
		return
	}
	let firstday = (req.body.config.firstday) ? req.body.config.firstday : 0
	let lastday = (req.body.config.lastday) ? req.body.config.lastday : 4
	let firsthour = (req.body.config.firsthour) ? req.body.config.firsthour : 7
	let lasthour = (req.body.config.lasthour) ? req.body.config.lasthour : 16

	let queryUUIDs = (req.body.devices.length) ? req.body.devices : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT avg(motion) * 100 as value, max(ts) as date
	FROM (
	SELECT avg(IF(m+mCO2>0,1,0)) AS motion, date(ts) as ts
	FROM (
		SELECT SUM(motion) AS m, avg(co2), SUM(IF(co2>450, 1,0)) AS mCO2, date_add(date_add(d, INTERVAL h hour), INTERVAL q*15 MINUTE) AS ts, d, h,q, did
		FROM (
			SELECT    ddc.created AS ts
					, ddc.data->'$.motion' as motion
					, ddc.data->'$.co2' as co2
					, DATE(ddc.created) AS d
					, HOUR(ddc.created) AS h
					, floor(MINUTE(ddc.created) / 15) AS q
					, ddc.device_id as did
			FROM     deviceDataClean ddc
			WHERE 1 ${clause}
					AND ddc.created >= ?
					AND ddc.created < ?
					AND weekday(created) between ? AND  ? AND HOUR(created) between ? and ?
		)t
		GROUP BY did, d, h, q
	) tt
	GROUP BY date(ts)
	) t3`
	console.log(mysqlConn.format(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour]))
	let rs = await mysqlConn.query(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour])
	if (rs[0].length !== 1) {
		res.status(400).json([])
		return
	}
	res.status(200).json(rs[0][0])
})
router.post('/v2/climaidinsight/activity/byquarter/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	if (!(req.body && req.body.devices && req.body.config)) {
		res.status(400).json()
		return
	}
	let firstday = (req.body.config.firstday) ? req.body.config.firstday : 0
	let lastday = (req.body.config.lastday) ? req.body.config.lastday : 4
	let firsthour = (req.body.config.firsthour) ? req.body.config.firsthour : 7
	let lasthour = (req.body.config.lasthour) ? req.body.config.lasthour : 16

	let queryUUIDs = (req.body.devices.length) ? req.body.devices : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT avg(IF(m+mCO2>0,1,0)) * 100 AS value, ts AS date
					FROM (
						SELECT SUM(motion) AS m, avg(co2), SUM(IF(co2>450, 1,0)) AS mCO2, date_add(date_add(d, INTERVAL h hour), INTERVAL q*15 MINUTE) AS ts, d, h,q, did
						FROM (
							SELECT    ddc.created AS ts
									, ddc.data->'$.motion' as motion
									, ddc.data->'$.co2' as co2
									, DATE(ddc.created) AS d
									, HOUR(ddc.created) AS h
									, floor(MINUTE(ddc.created) / 15) AS q
									, ddc.device_id as did
							FROM     deviceDataClean ddc
							WHERE 1 ${clause}
								AND ddc.created >= ?
								AND ddc.created < ?
								AND weekday(created) between ? AND  ? AND HOUR(created) between ? and ?
							)t
						GROUP BY did, d, h, q
					) tt
					GROUP BY ts`
	console.log(mysqlConn.format(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour]))
	let rs = await mysqlConn.query(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	res.status(200).json(rs[0])
})
router.post('/v2/climaidinsight/activity/byhour/:from/:to', async (/* req, res */) => {
	// { devices: [1,2,3], config: { firsthour: 07, lasthour: 16} }

})
router.post('/v2/climaidinsight/activity/byday/:from/:to', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	if (!(req.body && req.body.devices && req.body.config)) {
		res.status(400).json()
		return
	}
	let firstday = (req.body.config.firstday) ? req.body.config.firstday : 0
	let lastday = (req.body.config.lastday) ? req.body.config.lastday : 4
	let firsthour = (req.body.config.firsthour) ? req.body.config.firsthour : 7
	let lasthour = (req.body.config.lasthour) ? req.body.config.lasthour : 16

	let queryUUIDs = (req.body.devices.length) ? req.body.devices : []
	if (queryUUIDs.length === 0) {
		res.status(404).json([])
		return
	}
	let clause = (queryUUIDs.length > 0) ? ' AND ddc.device_id IN (?' + ",?".repeat(queryUUIDs.length - 1) + ') ' : ''
	let select = `SELECT avg(IF(m+mCO2>0,1,0)) * 100 AS value, date(ts) AS date
					FROM (
						SELECT SUM(motion) AS m, avg(co2), SUM(IF(co2>450, 1,0)) AS mCO2, date_add(date_add(d, INTERVAL h hour), INTERVAL q*15 MINUTE) AS ts, d, h,q, did
						FROM (
							SELECT    ddc.created AS ts
									, ddc.data->'$.motion' as motion
									, ddc.data->'$.co2' as co2
									, DATE(ddc.created) AS d
									, HOUR(ddc.created) AS h
									, floor(MINUTE(ddc.created) / 15) AS q
									, ddc.device_id as did
							FROM     deviceDataClean ddc
							WHERE 1 ${clause}
								AND ddc.created >= ?
								AND ddc.created < ?
								AND weekday(created) between ? AND  ? AND HOUR(created) between ? and ?
						)t
						GROUP BY did, d, h, q
					) tt
					GROUP BY date(ts)`
	console.log(mysqlConn.format(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour]))
	let rs = await mysqlConn.query(select, [...queryUUIDs, req.params.from, req.params.to, firstday, lastday, firsthour, lasthour])
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
	res.status(200).json(colorState({ ts: rs[0][0].ts, T: rs[0][0].T_rel, RH: rs[0][0]. RH_rel, CO2: rs[0][0].CO2_rel }, req.body.config))
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
		return colorState({ ts: d.ts, T: d.T_gen60, RH: d.RH_gen60, CO2: d.CO2_gen60 }, req.body.config)
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
	let rs = await mysqlConn.query(select, ['$.' + req.params.field, req.params.from, req.params.to, '$.' + req.params.field, ...queryUUIDs])
	res.status(200).json(rs[0])
})

router.get('/v2/climaidinsight/activeminutes/:device/:from/:to/', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let select = `SELECT *
					FROM (
					SELECT SUM(activeseconds)/60.0 AS activeminutes, ts
					FROM (
						SELECT	time_to_sec(TIMEDIFF(tt.tots, tt.fromts)) * tt.activity*1.0 AS activeseconds, date_add(DATE(tt.tots), INTERVAL HOUR(tt.tots) HOUR) AS ts
						FROM (
							SELECT	IF(f.created<?, ?, f.created) as fromts,
									IF(t.created>=?, DATE_SUB(?, INTERVAL 1 SECOND), t.created) AS tots,
									t.activity
							FROM (
								SELECT f.*
								FROM (
									select @a:=0
								) d
								INNER JOIN (
									SELECT if(DDC.data->'$.motion'>2,1.0,0.0) AS activity, DDC.created, @a:=@a+1 AS r
									FROM sentidatastorage.deviceDataClean DDC
									WHERE DDC.created>=DATE_SUB(?, INTERVAL 1 HOUR) AND DDC.created < DATE_ADD(?, INTERVAL 1 HOUR) AND DDC.device_id=? 
									ORDER BY created
								) f ON 1
							) f
							INNER JOIN  (
								SELECT t.*
								FROM (
									select @aa:=0
								) d
								INNER JOIN (
									SELECT if(DDC.data->'$.motion'>2,1,0) AS activity, DDC.created, @aa:=@aa+1 AS r
									FROM sentidatastorage.deviceDataClean DDC
									WHERE DDC.created>=DATE_SUB(?, INTERVAL 1 HOUR) AND DDC.created < DATE_add(?, INTERVAL 1 HOUR) AND DDC.device_id=? 
									ORDER BY created
								) t ON 1
							) t ON f.r=t.r-1
						) tt
					) ttt
					GROUP BY ts
					) t4
					WHERE ts>=? AND ts<?`;
	console.log(mysqlConn.format(select, [req.params.from, req.params.from, req.params.to, req.params.to, req.params.from, req.params.to, req.params.device, req.params.from, req.params.to, req.params.device, req.params.from, req.params.to]))
	let rs = await mysqlConn.query(select, [req.params.from, req.params.from, req.params.to, req.params.to, req.params.from, req.params.to, req.params.device, req.params.from, req.params.to, req.params.device, req.params.from, req.params.to])
	console.log(rs);
	res.status(200).json(rs[0])
})

module.exports = router