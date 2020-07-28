
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
	let select = `SELECT sum(CAST(dd.val AS DECIMAL(10,3))) as val, YEAR(dd.t) as y, dd.did, dd.uuid
					FROM (
						SELECT dd.created AS t, dd.data->'$.co2' as val, dd.device_id AS did, d.uuid
							FROM device d 
								INNER JOIN deviceDataClean dd ON dd.device_id = d.id
							WHERE 1 ${clause}
						) dd
					WHERE NOT ISNULL(val)
					GROUP BY y, uuid
					ORDER BY y, did`
	console.log(mysqlConn.format(select, [...queryUUIDs]))
	let rs = await mysqlConn.query(select, [...queryUUIDs])
	if (rs[0].length === 0) {
		res.status(404).json([])
		return
	}
	let result = {}
	let result2 = []
	rs[0].forEach(row => {
		if (result[row.y] === undefined) {
			result[row.y] = {
				"year": row.y
			}
		}
		result[row.y][row.uuid] = row.val
	})
	res.status(200).json(Object.values(result))
})
module.exports = router