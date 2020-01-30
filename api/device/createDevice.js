const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log
const uuidv4 = require('uuid').v4
const shortHashGen = require('../../utils/shortHashGen')
const cleanUpSpecialChars = require('../../utils/cleanUpSpecialChars')


const createDeviceQuery = `INSERT INTO device
			(uuname, name, typeHash, regHash, description, lat, lng, address, locType, communication, uuid, shortHash)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`

const createMetaDataQuery = `INSERT INTO deviceMetadata
					(deviceHash, data, inbound, outbound, uuid)
					VALUES(?, ?, ?, ?, ?);`


router.put('/:version/device', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body

	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			try {
				let uuid = uuidv4()
				let shortHash = shortHashGen(uuid)
				let uuname = data.uuname ? data.uuname + '-' + shortHash : cleanUpSpecialChars(data.name).toLowerCase() + '-' + shortHash

				console.log(uuid, shortHash)
				let arr = [uuname, data.name, data.typeHash, data.regHash,
					data.description,
					data.lat, data.lng, data.address,
					data.locType, data.communication,
					uuid, shortHash]
				console.log(mysqlConn.format(createDeviceQuery, arr))
				mysqlConn.query(createDeviceQuery, arr).then(rs => {
					console.log('Device Created', rs[0].insertId)
					log({
						msg: `Device [0] Created`,
						deviceValues: arr
					}, "info")
					let mtd = data.metadata
					console.log(mtd, createMetaDataQuery)
					let mtdArr = [rs[0].insertId, JSON.stringify(mtd.metadata), JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
					mysqlConn.query(createMetaDataQuery, mtdArr).then(r => {
						console.log('Created', r[0].insertId)
						log({
							msg: `Device [1] Metadata Created`,
							deviceMtdValues: mtdArr
						}, "info")
						res.status(200).json(rs[0].insertId)
					}).catch(err => {
						res.status(500).json(err)
					})
				}).catch(async err => {
					// if (err) {
					console.log("error: ", err);
					let uuid = await log({
						msg: 'Error Creating Device',
						error: err
					}, "error")
					res.status(500).json(uuid)
					// }
				})
			}
			catch (e) {
				console.log(e)
				res.status(500).json(e)
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
// router.get('/', async (req,res, netxt)=> {
// 	res.json('API/MessageBroker GET Success!')
// })
module.exports = router
