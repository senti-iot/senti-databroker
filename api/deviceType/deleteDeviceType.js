const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const deleteDTQuery = `UPDATE deviceType
SET deleted=1
WHERE uuid=?;`

router.post('/:version/delete-device-type/:uuid', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let dtID = req.params.uuid
			mysqlConn.query(deleteDTQuery, [dtID]).then(rs => {
				// console.log(rs)
				if (rs[0].affectedRows > 0) {
					res.status(200).json(true)
				}
				else {
					res.status(404).json(false)
				}
			}).catch(err => {
				res.status(500).json(err)
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