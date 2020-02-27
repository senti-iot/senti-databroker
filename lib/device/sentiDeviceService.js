const Device = require('./dataClasses/Device')

class sentiDeviceService {
	db = null

	constructor(db = null) {
		this.db = db
	}

	async getDeviceById(id) {
		let select = `SELECT d.id, d.name, d.type_id, d.reg_id, dm.\`data\` as metadata, dm.inbound as cloudfunctions, d.communication from Device d
					INNER JOIN Registry r ON r.id = d.reg_id
					INNER JOIN Customer c on c.id = r.customer_id
					LEFT JOIN Device_metadata dm on dm.device_id = d.id
					WHERE d.id = ? AND d.deleted = 0;`
		let rs = await this.db.query(select, [id])
		if (rs[0].length !== 1) {
			return false
		}
		return new Device(rs[0][0])
			
	}
}
module.exports = sentiDeviceService