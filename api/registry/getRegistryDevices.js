const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.get('/:version/registry/:id/devices', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	// let customerID = req.params.customerID
	let regID = req.params.id
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `SELECT * from Device where reg_id=?`
			await mysqlConn.query(query, [regID]).then(rs => {
				// console.log(rs[0])
				res.status(200).json(rs[0])
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
