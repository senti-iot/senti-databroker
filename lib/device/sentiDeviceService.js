const { v4: uuidv4 } = require('uuid')
const Device = require('./dataClasses/Device')
const DbDevice = require('./dataClasses/DbDevice')
const RequestDevice = require('./dataClasses/RequestDevice')

class sentiDeviceService {
	db = null

	constructor(db = null) {
		this.db = db
	}
	async getIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM device d WHERE d.uuid = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
	async getDeviceById(id, deleted = 0) {
		let select = `SELECT d.id, d.uuid, d.uuname, d.name, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication
				FROM device d
					INNER JOIN registry r ON r.id = d.reg_id
					INNER JOIN customer c on c.id = r.customer_id
					LEFT JOIN deviceMetadata dm on dm.device_id = d.id
				WHERE d.id = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new Device(rs[0][0])
	}
	async getDbDeviceById(id, deleted = 0) {
		let select = `SELECT d.id, d.uuid, d.uuname, d.name, d.type_id, d.reg_id, d.metadata, d.lat, d.lng, d.address, d.locType, d.communication, d.deleted
				FROM device d
				WHERE d.id = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbDevice(rs[0][0])
	}

	async getDeviceByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDeviceById(id, deleted)
	}

	async getOrganisationDeviceByUUName(orgUUID, uuname, deleted = 0) {
		let select = `SELECT d.id 
						FROM device d 
							INNER JOIN registry r ON d.reg_id = r.id
							INNER JOIN organisation o ON r.orgId = o.id AND o.uuid = ?
						WHERE d.uuname = ? AND d.deleted = ?;`
		console.log(select)
		console.log(orgUUID, uuname, deleted)
		let rs = await this.db.query(select, [orgUUID, uuname, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return await this.getDeviceById(rs[0][0].id, deleted)
	}
	async getDevicesByUUID(uuids = false) {
		if (uuids === false) {
			return false
		}
		let clause = (uuids.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT d.id, d.uuid, d.uuname, d.name, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication
			FROM device d
				LEFT JOIN deviceMetadata dm on dm.device_id = d.id
			WHERE d.deleted = 0 ${clause};`
		let rs = await this.db.query(select, uuids)
		if (rs[0].length === 0) {
			return false
		}
		let result = []
		rs[0].forEach(async rsDev => {
			let device = new Device(rsDev)
			result.push(device)
		})
		return result
	}
	async createDevice(device = false) {
		if (device === false) {
			return false
		}
		let dbO = new DbDevice(device)
		if (dbO.name === false || dbO.type_id === false || dbO.reg_id === false) {
			return false
		}
		dbO.uuid = dbO.uuid !== null ? dbO.uuid : uuidv4()
		dbO.uuname = dbO.uuname !== null ? dbO.uuname : dbO.name.replace(' ', '').toLowerCase() + '-' + this.shortHashGen(dbO.uuid)
		// should we add created, modified
		let insert = `INSERT INTO device(uuid, uuname, name, type_id, reg_id, description, metadata, lat, lng, address, locType, communication, deleted) 
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
		let sql = this.db.format(insert, [dbO.uuid, dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata, 
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, dbO.deleted])
		console.log(sql)
		let rs = await this.db.query(insert, [dbO.uuid, dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata, 
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, dbO.deleted])
		if (rs[0].affectedRows === 1) {
			return await this.getDbDeviceById(rs[0].insertId)
		}
		return false
	}
	shortHashGen(source) {
		var i = 0, j = 0, bitshift = 0, mask = 0x3f, mask0 = 0, mask1 = 0, val = 0;
		var block = [];
		//              0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
		var dictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$";
		var result = "";
		let binsrc = []
		while (source.length >= 2) {
			binsrc.push(parseInt(source.substring(0, 2), 16));
			source = source.substring(2, source.length);
		}
		// init block of 8 bytes plus one guard byte
		for (i = 0; i < 9; i++) {
			block[i] = 0;
		}
		// fold input
		for (i = 0; i < binsrc.length; i++) {
			block[i % 8] = block[i % 8] ^ binsrc[i];
		}
		i = 0;
		while (i < 64) {
			j = i >> 3; // byte index
			bitshift = i % 8; // bit index
			mask0 = mask << bitshift;
			result = result + dictionary[(block[j] & mask0 & 0xff | block[j + 1] << 8 & mask0 & 0xff00) >> bitshift];
			i += 6;
		}
		return result;
	}
}
module.exports = sentiDeviceService