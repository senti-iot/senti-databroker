const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

router.put('/:version/device', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {			
			let query  =`INSERT INTO \`Device\`
			(name, type_id, reg_id,
			\`normalize\`, description,
			 lat, lng, address, locType, 
			 available, communication, tags, logging) 
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
			try{
				let arr = [data.name,data.type_id, data.reg_id, 
					data.normalize, data.description, data.lat, 
					data.long, data.address, data.locType,
					 data.available, data.communication, 
					 data.tags.join(','), data.logging]
				mysqlConn.query(query, arr).then(res => {
					res.status(200).json(true)
				}).catch(err => {
					if(err) {res.status(500).json(err)}
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
// router.get('/', async (req,res, netxt)=> {
// 	res.json('API/MessageBroker GET Success!')
// })
module.exports = router
