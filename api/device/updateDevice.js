const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')

let update_set = (obj) => Object.keys(obj).map(value => {
	if(typeof obj[value] === 'string'){
		return  `${value} = '${obj[value]}'` 
	}
	if(typeof obj[value] === 'object') {
		return `${value} = '${obj[value].join(',')}'`
	}
	return `${value}  = ${obj[value]}`;
});

router.post('/:version/device/:id', async (req, res, next) => {
	let apiVersion = req.params.version
	let deviceID = req.params.id
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceID) {
				let findDevQ = "SELECT * from `Device` where id=?"
				mysqlConn.query(findDevQ, deviceID).then(result => {

					if (result.length !== 0) {
						let query = `UPDATE Device 
						SET 
							name=?
							type_id=?
							reg_id=?
							\`normalize\`=?
							description=?
							lat=?
							lng=?
							address=?
							locType=?
							available=?
							communication=?
							tags=?
							logging=?
						WHERE id = ?
						`
						// ${update_set(data).join(",\n")} ${deviceID}

						console.log(query)
						let arr = [data.name,data.type_id, 
							data.reg_id, data.normalize, 
							data.description, data.lat, data.long, data.address, data.locType, data.available, data.communication, data.tags.join(','), data.logging, deviceID]
						mysqlConn.query(query).then((result) => {
							// else {
							res.status(200).send(deviceID);
							// }
						}).catch(err => {
							// if (err) {
							console.log("error: ", err);
							res.status(404).json(err)
							// }
						})
					}
				}).catch(err => {
					if (err) { res.status(404).json(err) }
				})
			}
		} else {
			res.status(403).json('Unauthorized Access! 403')
			console.log('Unauthorized Access!')
		}
	} else {
		console.log(`API/sigfox version: ${apiVersion} not supported`)
		res.send(`API/sigfox version: ${apiVersion} not supported`)
	}
})
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
