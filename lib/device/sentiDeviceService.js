const { v4: uuidv4 } = require('uuid')
const Device = require('./dataClasses/Device')
const DbDevice = require('./dataClasses/DbDevice')
// const RequestDevice = require('./dataClasses/RequestDevice')

class sentiDeviceService {
	db = null

	constructor(db = null) {
		this.db = db
	}
	async getIdByUUID(uuid = false, deleted = 0) {
		// console.log('UUID', uuid)
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM device d WHERE d.uuid = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		// console.log(rs[0][0])
		return rs[0][0].id
	}
	async getIdByUUName(uuname = false, deleted = 0) {
		// console.log('getIdByUUName UUName', uuname)
		if (uuname === false) {
			return false
		}
		let select = `SELECT id FROM device d WHERE d.uuname = ? AND d.deleted = ?;`
		let sql = this.db.format(select, [uuname, deleted])
		// console.log('getIdByUUName SQL', sql)
		let rs = await this.db.query(select, [uuname, deleted])
		if (rs[0].length < 1) {
			return false
		}
		// console.log('getIdByUUName rs', rs[0][0])
		return rs[0][0].id
	}
	async getDeviceById(id) {
		if (id === false) {
			return false
		}
		/**
		 * Removed INNER JOIN customer c on c.id = r.customer_id
		 */
		let select = `SELECT d.id, d.uuid, d.uuname, d.name, d.type_id, d.reg_id, d.metadata, d.lat, d.lng as lon, d.communication, d.description, d.address, d.locType,
					JSON_OBJECT('uuid', r.uuid, 'name', r.name, 'protocol', r.protocol, 'uuname', r.uuname, 'org', JSON_OBJECT('uuid', o.uuid, 'name', o.name, 'uuname', o.uuname)) as registry,
					JSON_OBJECT('uuid', dt.uuid, 'name', dt.name) as deviceType,
					JSON_OBJECT('uuid', o.uuid, 'name', o.name, 'uuname', o.uuname) as org,
					dt.outbound as dataKeys,
					dt.inbound as decoder,
					d.created, d.modified,
					d.dataKeys as syntheticKeys,
					IF(ISNULL(tr.resourceUUID) OR ISNULL(t.uuid), JSON_ARRAY(), JSON_ARRAYAGG(JSON_OBJECT('uuid',t.uuid, 'name', t.name, 'color', t.color, 'description', t.description))) as tags
				FROM device d
					INNER JOIN registry r ON r.id = d.reg_id
					INNER JOIN organisation o ON o.id = r.orgId
					INNER JOIN deviceType dt ON dt.id = d.type_id
					LEFT JOIN tagResource tr ON tr.resourceUUID = d.uuid AND tr.deleted = 0
					LEFT JOIN tag t ON t.uuid = tr.tagUUID AND t.deleted = 0
				WHERE d.id = ? AND d.deleted = 0;`
		let rs = await this.db.query(select, [id])
		// console.log('Get Device:', rs[0])
		if (rs[0].length !== 1) {
			return false
		}
		let allKeys = []
		if (rs[0][0].dataKeys) {
			allKeys = [...allKeys, ...rs[0][0].dataKeys.map(k => ({ ...k, origin: 'devicetype' }))]
		}
		if (rs[0][0].syntheticKeys) {
			allKeys = [...allKeys, ...rs[0][0].syntheticKeys.map(k => ({ ...k, origin: 'device' }))]
		}
		rs[0][0].dataKeys = allKeys
		return new Device(rs[0][0])
	}
	async getDbDeviceById(id, deleted = 0) {
		let select = `SELECT d.id, d.uuid, d.uuname, d.name, d.type_id, d.reg_id, d.metadata, d.lat, d.lng, d.address, d.locType, d.communication, d.deleted, d.created, d.modified, d.dataKeys
				FROM device d
				WHERE d.id = ? AND d.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new DbDevice(rs[0][0])
	}

	async getSubOrgs(orgUUID) {
		let result = []
		//Get the org parentId
		let getOrgIdQuery = `SELECT id from organisation o where o.uuid = ?`
		let getOrgResult = await this.db.query(getOrgIdQuery, [orgUUID])
		let orgId = getOrgResult[0][0].id
		if (orgId) {
			//Get the orgs having the parent ID
			let selectQuery = `SELECT uuid, parentOrgId from organisation o
			WHERE o.parentOrgId = ?
			`
			let selectResult = await this.db.query(selectQuery, [orgId])
			result.push(...selectResult[0])
			let subs = [...selectResult[0]]
			//Recursive to find all Suborgs of suborgs
			await Promise.all(subs.map(async s => result.push(...await this.getSubOrgs(s.uuid)))).then(rs => rs)
		}
		return result
	}

	async getSubOrgDevices(orgUUIDs) {
		let uuids = orgUUIDs.map(o => o.uuid)
		let result = []
		await Promise.all(uuids.map(async u => result.push({ uuid: u, total: await this.getTotalDevices(u) })))
		return result

	}
	async getTotalDevices(orgUUID) {
		let selectQuery = `SELECT count(*) as total from device d
						   INNER JOIN registry r on r.id = d.reg_id
						   INNER JOIN organisation o on o.id = r.orgId
						   WHERE o.uuid = ? AND d.deleted = 0`
		// let format = await this.db.format(selectQuery, [orgUUID])
		// console.log(format)
		let select = await this.db.query(selectQuery, [orgUUID])
		return select[0][0].total
	}

	async getDeviceByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDeviceById(id, deleted)
	}
	async getDbDeviceByUUID(uuid, deleted = 0) {
		let id = await this.getIdByUUID(uuid, deleted)
		if (id === false) {
			return false
		}
		return await this.getDbDeviceById(id, deleted)
	}

	async getOrganisationDeviceByUUName(orgUUID, uuname, deleted = 0) {
		let select = `SELECT d.id
						FROM device d
							INNER JOIN registry r ON d.reg_id = r.id
							INNER JOIN organisation o ON r.orgId = o.id AND o.uuid = ?
						WHERE d.uuname = ? AND d.deleted = ?;`
		// console.log(select)
		// console.log(orgUUID, uuname, deleted)
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
		/**
		 * Removed fields
		 *  d.description,
		 *    d.metadata,
		 * d.type_id,
		 * d.reg_id,
		 *
		 */
		let clause = (uuids.length > 0) ? ' AND d.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT
                    d.id,
                    d.uuid,
					d.description,
                    d.uuname,
                    d.name,
					d.metadata,
					d.lat,
					d.lng as lon,
                    d.communication,
                    JSON_OBJECT('uuid', r.uuid, 'name',  r.name) as registry,
                    JSON_OBJECT('uuid', dt.uuid, 'name', dt.name) as deviceType,
					JSON_OBJECT('uuid', o.uuid, 'name', o.name) as org,
                    d.created,
                    IF(ISNULL(tr.resourceUUID) OR ISNULL(t.uuid), json_ARRAY(), JSON_ARRAYAGG(if(tr.deleted = 1, JSON_OBJECT(), JSON_OBJECT('uuid', t.uuid, 'name', t.name, 'color', t.color, 'description', t.description)))) as tags
                FROM
                    device d
				LEFT JOIN tagResource tr on tr.resourceUUID = d.uuid AND tr.deleted=0
				LEFT JOIN tag t on t.uuid = tr.tagUUID AND t.deleted = 0
				INNER JOIN registry r ON r.id = d.reg_id
				INNER JOIN organisation o ON o.id = r.orgId
				INNER JOIN deviceType dt ON dt.id = d.type_id
			WHERE d.deleted = 0 ${clause}
			GROUP BY d.id;`
		let sql = this.db.format(select, uuids)
		// console.log(sql)
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

		// console.log('deviceDbO', dbO)
		if (dbO.name === false || dbO.type_id === false || dbO.reg_id === false) {
			return false
		}
		dbO.uuid = dbO.uuid !== null ? dbO.uuid : uuidv4()
		dbO.uuname = dbO.uuname !== null ? dbO.uuname : dbO.name.replace(/\s/g, '').toLowerCase() + '-' + this.shortHashGen(dbO.uuid)
		// should we add created, modified
		let insert = `INSERT INTO device(uuid, uuname, name, type_id, reg_id, description, metadata, lat, lng, address, locType, communication, deleted, created, modified, dataKeys)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(),?);`
		/**
		 * @TODO
		 * Remove when deviceMetadata table is killed
		 */
		let insertMetadata = `INSERT INTO deviceMetadata
			(device_id, \`data\`, inbound, outbound)
			VALUES(?, ?, ?, ?);`
		/**
		 * Log the SQL
		 */
		let sql = this.db.format(insert, [dbO.uuid, dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata,
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, dbO.deleted, (dbO.dataKeys !== null) ? JSON.stringify(dbO.dataKeys) : dbO.dataKeys])
		// console.log(sql)

		/**
		 * Execute the query
		 */

		let rs = await this.db.query(insert, [dbO.uuid, dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata,
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, dbO.deleted, (dbO.dataKeys !== null) ? JSON.stringify(dbO.dataKeys) : dbO.dataKeys])

		/**
		 * Insert the Metadata
		 */
		if (rs[0].affectedRows === 1) {
			let device = await this.getDbDeviceById(rs[0].insertId)
			// console.log('Device', device)
			if (device) {
				let mtd = dbO.metadata
				// console.log('mtd', mtd)
				let mtdArr = [rs[0].insertId, JSON.stringify(mtd.metadata), JSON.stringify(mtd.inbound), JSON.stringify(mtd.outbound)]
				// console.log('mtdArr', mtdArr)
				let sqlMetadata = await this.db.format(insertMetadata, mtdArr)
				// console.log('SQL', sqlMetadata)
				let resultMetadata = await this.db.query(insertMetadata, mtdArr)
				if (resultMetadata[0].affectedRows === 1) {
					return device
				}
				else {
					return false
				}
			}
			else {
				return false
			}
			// return await this.getDbDeviceById(rs[0].insertId)
		}
		return false
	}
	async updateDevice(device = false) {
		if (device === false) {
			return false
		}
		let dbO = new DbDevice(device)
		let update = `UPDATE device SET
				uuname = ?,
				name = ?,
				type_id = ?,
				reg_id = ?,
				description = ?,
				metadata = ?,
				lat = ?,
				lng = ?,
				address = ?,
				locType = ?,
				communication = ?,
				modified = NOW(),
				dataKeys = ?
			WHERE id = ?`
		let sql = this.db.format(update, [dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata,
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, (dbO.syntheticKeys !== null) ? JSON.stringify(dbO.syntheticKeys) : null, dbO.id])
		// console.log(sql)
		let rs = await this.db.query(update, [dbO.uuname, dbO.name, dbO.type_id, dbO.reg_id, dbO.description,
			(dbO.metadata !== null) ? JSON.stringify(dbO.metadata) : dbO.metadata,
			dbO.lat, dbO.lng, dbO.address, dbO.locType, dbO.communication, (dbO.syntheticKeys !== null) ? JSON.stringify(dbO.syntheticKeys) : null, dbO.id])
		if (rs[0].affectedRows === 1) {
			return await this.getDbDeviceById(rs[0].insertId)
		}
		return false
	}
	async deleteDevice(device = false) {
		if (device === false) {
			return false
		}
		let delSql = `UPDATE device
					SET
					deleted = 1
					where uuid = ?;`
		let rs = await this.db.query(delSql, [device.uuid])
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
module.exports = sentiDeviceService