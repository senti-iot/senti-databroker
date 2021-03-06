const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')
const getDataQuery = `SELECT
							dd.data->? as ?,
							dd.data->'$.time' as time,
							dd.created,
							dd.deviceHash
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

const getDeviceDataQuery = `SELECT \`data\`, created
							FROM deviceDataClean
							WHERE deviceHash=? AND \`data\` NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`

router.get('/:version/deviceDataByCustomerID/:customerId/:field/:from/:to/:nId', async (req, res) => {
	let apiV = req.params.version
	let authToken = req.headers.auth
	let customerId = req.params.customerId
	let from = req.params.from
	let to = req.params.to
	let field = req.params.field
	// let nId = req.params.nId
	console.log('Request data for field', field)
	if (verifyAPIVersion(apiV)) {

		if (authenticate(authToken)) {

			console.log(mysqlConn.format(getDataQuery, ['$.' + field, field, customerId, from, to]))
			await mysqlConn.query(getDataQuery, ['$.' + field, field, customerId, from, to]).then(rs => {
				let cleanData = rs[0]
				return res.status(200).json(cleanData)
			}).catch(err => {
				console.log(err, query)
				res.status(500).json({ err, query })
			})
		}
		return res.status(500).json("Error: Invalid token")
	}
	return res.status(500).json("Error: Invalid Version")
})


//MEGA TODO HERE
router.get('/:version/deviceDataByCustomerID/:customerId/:from/:to/:nId', async (req, res) => {
	let apiV = req.params.version
	let authToken = req.headers.auth
	let customerId = req.params.customerId
	let from = req.params.from
	let to = req.params.to
	// let nId = req.params.nId
	console.log('deviceDataByCustomerID', customerId)
	if (verifyAPIVersion(apiV)) {

		if (authenticate(authToken)) {

			await mysqlConn.query(waterWorksQuery, [customerId, from, to]).then(rs => {
				let cleanData = rs[0]
				return res.status(200).json(cleanData)
			}).catch(err => {
				console.log(err, query)
				res.status(500).json({ err, query })
			})
		}
		return res.status(500).json("Error: Invalid token")
	}
	return res.status(500).json("Error: Invalid Version")
})

router.get('/:version/devicedata-clean/:deviceID/:from/:to/:nId', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.deviceID
	let from = req.params.from
	let to = req.params.to
	let nId = req.params.nId
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {

			console.log(deviceID, from, to, nId)
			await mysqlConn.query(getDeviceDataQuery, [deviceID, from, to]).then(async rs => {
				let cleanData = rs[0]
				console.log(cleanData)
				if (nId > 0) {
					let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then(rss => {
						console.log('EngineAPI Status:', rss.status);
						console.log('EngineAPI Response:', rss.data)
						return rss.ok ? rss.data : null
					})
					return res.status(200).json(cData)
				}
				res.status(200).json(cleanData)
			}).catch(err => {
				if (err) {
					console.log(err, query)
					res.status(500).json({ err, query })
				}
			})
		}
	}
})

router.get('/:version/devicedata-clean/:deviceID/:from/:to/:type/:nId/:deviceType?/:chartType?', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let deviceID = req.params.deviceID
	let from = req.params.from
	let to = req.params.to
	let type = req.params.type
	let nId = req.params.nId
	let chartType = parseInt(req.params.chartType)
	let deviceTypeID = req.params.deviceType
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceID === 'all' && deviceTypeID) {
				let q1 = `SELECT AVG(ROUND(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}', 3)) as avrg, SUM(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}') as total from Device_data_clean dd
				left join Device_data_clean ddd
					on dd.device_id = ddd.device_id
					and ddd.created = (
						SELECT Max(created)
						from Device_data_clean
						where created < dd.created and device_id = dd.device_id)
				INNER JOIN Device d on d.id = dd.device_id
				INNER JOIN Device_type dt on dt.id = d.type_id
				where dt.id=? and dd.created >= ? and dd.created <= ?
				ORDER BY dd.created`

				let q2 = `SELECT dd.created, AVG(ROUND(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}', 3)) as avrg, SUM(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}') as total from Device_data_clean dd
				left join Device_data_clean ddd
					on dd.device_id = ddd.device_id
					and ddd.created = (
						SELECT Max(created)
						from Device_data_clean
						where created < dd.created and device_id = dd.device_id)
				INNER JOIN Device d on d.id = dd.device_id
				INNER JOIN Device_type dt on dt.id = d.type_id
				where dt.id=? and dd.created >= ? and dd.created <= ?
				GROUP BY dd.created
				ORDER BY dd.created`

				await mysqlConn.query(chartType === 0 ? q2 : q1, [deviceTypeID, from, to]).then(async rs => {
					let data = rs[0]
					if (chartType === 1) {
						data = rs[0][0]
						data.avrg = parseFloat(parseFloat(data.avrg).toFixed(3))
						data.total = parseFloat(parseFloat(data.total).toFixed(3))
						if (nId > 0) {
							let cData = await engineAPI.post('/', { nIds: [nId], data: data }).then((rss) => {
								console.log('EngineAPI Status:', rss.status);
								console.log('EngineAPI Response', rss.data)
								return rss.ok ? rss.data : null
							})
							res.status(200).json(cData)
						}
						else {
							res.status(200).json(data)
						}
					}
					else {
						let cleanData = {
							avrg: {},
							total: {}
						}
						data.forEach(r => {
							cleanData.avrg[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.avrg
							cleanData.total[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.total
						})
						if (nId > 0) {
							console.log(cleanData)
							let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then((rss) => {
								console.log('EngineAPI Status:', rss.status);
								console.log('EngineAPI Response', rss.data)
								return rss.ok ? rss.data : null
							})
							res.status(200).json(cData)
						}
						else {
							res.status(200).json(cleanData)
						}
					}
				}).catch(err => {
					console.log(err)
				})
			}
			else {
				/**
				 * @Andrei Use This one for data
				 * */
				let query = `SELECT id, \`data\`, created, device_id
				FROM deviceDataClean
				WHERE device_id=? AND NOT ISNULL(\`data\`) AND created >= ? AND created <= ? ORDER BY created`
				console.log(deviceID, from, to, nId)
				console.log(await mysqlConn.format(query, [deviceID, from, to]))
				await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
					let rawData = rs[0]
					let cleanData = {}
					rawData.forEach(r => {
						console.log(type, r.data[type], r.data[type] !== undefined, r.data[type] !== null, (r.data[type] !== undefined || r.data[type] !== null))
						if (r.data[type] !== undefined && r.data[type] !== null) {
							cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[type]
						}
					})
					console.log(rawData[0])
					console.log(cleanData[0])
					if (nId > 0) {
						let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then(rss => {
							console.log('EngineAPI Status:', rss.status);
							console.log('EngineAPI Response:', rss.data)

							return rss.ok ? rss.data : null
						})
						return res.status(200).json(cData)
					}
					res.status(200).json(cleanData)
				}).catch(err => {
					if (err) { res.status(500).json({ err, query }) }
				})
			}
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})


module.exports = router
