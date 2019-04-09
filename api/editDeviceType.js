const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../mysql/mysql_handler')

router.post('/:version/editdt/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let dtId = req.params.id
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (dtId) {
				let findDevQ = "SELECT * from `Device_type` where type_id=?"
				// let registry = []
				console.log(dtId)
				mysqlConn.query(findDevQ, dtId, (err, result) => {
					if (err) { return null }
					if (result.length !== 0) {
						mysqlConn.query(`UPDATE \`Device_type\` 
						SET 
							type_name = ?
						WHERE type_id = ?`, [
								data.type_name,
								dtId], function (err, result) {
									if (err) {
										console.log("error: ", err);
										res.status(404).json(err)
									}
									else {
										res.status(200).json(true);
									}
								});
					}
					else {
						console.log("error");
						res.status(404).json(null)
					}
				})
				
			}
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	}
	else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
