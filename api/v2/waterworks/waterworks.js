const express = require('express')
const router = express.Router()
const moment = require('moment')

var mysqlConn = require('../../../mysql/mysql_handler')

const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const authClient = require('../../../server').authClient
const aclClient = require('../../../server').aclClient
const secureMqttClient = require('../../../server').secureMqttClient

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
// const tagManager = require('../../engine/tagManager')

const deviceService = new sentiDeviceService(mysqlConn)

/**
 * Test ACL access to device based on Org UUID and Device UUName
 * @param orguuid - Organisation UUID
 * @param uuname - Device uuname
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

/**
 * ACL
 * Register device to ACL based on device id
 * @param deviceid
*/
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

/**
 * ACL
 * Add device to user based on device UUID and user UUID
 * @param deviceuuid
 * @param useruuid
 */
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

/**
 * Alarms
 */
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


// router.post('/v2/waterworks/data/benchmark/:from/:to', async (req, res) => {
// 	let lease = await authClient.getLease(req)
// 	if (lease === false) {
// 		res.status(401).json()
// 		return
// 	}
// 	let access = await aclClient.testResources(lease.uuid, req.body, [sentiAclPriviledge.device.read])
// 	console.log(access)
// 	if (access.allowed === false) {
// 		res.status(403).json()
// 		return
// 	}
// 	res.status(200).json(access)
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
// })

module.exports = router