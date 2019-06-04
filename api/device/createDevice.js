const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
function cleanUpSpecialChars(str)
{
    return str
        .replace(/[øØ]/g,"ou")
        .replace(/[æÆ]/g,"ae")
        .replace(/[åÅ]/g,"aa")
        .replace(/[^a-z0-9]/gi,'-'); // final clean up
}

router.put('/:version/device', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let query = `INSERT INTO \`Device\`
			(uuid,name, type_id, reg_id,
			description,
			lat, lng, address, 
			locType, 
			communication) 
			VALUES (CONCAT(?,'-',CAST(LEFT(UUID(),8) as CHAR(50))),?,?,?,?,?,?,?,?,?)`
			try {
				console.log(data)
				let uuid = cleanUpSpecialChars(data.name).toLowerCase()
				let arr = [uuid, data.name, data.type_id, data.reg_id,
				data.description,
				data.lat, data.lng, data.address,
				data.locType, data.communication]
				
				mysqlConn.query(query, arr).then(rs => {
					console.log('Device Created', rs[0].insertId)
					let mtd = data.metadata
					let mtdQuery = `INSERT INTO Device_metadata
					(device_id, \`data\`, inbound, outbound)
					VALUES(?, ?, ?, ?);
					`
					console.log(mtd, mtdQuery)
					let mtdArr = [rs[0].insertId, null, JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
					mysqlConn.query(mtdQuery, mtdArr).then(r => { 
						console.log('Created', r[0].insertId)
						res.status(200).json(rs[0].insertId)
					}).catch(err => { 
						console.log('failed')
						res.status(500).json(err)
					})
				}).catch(err => {
					 res.status(500).json(err)
				})
			}
			catch (e) {
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
