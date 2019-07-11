const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')
const tokenAPI = require('../engine/token')

router.get('/:token/devicedata/:deviceID/:from/:to/', async (req, res, next) => {
	let token = req.params.token
	let deviceID = req.params.deviceID
	let to = req.params.to
	let from = req.params.from
	let selectDeviceIDQ = `SELECT id from Device where uuid=?`
	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/${deviceID}`).then(rs => rs.data)
	if (isValid) {
		let query = `SELECT \`data\`
		FROM Device_data_clean	
		WHERE device_id=? AND \`data\` NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`
		await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
			let rawData = rs[0]
			res.status(200).json(rawData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(query, [deviceID, from, to]) }) }
		})
	}
	else {
		res.status(500).json({error: "Invalid Token"})
	}
})
router.get('/:token/devicedata/:deviceID/:from/:to/:dataKey/:cfId?', async (req, res, next) => {
	let token = req.params.token
	let deviceID = req.params.deviceID
	let to = req.params.to
	let from = req.params.from
	let cfId = req.params.cfId
	let dataKey = req.params.dataKey
	let selectDeviceIDQ = `SELECT id from Device where uuid=?`
	deviceID = await mysqlConn.query(selectDeviceIDQ, [deviceID]).then(rs => rs[0][0].id)
	let isValid = await tokenAPI.get(`validateToken/${token}/${deviceID}`).then(rs => rs.data)
	if (isValid) {
		let query = `SELECT id, \`data\`, created, device_id
		FROM Device_data_clean	
		WHERE device_id=? AND \`data\` NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`
		await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
			let rawData = rs[0]
			let cleanData = {}
			// console.log('HERE', rawData)
			rawData.forEach(r => {
				console.log('bing', r.data, dataKey)
				if (r.data[dataKey])
					cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[dataKey]
					console.log(cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] )
			})
			console.log(rawData)
			console.log(cleanData)
			if (cfId > 0) {
				let cData = await engineAPI.post('/', { nIds: [cfId], data: cleanData }).then(rss => {
					console.log('EngineAPI Status:', rss.status);
					console.log('EngineAPI Response', rss.data)
					return rss.ok ? rss.data : null
				})
				return res.status(200).json(cData)
			}
			res.status(200).json(cleanData)
		}).catch(err => {
			if (err) { res.status(500).json({ err, query: mysqlConn.format(query, [deviceID, from, to]) }) }
		})
	}
	else {
		res.status(500).json({error: "Invalid Token"})
	}
})

router.get('/:version/devicedata-clean/:deviceID/:from/:to/:type/:nId/:deviceType?/:chartType?', async (req, res, next) => {
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
				// let q1 = `SELECT (sum(c.\`data\`->>'$.${type}')/count(c.\`data\`)) as avrg from Device_data_clean c
				// Inner join Device d on d.id = c.device_id
				// where d.type_id = ? and created >= ? AND created <= ? ORDER BY created and \`data\`->>'$.${type}' not like '%null%'`
				// let q2 = `SELECT created, AVG(\`data\`->>'$.${type}') as avrg from Device_data_clean
				// inner join Device d on d.id = device_id
				// where d.type_id = ? and \`data\`->>'$.${type}' not like '%null%' and created >= ? AND created <= ?
				// group by created
				// order by created asc`
				console.log(chartType)
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

				let query = `SELECT id, \`data\`, created, device_id
				FROM Device_data_clean	
				WHERE device_id=? AND \`data\` NOT LIKE '%null%' AND created >= ? AND created <= ? ORDER BY created`
				console.log(deviceID, from, to, nId)
				await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
					let rawData = rs[0]
					let cleanData = {}
					rawData.forEach(r => {
						if (r.data[type] !== undefined || r.data[type] !== null)
							cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[type]
					})
					console.log(rawData)
					console.log(cleanData)
					if (nId > 0) {
						let cData = await engineAPI.post('/', { nIds: [nId], data: cleanData }).then(rss => {
							console.log('EngineAPI Status:', rss.status);
							console.log('EngineAPI Response', rss.data)
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

// router.get('/:version/devicedata/:deviceID', async (req, res, next) => {
// 	let apiVersion = req.params.version
// 	let authToken = req.headers.auth
// 	let customerID = req.params.customerID
// 	let deviceID = req.params.deviceID
// 	if (verifyAPIVersion(apiVersion)) {
// 		if (authenticate(authToken)) {
// 			let query = `SELECT id, \`data\`, topic, created, device_id
// 			FROM Device_data			
// 			WHERE device_id=${deviceID}`
// 			await mysqlConn.query(query).then(rs => {
// 				res.status(200).json(rs[0])
// 			}).catch(err => {
// 				if (err) { res.status(500).json(err) }
// 			})
// 		} else {
// 			res.status(403).json('Unauthorized Access! 403')
// 			console.log('Unauthorized Access!')
// 		}
// 	} else {
// 		console.log(`API/sigfox version: ${apiVersion} not supported`)
// 		res.send(`API/sigfox version: ${apiVersion} not supported`)
// 	}
// })
// router.get('/', async (req,res, netxt)=> {
// 	res.json('API/MessageBroker GET Success!')
// })
module.exports = router
