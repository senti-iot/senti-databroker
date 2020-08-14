const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const queryUpdateDT = `UPDATE deviceType dt
						INNER JOIN customer c on c.uuid = ?
						SET
							dt.name = ?,
							dt.description = ?,
							dt.inbound = ?,
							dt.outbound = ?,
							dt.metadata = ?
						WHERE dt.uuid = ?`

const findDevQ = `SELECT dt.uuid,
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
WHERE dt.uuid =? and dt.deleted = 0;`

router.post('/:version/devicetype', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let dtId = req.body.uuid
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (dtId) {
				// let registry = []
				console.log(dtId)
				await mysqlConn.query(findDevQ, dtId).then((DTQ) => {
					if (DTQ[0].length !== 0) {

						let values = [data.custHash,
							data.name, data.description, JSON.stringify(data.inbound),
							JSON.stringify(data.outbound), JSON.stringify(data.metadata), dtId]

						mysqlConn.query(queryUpdateDT, values)
							.then(async (result) => {
								let [newDtq] = await mysqlConn.query(findDevQ, dtId)
								res.status(200).json(newDtq[0])
							})
							.catch(err => {
								console.log("error: ", err)
								res.status(404).json({
									err: err,
									// sql: mysqlConn.format(queryUpdateDT, values)
								})
							})
					}
					else {
						console.log("error")
						res.status(404).json(null)
					}
				}).catch(err => {
					console.log("error: ", err)
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
