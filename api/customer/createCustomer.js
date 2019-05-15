const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.post('/:version/customer', async (req, res, next) => {
	console.log('CREATE CUSTOMER')
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `INSERT INTO Customer
			(name, uuid, ODEUM_org_id) 
			VALUES (?, CONCAT(?, '-', CAST(LEFT(UUID(),8) as CHAR(50))), ?)`

			let arr = [data.name, data.name.replace(/\s+/g, '-').toLowerCase(), data.org_id]
			mysqlConn.query(query, arr).then(res => {
				console.log('CUSTOMER CREATED', res);
				res.status(200).json(true)
			}).catch(err => {
				console.log('CUSTOMER NOT CREATED', err)
				if (err) { res.status(500).json(err) }
			})

		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})

module.exports = router
