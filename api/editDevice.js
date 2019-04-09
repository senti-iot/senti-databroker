const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../mysql/mysql_handler')

router.post('/:version/editdevice/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let deviceID = req.params.id
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceID) {
				let findDevQ = "SELECT * from `Device` where id=?"
				let device = mysqlConn.query(findDevQ, deviceID, (err, result) => {
					if (err) { res.status(404).json(err) }
					return result
				})
				if (device) {
					mysqlConn.query("UPDATE `Device` SET name = ?, type_id = ?, reg_id = ? WHERE id = ?", [data.name, data.type_id, data.reg_id, deviceID], function (err, result) {
						if (err) {
							console.log("error: ", err);
							res.status(404).json(err)
						}
						else {
							res.status(200).json(true);
						}
					});
				}

			
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
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
