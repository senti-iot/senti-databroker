const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.post('/:version/registry', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	let regId = req.body.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (regId !== null || regId !== undefined) {
				let findDevQ = "SELECT * from `Registry` where id=?"
				await mysqlConn.query(findDevQ, [regId]).then(async result => {
					if (result[0].length === 0) {
						return res.status(404).json(false)
					}
					if (result[0].length !== 0) {
						let query = `UPDATE \`Registry\` r
						INNER JOIN Customer c on c.ODEUM_org_id = ?
							SET 
								r.name = ?,
								r.region = ?,
								r.protocol = ?,
								r.ca_certificate = ?,
								r.customer_id = c.id
						WHERE r.id = ?`
						console.log(mysqlConn.format(query, [data.orgId, data.name, data.region, data.protocol, data.ca_certificate, regId]))
						await mysqlConn.query(query, [data.orgId, data.name, data.region, data.protocol, data.ca_certificate, regId])
							.then((result) => {
								res.status(200).json(true)
							}).catch(err => {
								if (err) {
									console.log("error: ", err);
									res.status(404).json(err)
								}
							})
					}
				}).catch(err => {
					if (err) {
						console.log("error: ", err);
						res.status(404).json(err)
					}
				})

			} else {
				res.status(400).json('Bad Request')
				console.log('Unauthorized Access!')
			}
		} else {
			res.status(503).json('Unauthorized Access!')
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
