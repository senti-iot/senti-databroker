const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const log = require('../../server').log

const deleteSensorQuery = `UPDATE device
SET deleted=1
WHERE uuid=?;`

router.post('/:version/delete-device/:uuid', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let deviceID = req.params.uuid
			mysqlConn.query(deleteSensorQuery, [deviceID]).then(rs => {
				// console.log(rs)
				if (rs[0].affectedRows > 0) {
					log({
						msg: 'Device deleted',
						deviceId: deviceID
					}, 'info')
					res.status(200).json(true)
				}
				else {
					res.status(404).json(false)
				}
			}).catch(async err => {
				// if (err) {
				console.log("error: ", err);
				let uuid = await log({
					msg: 'Error Deleting Device',
					error: err
				},
					"error")
				res.status(500).json(uuid)
				// }
			})
		}
		else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)

	}
})

module.exports = router