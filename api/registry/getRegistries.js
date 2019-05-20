const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')


router.get('/:version/registries', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT r.id, r.name, r.uuid, r.region, r.protocol, r.customer_id, r.created, r.description, c.name as customer_name, c.ODEUM_org_id from Registry r
			INNER JOIN Customer c on c.id = r.customer_id
			where r.deleted=0`
			await mysqlConn.query(query).then(rs => {
					res.status(200).json(rs[0])
				}).catch(err => {
					if(err) {res.status(500).json(err)}
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
router.get('/:version/:customerID/registries', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT r.id, r.name, r.uuid, r.region, r.protocol, r.customer_id, r.created, r.description, c.name as customer_name, c.ODEUM_org_id from Registry r
			INNER JOIN Customer c on c.id = r.customer_id
			where c.ODEUM_org_id=? AND r.deleted=0`
			await mysqlConn.query(query,[customerID]).then(rs => {
					res.status(200).json(rs[0])
				}).catch(err => {
					if(err) {res.status(500).json(err)}
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
