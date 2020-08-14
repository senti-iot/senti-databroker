const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const uuidv4 = require('uuid/v4');
const md5 = require('md5')

const query = `INSERT INTO customer
			(name, uuname, uuid, ODEUM_org_id)
			VALUES (?, ?, ?, ?)`

router.post('/:version/customer', async (req, res) => {
	console.log('CREATE CUSTOMER')
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {

			let uuid = uuidv4()
			let shortUUID = md5(uuid).substr(0, 8)
			console.log(shortUUID)
			let formattedName = data.name.replace(/\s+/g, '-').toLowerCase()
			let arr = [data.name, formattedName + '-' + shortUUID, uuid, data.org_id]
			console.log(mysqlConn.format(query, arr))
			await mysqlConn.query(query, arr).then(r => {
				console.log('CUSTOMER CREATED', r);
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
