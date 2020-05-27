const DbRegistry = require('./dataClasses/DbRegistry')


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
}
module.exports = sentiRegistryService