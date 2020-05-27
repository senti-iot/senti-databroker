
class sentiDeviceTypeService {
	db = null

	constructor(db = null) {
		this.db = db
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