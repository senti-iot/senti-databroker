const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.put('/:version/registry', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			console.log(data)
			
			let query  ='INSERT INTO `Registry`(`name`,`region`,`protocol`,`ca_certificate`,`org_id`) VALUES (\''
			+ data.name + '\',\'' 
			+ data.region + '\',\'' 
			+ data.protocol + '\',\'' 
			+ data.ca_certificate + '\',\'' 
			+ data.org_id + '\');'
			try{
				mysqlConn.query(query, (err, result) => {
					if(err) {res.status(500).json(err)}
					res.status(200).json(true)
				})
			}
			catch(e) {
				res.status(500).json(e)
			}
			// res.json('API/sigfox POST Access Authenticated!')
			// console.log('API/sigfox POST Access Authenticated!')
			//Send the data to DataBroker
			// dataBrokerChannel.sendMessage(`${JSON.stringify(data)}`)
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})
router.get('/', async (req,res, netxt)=> {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router