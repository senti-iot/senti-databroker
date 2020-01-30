const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const uuidv4 = require('uuid').v4
const shortHashGen = require('../../utils/shortHashGen')

const createRegQuery = `
			INSERT INTO registry(name,region,protocol, ca_certificate, description, created, uuname, uuid, shortHash, custHash)
			(SELECT ?, ?, ?, ?, ?, NOW(), CONCAT(?,'-',CAST(LEFT(UUID(),8) as CHAR(50))), ?, ?, c.uuid from customer c where c.uuid=?)`
const getReg = `SELECT r.*, c.name as customerName, c.ODEUM_org_id as orgId from registry r
				  INNER JOIN customer c on c.uuid = r.custHash
				  where r.shortHash=? and r.deleted=0;`
function cleanUpSpecialChars(str) {
	return str
		.replace(/[øØ]/g, "ou")
		.replace(/[æÆ]/g, "ae")
		.replace(/[åÅ]/g, "aa")
		.replace(/[^a-z0-9]/gi, '-'); // final clean up
}

router.put('/:version/registry', async (req, res, next) => {
	let apiVersion = req.params.version
	let authToken = req.headers.auth
	let data = req.body
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			let uuid = uuidv4()
			let shortHash = shortHashGen(uuid)
			let result = await mysqlConn.query(createRegQuery, [
				data.name,
				data.region,
				data.protocol,
				data.ca_certificate,
				data.description,
				cleanUpSpecialChars(data.name).toLowerCase(),
				uuid,
				shortHash,
				data.custHash
			]).then(async (result) => {
				if (result[0].insertId > 0) {
					let [registry] = await mysqlConn.query(getReg, [shortHash])
					res.status(200).json(registry)

				}
			}).catch(err => {
				res.status(500).json({
					err,
					query: mysqlConn.format(createRegQuery, [
						data.name,
						data.region,
						data.protocol,
						data.ca_certificate,
						data.description,
						cleanUpSpecialChars(data.name).toLowerCase(),
						uuid,
						shortHash,
						data.custHash
					])
				})
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
router.get('/', async (req, res, netxt) => {
	res.json('API/MessageBroker GET Success!')
})
module.exports = router
