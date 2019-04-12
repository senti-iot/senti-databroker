const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.post('/:version/registry/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	let regId = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (regId) {
				let findDevQ = "SELECT * from `Registry` where id=?"
				let registry = []
				mysqlConn.query(findDevQ, regId, (err, result) => {
					if (err || result.length === 0) { return null }
					if (result.length !== 0) {
						mysqlConn.query(`UPDATE \`Registry\` 
						SET 
							name = ?,
							region = ?,
							protocol = ?,
							ca_certificate = ?,
							org_id = ?
						WHERE id = ?`, [
								data.name,
								data.region,
								data.protocol,
								data.ca_certificate,
								data.org_id,
								regId], function (err, result) {
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
						console.log("error:");
						res.status(404).json(null)
					}
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
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
