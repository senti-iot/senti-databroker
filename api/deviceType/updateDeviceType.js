const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.post('/:version/devicetype', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let dtId = req.body.id
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (dtId) {
				let findDevQ = "SELECT * from `Device_type` where id=?"
				// let registry = []
				console.log(dtId)
				await mysqlConn.query(findDevQ, dtId).then((result) => {
					if (result[0].length !== 0) {
						let query = `UPDATE \`Device_type\` 
						SET 
							name = ?,
							inbound = ?,
							outbound = ?,
							metadata = ?,
							customer_id = ?
						WHERE id = ?`
						let values = [data.type_name, JSON.stringify(data.inbound), JSON.stringify(data.outbound), JSON.stringify(data.metadata), data.customer_id, dtId]
						mysqlConn.query(query, values)
							.then((result) => {
								res.status(200).json(true);
							})
							.catch(err => {
								console.log("error: ", err);
								res.status(404).json(err)
							})
					}
					else {
						console.log("error");
						res.status(404).json(null)
					}
				}).catch(err => {
					console.log("error: ", err);
					res.status(404).json(err)
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
