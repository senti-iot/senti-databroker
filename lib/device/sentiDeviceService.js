const Device = require('./dataClasses/Device')

class sentiDeviceService {
	db = null

	constructor(db = null) {
		this.db = db
	}

	async getDeviceById(id, deleted = 0) {
		let select = `SELECT D.id, D.uuid, D.uuname, D.name, D.type_id, D.reg_id, DM.\`data\` as metadata, DM.inbound as cloudfunctions, D.communication
				FROM device D
					INNER JOIN registry R ON R.id = D.reg_id
					INNER JOIN customer C on C.id = R.customer_id
					LEFT JOIN deviceMetadata DM on DM.device_id = D.id
				WHERE D.id = ? AND D.deleted = ?;`
		let rs = await this.db.query(select, [id, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return new Device(rs[0][0])
	}
	async getDeviceByUUID(uuid, deleted = 0) {
		let select = `SELECT D.id FROM device D WHERE D.uuid = ? AND D.deleted = ?;`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return await this.getDeviceById(rs[0][0].id, deleted)
	}

	async getOrganisationDeviceByUUName(orgUUID, uuname, deleted = 0) {
		let select = `SELECT D.id 
						FROM device D 
							INNER JOIN registry R ON D.reg_id = R.id
							INNER JOIN organisation O ON R.orgId = O.id AND O.uuid = ?
						WHERE D.uuname = ? AND D.deleted = ?;`
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
		let clause = (uuids.length > 0) ? ' AND D.uuid IN (?' + ",?".repeat(uuids.length - 1) + ') ' : ''
		let select = `SELECT D.id, D.uuid, D.uuname, D.name, D.type_id, D.reg_id, DM.\`data\` as metadata, DM.inbound as cloudfunctions, D.communication
			FROM device D
				LEFT JOIN deviceMetadata DM on DM.device_id = D.id
			WHERE D.deleted = 0 ${clause};`
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
}
module.exports = sentiDeviceService