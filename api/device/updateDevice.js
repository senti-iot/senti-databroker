const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log

router.post('/:version/device', async (req, res, next) => {
	let apiVersion = req.params.version
	let deviceID = req.body.id
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceID) {
				console.log('Searching for Device in DB')
				let findDevQ = "SELECT * from `Device` where id=?"
				mysqlConn.query(findDevQ, deviceID).then(result => {
					console.log("Searched:", result[0].length)
					if (result[0].length > 0) {
						let query = `UPDATE Device
						SET
						name=?,
						type_id=?,
						reg_id=?,
						description=?,
						lat=?,
						lng=?,
						address=?,
						locType=?,
						communication=?,
						tags=?,
						deleted=0
						WHERE id=?;
						`
						let queryDM = `
						UPDATE Device_metadata
						SET
						\`data\`=?,
						inbound=?,
						outbound=?
						WHERE device_id=?;
						`
						let queryCreateDM = `
						INSERT INTO Device_metadata(\`data\`,inbound,outbound,device_id) VALUES (?,?,?,?)
						`
						let queryFindDM = `SELECT * from Device_metadata where device_id=?`

						let arr = [data.name, data.type_id,
						data.reg_id, data.description,
						data.lat, data.lng, data.address, data.locType,
						data.communication, data.tags.join(','), deviceID]

						let arrDM = [JSON.stringify(data.metadata.metadata), JSON.stringify(data.metadata.inbound), JSON.stringify(data.metadata.outbound), deviceID]

						mysqlConn.query(query, arr).then((result) => {
							console.log('Updated Device\n', result[0])
							log({
								msg: "Updated Device",
								device: result[0]
							},
								"info")
							if (result[0].affectedRows > 0) {
								mysqlConn.query(queryFindDM, [deviceID]).then(rs => {
									if (rs[0].length > 0) {
										console.log('Updating Metadata\n')
										mysqlConn.query(queryDM, arrDM).then(rs => {
											if (rs) {
												log({
													msg: "Updated Device Metadata",
													device: rs[0]
												},
													"info")
												console.log('Updated Metadata\n')
												res.status(200).json(deviceID);
											}
										})
									}
									else {
										console.log('Creating Device Metadata\n')
										mysqlConn.query(queryCreateDM, [...arrDM, deviceID]).then(rs => {
											if (rs) {
												console.log('Created Device metadata\n');
												log({
													msg: "Created Device Metadata"
												},
													"info")
												res.status(200).json(deviceID);
											}
										})
									}
								})


							}
						}).catch(async err => {
							// if (err) {
							console.log("error: ", err);
							let uuid = await log({
								msg: 'Error Updating Device',
								error: err
							},
								"error")
							res.status(500).json(uuid)
							// }
						})
					}
				}).catch(async err => {
					let uuid = await log({
						msg: 'Error Updating Device',
						error: err
					},
						"error")
					res.status(500).json(err)
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
