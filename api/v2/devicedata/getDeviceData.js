/** Express router providing user related routes
 * @module routers/devicedata
 * @requires express
 * @requires senti-apicore
 * @requires moment
 */

const moment = require('moment')
const express = require('express')
const router = express.Router()

var mysqlConn = require('../../../mysql/mysql_handler')

const engineAPI = require('../../engine/engine')

const sentiDeviceService = require('../../../lib/device/sentiDeviceService')
const deviceService = new sentiDeviceService(mysqlConn)

// const { sentiAclPriviledge, sentiAclResourceType } = require('senti-apicore')
const { /* aclClient, */ authClient } = require('../../../server')

const getDeviceDataQuery = `SELECT \`data\`, created as datetime
							FROM deviceDataClean
							WHERE device_id=? AND NOT ISNULL(\`data\`) AND created >= ? AND created <= ? ORDER BY created`

const getDeviceDataFieldQuery = field => `SELECT \`data\`->'$.${field}' as \`${field}\`, created as datetime
											FROM deviceDataClean
											WHERE device_id=? AND NOT ISNULL(\`data\`->'$.${field}') AND created >= ? and created <= ? ORDER BY created`


const getDeviceDataFieldGauge = field => `
			SELECT AVG(ROUND(dd.\`data\`->'$.${field}', 3)) as avrg, SUM(dd.\`data\`->'$.${field}') as total from deviceDataClean dd
			INNER JOIN device d on d.id = dd.device_id
			INNER JOIN deviceType dt on dt.id = d.type_id
			WHERE dt.uuid=? and dd.created >= ? and dd.created <= ?
			AND NOT ISNULL(dd.\`data\`->'$.${field}')
			ORDER BY dd.created`

const getDeviceDataFieldTimeSeries = (field, timeType) => {
	let tts = ''
	switch (timeType) {
		case 'minute':
			tts = 'GROUP BY MINUTE(dd.created)'
			break
		case 'hour':
			tts = 'GROUP BY HOUR(dd.created)'
			break
		case 'day':
			tts = 'GROUP BY DAY(dd.created)'
			break;
		case 'month':
			tts = 'GROUP BY MONTH(dd.created)'
			break
		case 'year':
			tts = ' GROUP BY YEAR(dd.created)'
			break
		default:
			tts = 'GROUP BY dd.created'
			break;
	}
	return `
			SELECT dd.created, AVG(ROUND(dd.\`data\`->'$.${field}', 3)) as avrg, SUM(dd.\`data\`->'$.${field}') as total from deviceDataClean dd
			INNER JOIN device d on d.id = dd.device_id
			INNER JOIN deviceType dt on dt.id = d.type_id
			WHERE dt.uuid=? and dd.created >= ? and dd.created <= ?
			AND NOT ISNULL(dd.\`data\`->'$.${field}')
			${tts}
			ORDER BY dd.created`
}

/**
* Route serving the complete clean device data packets for selected period
* @function GET /v2/devicedata-clean/:deviceUUID/:from/:to/:cloudfunctionId
* @memberof module:routers/devicedata
* @param {String} deviceUUID
* @param {Date} from - Start date - YYYY-MM-DD HH:mm:ss format
* @param {Date} to - End date - YYYY-MM-DD HH:mm:ss format
* @param {Number} cloudfunctionId - ID of the outbound cloud function
*/
router.get('/v2/devicedata-clean/:deviceUUID/:from/:to/:cloudfunctionId', async (req, res) => {

	let deviceUUID = req.params.deviceUUID
	let from = req.params.from
	let to = req.params.to
	let cloudfunctionId = req.params.cloudfunctionId

	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	console.log(deviceUUID, from, to, cloudfunctionId)

	let deviceId = await deviceService.getIdByUUID(deviceUUID)
	let query = mysqlConn.format(getDeviceDataQuery, [deviceId, from, to])
	await mysqlConn.query(getDeviceDataQuery, [deviceId, from, to]).then(async rs => {
		let cleanData = rs[0]
		console.log(cleanData)
		if (cloudfunctionId > 0) {
			let cData = await engineAPI.post('/', { nIds: [cloudfunctionId], data: cleanData }).then(rss => {
				console.log('EngineAPI Status:', rss.status)
				console.log('EngineAPI Response:', rss.data)
				return rss.ok ? rss.data : null
			})
			return res.status(200).json(cData)
		}
		res.status(200).json(cleanData)
	}).catch(err => {
		if (err) {
			console.log(err)
			res.status(500).json({ err, query })
		}
	})

})

