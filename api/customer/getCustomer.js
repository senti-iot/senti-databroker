const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/customer/:odeumId', async (req, res) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let customerID = req.params.odeumId
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT * from Customer where ODEUM_org_id=? and deleted=0`
			await mysqlConn.query(query, [customerID]).then(rs => {
				// console.log(rs[0][0])
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
router.get('/:version/customers', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT * from Customer where deleted=0`
			await mysqlConn.query(query).then(rs => {
				// console.log(rs[0][0])
				if (rs[0][0]) {
					res.status(200).json(rs[0])
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
// router.get('/', async (req,res, netxt)=> {
// 	res.json('API/MessageBroker GET Success!')
// })
module.exports = router
