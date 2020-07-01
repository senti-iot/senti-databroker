const { v4: uuidv4 } = require('uuid')
const CloudFunction = require('./dataClasses/CloudFunction')
const DbCloudFunction = require('./dataClasses/DbCloudFunction')
// const RequestDevice = require('./dataClasses/RequestDevice')

class cloudfunctionService {
	db = null

	constructor(db = null) {
		this.db = db
	}
	async getIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM cloudFunction cf WHERE cf.uuid = ? AND cf.deleted = ?;`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
	async getCloudFunctionById(id) {
		/**
		 * Removed INNER JOIN customer c on c.id = r.customer_id
		 * JSON_OBJECT('uuid', r.uuid, 'name', r.name) as registry,
		 * JSON_OBJECT('uuid', dt.uuid, 'name', dt.name) as deviceType,
		 */
		let select = `SELECT
						cf.id,
						cf.uuid,
						cf.name,
						cf.js,
						cf.\`type\` ,
						cf.description ,
						cf.orgId
					FROM
						cloudFunction cf
					WHERE cf.id=? AND cf.deleted = 0;`

		let rs = await this.db.query(select, [id])
		if (rs[0].length !== 1) {
			return false
		}
		return new CloudFunction(rs[0][0])
	}
	async getDbCloudFunctionById(id, deleted = 0) {
		let select = `SELECT
						cf.id,
						cf.uuid,
						cf.name,
						cf.js,
						cf.\`type\` ,
						cf.description ,
						cf.orgId
					FROM
						cloudFunction cf
					WHERE cf.id=? AND cf.deleted = 0;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbCloudFunction(rs[0][0])
	}

	async getCloudFunctionByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getCloudFunctionById(id, deleted)
	}
	async getDbCloudFunctionByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDbCloudFunctionById(id, deleted)
	}

	// async getOrganisationCFByUUName(orgUUID, uuname, deleted = 0) {
	// 	let select = `SELECT cf.id
	// 					FROM cloudFunction cf
	// 						INNER JOIN registry r ON d.reg_id = r.id
	// 						INNER JOIN organisation o ON r.orgId = o.id AND o.uuid = ?
	// 					WHERE d.uuname = ? AND d.deleted = ?;`
	// 	console.log(select)
	// 	console.log(orgUUID, uuname, deleted)
	// 	let rs = await this.db.query(select, [orgUUID, uuname, deleted])
	// 	if (rs[0].length !== 1) {
	// 		return false
	// 	}
	// 	return await this.getDeviceById(rs[0][0].id, deleted)
	// }
	async getCloudFunctionsByUUIDS(uuids = false) {
		if (uuids === false) {
			return false
		}
		let clause = (uuids.length > 0) ? ' AND cf.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT
						cf.id,
						cf.uuid,
						cf.name,
						cf.js,
						cf.\`type\` ,
						cf.description ,
						cf.orgId
			FROM cloudFunction cf
			WHERE cf.deleted = 0 ${clause};`
		let sql = this.db.format(select, uuids)
		console.log(sql)
		let rs = await this.db.query(select, uuids)
		if (rs[0].length === 0) {
			return false
		}
		let result = []
		rs[0].forEach(async rsDev => {
			let cloudFunc = new CloudFunction(rsDev)
			result.push(cloudFunc)
		})
		return result
	}
	async createCloudFunction(cloudFunc = false) {
		if (cloudFunc === false) {
			return false
		}
		let dbO = new DbCloudFunction(cloudFunc)

		console.log('cloudFunctionDbO', dbO)
		if (dbO.name === false || dbO.orgId === false) {
			return false
		}
		dbO.uuid = dbO.uuid !== null ? dbO.uuid : uuidv4()

		let insert = `INSERT INTO cloudFunction(uuid, name, js, \`type\`, description, orgId, deleted)
			VALUES(?, ?, ?, ?, ?, ?, ?);`
		let sql = this.db.format(insert, [dbO.uuid, dbO.name, dbO.js, dbO.type, dbO.description, dbO.orgId, dbO.deleted])
		console.log(sql)
		let rs = await this.db.query(insert, [dbO.uuid, dbO.name, dbO.js, dbO.type, dbO.description, dbO.orgId, dbO.deleted])
		if (rs[0].affectedRows === 1) {
			return await this.getDbCloudFunctionById(rs[0].insertId)
		}
		return false
	}
	async updateCloudFunction(cloudFunc = false) {
		if (cloudFunc === false) {
			return false
		}
		let dbO = new DbCloudFunction(cloudFunc)
		dbO.id = this.getIdByUUID(cloudFunc.uuid)
		let update = `UPDATE cloudFunction SET
				name = ?
				js = ?
				\`type\` = ?
				description = ?
				orgId = ?
			WHERE id = ?`
		let sql = this.db.format(update, [dbO.name, dbO.js, dbO.type, dbO.description, dbO.orgId, dbO.deleted, dbO.id])
		console.log(sql)
		let rs = await this.db.query(update, [dbO.name, dbO.js, dbO.type, dbO.description, dbO.orgId, dbO.deleted, dbO.id])
		if (rs[0].affectedRows === 1) {
			return await this.getDbCloudFunctionById(rs[0].insertId)
		}
		return false

	}
	async deleteCloudFunction(cloudFunc = false) {
		if (cloudFunc === false) {
			return false
		}
		let id = this.getIdByUUID(cloudFunc.uuid)

		let delSql = `UPDATE cloudFunction
					SET
					deleted = 1
					where id = ?;`
		let rs = await this.db.query(delSql, [id])
		if (rs[0].affectedRows === 1) {
			return true
		}
		return false
	}
	shortHashGen(source) {
		var i = 0, j = 0, bitshift = 0, mask = 0x3f, mask0 = 0 /* mask1 = 0, val = 0 */
		var block = []
		//              0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
		var dictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$"
		var result = ""
		let binsrc = []
		while (source.length >= 2) {
			binsrc.push(parseInt(source.substring(0, 2), 16))
			source = source.substring(2, source.length)
		}
		// init block of 8 bytes plus one guard byte
		for (i = 0; i < 9; i++) {
			block[i] = 0
		}
		// fold input
		for (i = 0; i < binsrc.length; i++) {
			block[i % 8] = block[i % 8] ^ binsrc[i]
		}
		i = 0
		while (i < 64) {
			j = i >> 3 // byte index
			bitshift = i % 8 // bit index
			mask0 = mask << bitshift
			result = result + dictionary[(block[j] & mask0 & 0xff | block[j + 1] << 8 & mask0 & 0xff00) >> bitshift]
			i += 6
		}
		return result
	}
}
module.exports = cloudfunctionService