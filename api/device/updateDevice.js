const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log
const cleanUpSpecialChars = require('../../utils/cleanUpSpecialChars')

const updateDeviceQuery = `
UPDATE device
SET
uuname=?,
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
WHERE shortHash=?;
`
const updateDeviceMetadataQuery = `
UPDATE deviceMetadata
SET
\`data\`=?,
inbound=?,
outbound=?
WHERE shortHash=?;
`

const CreateDeviceMetadataQuery = `INSERT INTO deviceMetadata(\`data\`,inbound,outbound,device_id) VALUES (?,?,?,?)`

const findDeviceMetadataQuery = `SELECT * from deviceMetadata where device_id=?`

const findDeviceQuery = "SELECT * from device where shortHash=?"

const findDeviceUniqueUuname = `SELECT * from device where uuname=?`
router.post('/:version/device', async (req, res, next) => {
	let apiVersion = req.params.version
	let deviceID = req.body.shortHash
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceID) {
				console.log('Searching for Device in DB')
				mysqlConn.query(findDeviceQuery, deviceID).then(result => {
					console.log("Searched:", result[0].length)
					if (result[0].length > 0) {
						let device = result[0]
						let uuname = ''
						if (data.uuname) {
							let [uniqueUuname] = mysqlConn.query(findDeviceUniqueUuname, [data.uuname])
							if (uniqueUuname.length > 0) {
								res.status(400).json('Uuname is not unique')
							}
							else {
								uuname = data.uuname
							}
						} else {
							uuname = cleanUpSpecialChars(data.name).toLowerCase() + '-' + shortHash
						}
						let arr = [uuname, data.name, data.type_id,
							data.reg_id, data.description,
							data.lat, data.lng, data.address, data.locType,
							data.communication, data.tags.join(','), deviceID]

						let arrDM = [JSON.stringify(data.metadata.metadata), JSON.stringify(data.metadata.inbound), JSON.stringify(data.metadata.outbound), device.id]

						mysqlConn.query(updateDeviceQuery, arr).then((result) => {
							console.log('Updated Device\n', result[0])
							// log({
							// 	msg: "Updated Device",
							// 	device: result[0]
							// },
							// 	"info")
							if (result[0].affectedRows > 0) {
								mysqlConn.query(findDeviceMetadataQuery, [deviceID]).then(rs => {
									if (rs[0].length > 0) {
										console.log('Updating Metadata\n')
										mysqlConn.query(updateDeviceMetadataQuery, arrDM).then(rs => {
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
										mysqlConn.query(CreateDeviceMetadataQuery, [...arrDM, deviceID]).then(rs => {
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
