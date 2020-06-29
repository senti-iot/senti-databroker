const { v4: uuidv4 } = require('uuid')
const DeviceType = require('./dataClasses/DeviceType')
const DbDeviceType = require('./dataClasses/DbDeviceType')
const RequestDeviceType = require('./dataClasses/RequestDeviceType')

class sentiDeviceTypeService {
	db = null

	constructor(db = null) {
		this.db = db
	}

	async createDeviceType(deviceType = false) {
		if (deviceType === false) {
			return false
		}
		let dbO = new DbDeviceType(deviceType)
		if (dbO.name === false || dbO.orgId === false) {
			return false
		}
		dbO.uuid = dbO.uuid !== null ? dbO.uuid : uuidv4()
		// should we add created, modified
		let insert = `INSERT INTO deviceType(uuid, name, description, decoder, inbound, outbound, metadata, orgId, deleted) 
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);`
		let sql = this.db.format(insert, [dbO.uuid, dbO.name, dbO.description, 
			(dbO.decoder !== null) ? JSON.stringify(dbO.decoder) : dbO.decoder, 
			(dbO.inbound !== null) ? JSON.stringify(dbO.inbound) : dbO.inbound, 
			(dbO.outbound !== null) ? JSON.stringify(dbO.outbound) : dbO.outbound, 
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata, 
			dbO.orgId, dbO.deleted])
		console.log(sql)
		let rs = await this.db.query(insert, [dbO.uuid, dbO.name, dbO.description, 
			(dbO.decoder !== null) ? JSON.stringify(dbO.decoder) : dbO.decoder, 
			(dbO.inbound !== null) ? JSON.stringify(dbO.inbound) : dbO.inbound, 
			(dbO.outbound !== null) ? JSON.stringify(dbO.outbound) : dbO.outbound, 
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata, 
			dbO.orgId, dbO.deleted])
		if (rs[0].affectedRows === 1) {
			return await this.getDbDeviceTypeById(rs[0].insertId)
		}
		return false
	}
	async getDbDeviceTypeById(id, deleted = 0) {
		let select = `SELECT d.id, d.uuid, d.name, d.description, d.decoder, d.inbound, d.outbound, d.metadata, d.orgId, d.deleted
				FROM deviceType d
				WHERE d.id = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbDeviceType(rs[0][0])
	}
	async getDeviceTypeById(id, deleted = 0) {
		let select = `SELECT dt.uuid, dt.name, dt.description, dt.decoder, dt.inbound, dt.outbound, dt.metadata, 
						JSON_OBJECT('uuid', o.uuid, 'name', o.name) as organisation
					FROM deviceType dt
						INNER JOIN organisation o ON dt.orgId = o.id
					WHERE dt.id = ? AND dt.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DeviceType(rs[0][0])
	}
	async getDeviceTypeByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDeviceTypeById(id, deleted)
	}
	async getDbDeviceTypeByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDbDeviceTypeById(id, deleted)
	}
	async getDeviceTypesByUUID(uuids = false, deleted = 0) {
		if (uuids === false) {
			return false
		}
		let clause = (uuids.length > 0) ? ' AND dt.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT dt.uuid, dt.name, dt.description, dt.decoder, dt.inbound, dt.outbound, dt.metadata, 
				JSON_OBJECT('uuid', o.uuid, 'name', o.name) as organisation
			FROM deviceType dt
				INNER JOIN organisation o ON dt.orgId = o.id
			WHERE dt.deleted = ? ${clause};`
		let sql = await this.db.format(select, deleted, uuids)
		console.log(sql)
		let rs = await this.db.query(select, deleted, uuids)
		if (rs[0].length === 0) {
			return false
		}
		let result = []
		rs[0].forEach(async rsDev => {
			let device = new DeviceType(rsDev)
			result.push(device)
		})
		return result
	}
	async getIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM deviceType dt WHERE dt.uuid = ? AND dt.deleted = ?`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
}
module.exports = sentiDeviceTypeService