/**
* Route serving the clean device data packets for selected period and specified field
* @function GET /v2/devicedata-clean/:deviceUUID/:field/:from/:to/:cloudfunctionId
* @memberof module:routers/devicedata
* @param {String} deviceUUID
* @param {String} field
* @param {Date} from - Start date - YYYY-MM-DD HH:mm:ss format
* @param {Date} to - End date - YYYY-MM-DD HH:mm:ss format
* @param {Number} cloudfunctionId - ID of the outbound cloud function
*/
router.get('/v2/devicedata-clean/:deviceUUID/:field/:from/:to/:cloudfunctionId', async (req, res) => {

	let deviceUUID = req.params.deviceUUID
	let field = req.params.field
	let from = req.params.from
	let to = req.params.to
	let cloudfunctionId = req.params.cloudfunctionId

	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	console.log(deviceUUID, field, from, to, cloudfunctionId)

	let deviceId = await deviceService.getIdByUUID(deviceUUID)
	let query = mysqlConn.format(getDeviceDataFieldQuery(field), [deviceId, from, to])
	await mysqlConn.query(getDeviceDataFieldQuery(field), [deviceId, from, to]).then(async rs => {
		let cleanData = rs[0]
		console.log(cleanData)
		if (cloudfunctionId > 0) {
			let cData = await engineAPI.post('/', { nIds: [cloudfunctionId], data: cleanData }).then(rss => {
				console.log('EngineAPI Status:', rss.status)
				console.log('EngineAPI Response:', rss.data)
				return rss.ok ? rss.data : null
			})
			return res.status(200).json(cData)
		}
		res.status(200).json(cleanData)
	}).catch(err => {
		if (err) {
			console.log(err)
			res.status(500).json({ err, query })
		}
	})

})

/**
* Route serving the total and average clean device data packets for selected devicetype, selected period, specified field and time type
* @function GET /v2/devicedata-clean/:deviceUUID/:field/:from/:to/:cloudfunctionId
* @memberof module:routers/devicedata
* @param {String} deviceUUID
* @param {String} field
* @param {Date} from - Start date - YYYY-MM-DD HH:mm:ss format
* @param {Date} to - End date - YYYY-MM-DD HH:mm:ss format
* @param {String} timeType - type of time - minute, hour, day, month, year
* @param {Number} cfId - ID of the outbound cloud function
*/
router.get('/v2/devicedata-clean/all/:from/:to/:field/:deviceTypeUUID/timeseries/:timeType/:cfId?', async (req, res) => {

	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let from = req.params.from
	let to = req.params.to
	let field = req.params.field
	let cfId = req.params.cfId
	let dtUUID = req.params.deviceTypeUUID
	let timeType = req.params.timeType

	let query = getDeviceDataFieldTimeSeries(field, timeType)
	// let query = await mysqlConn.format(getDeviceDataFieldTimeSeries(field), [dtUUID, from, to])
	let formatsql = await mysqlConn.format(getDeviceDataFieldTimeSeries(field, timeType), [dtUUID, from, to])
	await mysqlConn.query(query, [dtUUID, from, to]).then(async rs => {
		let data = rs[0]
		console.log(data)
		let cleanData = {
			avrg: {},
			total: {}
		}
		data.forEach(r => {
			cleanData.avrg[moment(r.created).startOf(timeType).format('YYYY-MM-DD HH:mm:ss')] = r.avrg
			cleanData.total[moment(r.created).startOf(timeType).format('YYYY-MM-DD HH:mm:ss')] = r.total
		})
		if (cfId > 0) {
			console.log(cleanData)
			let cData = await engineAPI.post('/', { nIds: [cfId], data: cleanData }).then((rss) => {
				console.log('EngineAPI Status:', rss.status)
				console.log('EngineAPI Response', rss.data)
				return rss.ok ? rss.data : null
			})
			res.status(200).json(cData)
		}
		else {
			res.status(200).json(cleanData)
		}

	}).catch(err => {
		console.log(err)
		res.status(500).json({
			err, formatsql
		})
	})

})

