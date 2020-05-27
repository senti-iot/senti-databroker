const DbRegistry = require('./dataClasses/DbRegistry')
const { v4: uuidv4 } = require('uuid')


class sentiRegistryService {
	db = null

	constructor(db = null) {
		this.db = db
	}
	async getDbRegistryById(id, deleted = 0) {
		let select = `SELECT r.id, r.uuid, r.custHash, r.name, r.uuname, r.region, r.protocol, r.ca_certificate, r.orgId, r.customer_id, r.created, r.description, r.deleted, r.config
				FROM registry r
				WHERE r.id = ? AND r.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbRegistry(rs[0][0])
	}
	async createRegistry(registry = false) {
		console.log('createRegistry', registry)
		if (registry === false)
			return false
		let dbReg = new DbRegistry(registry)
		console.log('dbReg', dbReg)
		if (!dbReg.name || !dbReg.uuname || !dbReg.org.uuid)
			return false
		dbReg.uuid = dbReg.uuid !== null ? dbReg.uuid : uuidv4()
		dbReg.uuname = dbReg.uuname !== null ? dbReg.uuname : dbReg.name.replace(' ', '').toLowerCase() + '-' + this.shortHashGen(dbReg.uuid)
		let insert = `INSERT INTO registry(uuid, name, uuname, region, protocol, ca_certificate, orgId, created, description, deleted, config)
			VALUES(?,  ?, ?, ?, ?, ?, ?, ?, ?, 0, ?);`
		/**
		 * @Todo Config field shouldn't be always null
		 */
		let sql = this.db.format(insert, [dbReg.uuid, dbReg.name, dbReg.uuname, dbReg.region, dbReg.protocol, dbReg.ca_certificate, dbReg.orgId, 'NOW()', dbReg.description, null])
		console.log(sql)
		let rs = this.db.query(insert, [dbReg.uuid, dbReg.name, dbReg.uuname, dbReg.region, dbReg.protocol, dbReg.ca_certificate, dbReg.orgId, 'NOW()', dbReg.description, null])
		if (rs[0].affectedRows === 1) {
			return await this.getDbRegistryById(rs[0].insertId)
		}
		return false
	}
	async getIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM registry r WHERE r.uuid = ? AND r.deleted = ?`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
	shortHashGen(source) {
		var i = 0, j = 0, bitshift = 0, mask = 0x3f, mask0 = 0, mask1 = 0, val = 0
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
module.exports = sentiRegistryService