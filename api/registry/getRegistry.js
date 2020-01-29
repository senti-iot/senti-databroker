const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

const getQuery = `SELECT r.*, c.name as customerName, c.ODEUM_org_id as orgId from registry r
				  INNER JOIN Customer c on c.uuid = r.custHash
				  where r.shortHash=? and r.deleted=0;`
const getCQuery = `SELECT r.*, c.name as customerName, c.ODEUM_org_id as orgId from registry r
				   INNER JOIN customer c on c.uuid = r.custHash
				   WHERE r.uuid=? and r.deleted = 0 and c.ODEUM_org_id =?`

/* 		let query = `SELECT r.*, c.name as customer_name, c.ODEUM_org_id as orgId from Registry r
			INNER JOIN Customer c on c.id = r.customer_id
			where r.id=? and r.deleted=0;`
			let query = `SELECT r.*, c.name as customer_name, c.ODEUM_org_id as orgId from Registry r
			INNER JOIN Customer c on c.id = r.customer_id
			where r.id=? and r.deleted=0 and c.ODEUM_org_id=?`

			*/

router.get('/:version/registry/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let regID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {

			await mysqlConn.query(getQuery, [regID]).then(rs => {
				if (rs[0][0]) {
					res.status(200).json(rs[0][0])
				}
				else {
					res.status(404).json(false)
				}
			}).catch(err => {
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
router.get('/:version/:customerID/registry/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.customerID
	let regID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			await mysqlConn.query(getCQuery, [regID, customerID]).then(rs => {
				console.log(rs[0][0])
				if (rs[0][0]) {
					res.status(200).json(rs[0][0])
				}
				else {
					res.status(404).json(false)
				}
			}).catch(err => {
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
