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

router.put('/:version/customer', async (req, res, next) => {
	let apiVersion = req.params.version
	let OrgID = req.body.ODEUM_org_id
	let authToken = req.headers.auth
	let data = req.body
	console.log('UPDATE CUSTOMER');
	console.log(OrgID, data);
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (OrgID) {
				
				let findDevQ = "SELECT * from customer where ODEUM_org_id=?"
				mysqlConn.query(findDevQ, OrgID).then(result => {

					if (result.length !== 0) {
						let query = `UPDATE customer 
						SET 
							name=?
						WHERE ODEUM_org_id = ?
						`
						mysqlConn.query(query,[data.name, OrgID]).then((result) => {
							// else {
							res.status(200).json(OrgID);
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
