

class sentiDeviceDataService {
	db = null

	constructor(db = null) {
		this.db = db
	}

	async getLastDataFieldValueById(id, field) {
		let select = `SELECT ddc.data->'$.?' as 'value' FROM  deviceDataClean ddc WHERE ddc.device_id = ? AND ddc.data->'$.?' IS NOT NULL ORDER BY created desc LIMIT 1`
		let rs = await this.db.query(select, [field, id, field]).catch(err => {
			console.log(err)
			return false
		})
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].value
	}
}
module.exports = sentiDeviceDataService