/**
* Route serving the total and average clean device data packets for selected devicetype for the selected period and specified field
* @function GET /v2/devicedata-clean/:deviceUUID/:field/:from/:to/:cloudfunctionId
* @memberof module:routers/devicedata
* @param {String} deviceUUID
* @param {String} field
* @param {Date} from - Start date - YYYY-MM-DD HH:mm:ss format
* @param {Date} to - End date - YYYY-MM-DD HH:mm:ss format
* @param {String} timeType - type of time - minute, hour, day, month, year
* @param {Number} cfId - ID of the outbound cloud function
*/

router.get('/v2/devicedata-clean/all/:from/:to/:field/:deviceTypeUUID/gauge/:cfId?', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}

	let from = req.params.from
	let to = req.params.to
	let field = req.params.field
	let cfId = req.params.cfId
	let dtUUID = req.params.deviceTypeUUID

	let query = getDeviceDataFieldGauge(field)
	// let query = await mysqlConn.format(getDeviceDataFieldTimeSeries(field), [dtUUID, from, to])
	let formatsql = await mysqlConn.format(getDeviceDataFieldTimeSeries(field), [dtUUID, from, to])
	await mysqlConn.query(query, [dtUUID, from, to]).then(async rs => {
		// let data = rs[0]
		let data = rs[0][0]
		data.avrg = parseFloat(parseFloat(data.avrg).toFixed(3))
		data.total = parseFloat(parseFloat(data.total).toFixed(3))
		if (cfId > 0) {
			let cData = await engineAPI.post('/', { nIds: [cfId], data: data }).then((rss) => {
				console.log('EngineAPI Status:', rss.status)
				console.log('EngineAPI Response', rss.data)
				return rss.ok ? rss.data : null
			})
			res.status(200).json(cData)
		}
		else {
			res.status(200).json(data)
		}
	}).catch(err => {
		if (err) { res.status(500).json({ err, formatsql }) }
	})
})


// router.get('/v2/devicedata-clean/:deviceID/:from/:to/:type/:nId/:deviceType?/:chartType?', async (req, res) => {
// 	let apiVersion = req.params.version
// 	let authToken = req.headers.auth
// 	let deviceID = req.params.deviceID
// 	let from = req.params.from
// 	let to = req.params.to
// 	let type = req.params.type
// 	let nId = req.params.nId
// 	let chartType = parseInt(req.params.chartType)
// 	let deviceTypeID = req.params.deviceType
// 	if (verifyAPIVersion(apiVersion)) {
// 		if (authenticate(authToken)) {
// 			//This is the "benchmark" and "total" for all devices in a specified period
// 			if (deviceID === 'all' && deviceTypeID) {
// 				//Q1 is chart
// 				let q1 = `SELECT AVG(ROUND(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}', 3)) as avrg, SUM(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}') as total from Device_data_clean dd
// 				left join Device_data_clean ddd
// 					on dd.device_id = ddd.device_id
// 					and ddd.created = (
// 						SELECT Max(created)
// 						from Device_data_clean
// 						where created < dd.created and device_id = dd.device_id)
// 				INNER JOIN Device d on d.id = dd.device_id
// 				INNER JOIN Device_type dt on dt.id = d.type_id
// 				where dt.id=? and dd.created >= ? and dd.created <= ?
// 				ORDER BY dd.created`
// 				//Q2 is Gauge
// 				let q2 = `SELECT dd.created, AVG(ROUND(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}', 3)) as avrg, SUM(dd.\`data\`->'$.${type}' - ddd.\`data\`->'$.${type}') as total from Device_data_clean dd
// 				left join Device_data_clean ddd
// 					on dd.device_id = ddd.device_id
// 					and ddd.created = (
// 						SELECT Max(created)
// 						from Device_data_clean
// 						where created < dd.created and device_id = dd.device_id)
// 				INNER JOIN Device d on d.id = dd.device_id
// 				INNER JOIN Device_type dt on dt.id = d.type_id
// 				where dt.id=? and dd.created >= ? and dd.created <= ?
// 				GROUP BY dd.created
// 				ORDER BY dd.created`

