const express = require('express')
const router = express.Router()
var mysqlConn = require('../../mysql/mysql_handler')
const moment = require('moment')
const engineAPI = require('../engine/engine')
const tokenAPI = require('../engine/token')
const log = require('../../server').log


const getOrgMetadata = `SELECT * FROM OrgMetaData where orgId = ?`

router.get('/:token/:version/orgMetadata/:orgId', async (req, res, next) => {
	let orgId = req.params.orgId
	try {

		mysqlConn.query(getOrgMetadata, [orgId]).then(rs => {
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

module.exports = router