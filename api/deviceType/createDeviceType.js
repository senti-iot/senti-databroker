const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const uuidv4 = require('uuid').v4
const shortHashGen = require('../../utils/shortHashGen')
const log = require('../../server').log

const queryCreateDT = `INSERT INTO deviceType (uuid, shortHash, name, description, custHash, outbound, inbound, metadata)
			SELECT ?, ?, ?, ?, c.uuid, ?, ?, ? from customer c
			where c.uuid=?`
const queryGetDT = `SELECT dt.uuid,
								   dt.shortHash,
								   dt.name,
								   dt.description,
								   dt.inbound,
								   dt.outbound,
								   dt.metadata,
								   c.name as customerName,
								   dt.custHash,
								   c.shortHash as custShortHash,
								   c.ODEUM_org_id as orgId
			FROM deviceType dt
			INNER JOIN customer c on c.uuid = dt.custHash
			WHERE dt.shortHash=? and dt.deleted=0;`

router.put('/:version/devicetype', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	console.log(req.body)
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			console.log('CREATING DEVICE TYPE')
			let uuid = uuidv4()
			let shortHash = shortHashGen(uuid)
			let values = [uuid, shortHash, data.name, data.description, JSON.stringify(data.outbound), JSON.stringify(data.inbound), JSON.stringify(data.metadata), data.custHash]

			await mysqlConn.query(queryCreateDT, values).then(async result => {
				if (result[0].insertId > 0) {
					let [dt] = await mysqlConn.query(queryGetDT, [shortHash])
					res.status(200).json(dt[0])
				}
				else {
					res.status(400).json({ "error": "Device Type has not been created" })
				}
				// res.status(200).json(result[0].insertId)
			}).catch(async err => {
				// if (err) {
				console.log("error: ", err);
				// let uuid = await log({
				// 	msg: 'Error Creating Device Type',
				// 	error: err
				// },
				// 	"error")
				res.status(500).json(err)
				// }
			})
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
