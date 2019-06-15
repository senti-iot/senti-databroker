const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')

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
				let q1 = `SELECT (sum(c.\`data\`->>'$.${type}')/count(c.\`data\`)) as avrg from Device_data_clean c
				Inner join Device d on d.id = c.device_id
				where d.type_id = ? and created >= ? AND created <= ? ORDER BY created and \`data\`->>'$.${type}' not like '%null%'`
				let q2 = `SELECT created, AVG(\`data\`->>'$.${type}') as avrg from Device_data_clean
				inner join Device d on d.id = device_id
				where d.type_id = ? and \`data\`->>'$.${type}' not like '%null%' and created >= ? AND created <= ?
				group by created
				order by created asc`
				console.log(chartType)
				await mysqlConn.query(chartType === 0 ? q2 : q1, [deviceTypeID, from, to]).then(async rs => {
					let data = rs[0]
					if (chartType === 1) {
						data = rs[0][0].avrg
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
						let cleanData = {}
						data.forEach(r => {
							cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.avrg
						})
						if (nId > 0) {
							let cData = await engineAPI.post('/', { nIds: [nId], data: data }).then((rss) => {
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
				console.log(deviceID, from ,to, nId)
			await mysqlConn.query(query, [deviceID, from, to]).then(async rs => {
				let rawData = rs[0]
				let cleanData = {}
				rawData.forEach(r => {
					cleanData[moment(r.created).format('YYYY-MM-DD HH:mm:ss')] = r.data[type]
				})
				console.log(rawData)
				console.log(cleanData)
				if(nId>0) {
					let cData = await engineAPI.post('/', {nIds: [nId], data: cleanData}).then(rss => { 
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
