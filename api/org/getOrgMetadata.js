const express = require('express')
const router = express.Router()
var mysqlConn = require('../../mysql/mysql_handler')
// const moment = require('moment')
// const engineAPI = require('../engine/engine')
// const tokenAPI = require('../engine/token')
// const log = require('../../server').log
const { authenticate } = require('senti-apicore')


const getOrgMetadataByOrgId = `SELECT * FROM orgMetaData WHERE orgId = ?`
const getOrgMetadataByHostname = `SELECT * FROM orgMetaData WHERE host = ?`

router.get('/:token/:version/orgMetadata/:orgId', async (req, res) => {
	let orgId = req.params.orgId
	try {

		mysqlConn.query(getOrgMetadataByOrgId, [orgId]).then(rs => {
			if (rs[0][0]) {
				console.log(rs[0][0])
				res.json({ ...rs[0][0] }).status(200)
			}
		})
	}
	catch (e) {
		res.json(e).status(500)
	}

})

router.get('/orgMetadata/:hostname', async (req, res) => {
	try {
		let hostname = req.params.hostname
		let authToken = req.headers.auth
		if (authenticate(authToken)) {
			mysqlConn.query(getOrgMetadataByHostname, [hostname]).then(rs => {
				if (rs[0][0]) {
					console.log(rs[0][0])
					res.json({ ...rs[0][0] }).status(200)
				}
				else {
					res.json(false).status(200)
				}
			})
		}
		else {
			res.json('Invalid Token').status(400)
		}
	} catch (error) {
		res.json(error).status(500)
	}
})
module.exports = router