// 				await mysqlConn.query(chartType === 0 ? q2 : q1, [deviceTypeID, from, to]).then(async rs => {
// 					let data = rs[0]
// 					if (chartType === 1) {
// 						data = rs[0][0]
// 						data.avrg = parseFloat(parseFloat(data.avrg).toFixed(3))
// 						data.total = parseFloat(parseFloat(data.total).toFixed(3))
// 						if (nId > 0) {
// 							let cData = await engineAPI.post('/', { nIds: [nId], data: data }).then((rss) => {
// 								console.log('EngineAPI Status:', rss.status)
// 								console.log('EngineAPI Response', rss.data)
// 								return rss.ok ? rss.data : null
// 							})
// 							res.status(200).json(cData)
// 						}
// 						else {
// 							res.status(200).json(data)
// 						}
// 					}
// 					else {
// 						let cleanData = {
// 							avrg: {},
// 							total: {}
// 						}
// 						data.forEach(r => {
// 							cleanData.avrg[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.avrg
// 							cleanData.total[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.total
// 						})
// 						if (nId > 0) {
// 							console.log(cleanData)
// 							let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then((rss) => {
// 								console.log('EngineAPI Status:', rss.status)
// 								console.log('EngineAPI Response', rss.data)
// 								return rss.ok ? rss.data : null
// 							})
// 							res.status(200).json(cData)
// 						}
// 						else {
// 							res.status(200).json(cleanData)
// 						}
// 					}
// 				}).catch(err => {
// 					console.log(err)
// 				})
// 			}
// 			else {

// 				let query = `SELECT id, \`data\`, created, device_id
// 				FROM deviceDataClean
// 				WHERE device_id=? AND NOT ISNULL(\`data\`) AND created >= ? AND created <= ? ORDER BY created`
// 				console.log(deviceID, from, to, nId)
// 				console.log(await mysqlConn.format(query, [deviceID, from, to]))
// 				await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
// 					let rawData = rs[0]
// 					let cleanData = {}
// 					rawData.forEach(r => {
// 						console.log(type, r.data[type], r.data[type] !== undefined, r.data[type] !== null, (r.data[type] !== undefined || r.data[type] !== null))
// 						if (r.data[type] !== undefined && r.data[type] !== null) {
// 							cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[type]
// 						}
// 					})
// 					console.log(rawData[0])
// 					console.log(cleanData[0])
// 					if (nId > 0) {
// 						let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then(rss => {
// 							console.log('EngineAPI Status:', rss.status)
// 							console.log('EngineAPI Response:', rss.data)

// 							return rss.ok ? rss.data : null
// 						})
// 						return res.status(200).json(cData)
// 					}
// 					res.status(200).json(cleanData)
// 				}).catch(err => {
// 					if (err) { res.status(500).json({ err, query }) }
// 				})
// 			}
// 		} else {
// 			res.status(403).json('Unauthorized Access! 403')
// 			console.log('Unauthorized Access!')
// 		}
// 	} else {
// 		console.log(`API/sigfox version: ${apiVersion} not supported`)
// 		res.send(`API/sigfox version: ${apiVersion} not supported`)
// 	}
// })


module.exports = router
