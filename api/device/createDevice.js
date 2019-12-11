const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log

function cleanUpSpecialChars(str) {

	return str.toString()
		.replace(/[øØ]/g, "ou")
		.replace(/[æÆ]/g, "ae")
		.replace(/[åÅ]/g, "aa")
		.replace(/[^a-z0-9]/gi, '-'); // final clean up
}
const createDeviceQuery = `INSERT INTO Device
			(uuid,name, type_id, reg_id,
			description,
			lat, lng, address,
			locType,
			communication)
			VALUES (?,?,?,?,?,?,?,?,?,?)`

const createMetaDataQuery = `INSERT INTO Device_metadata
					(device_id, data, inbound, outbound)
					VALUES(?, ?, ?, ?);`

router.put('/:version/device', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body

	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			try {
				console.log(data)
				let uuid = data.uuid ? data.uuid : cleanUpSpecialChars(data.name).toLowerCase()
				console.log(uuid)
				let arr = [uuid, data.name, data.type_id, data.reg_id,
					data.description,
					data.lat, data.lng, data.address,
					data.locType, data.communication]
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
