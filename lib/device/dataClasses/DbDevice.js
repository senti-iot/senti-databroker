const sentiData = require('senti-apicore').sentiData

/**
 * What we get from the DB
 */
class DbDevice extends sentiData {
	id
	uuid = null
	uuname = null
	name = false
	type_id = false
	reg_id = false
	description = null
	metadata = null
	lat = null
	lng = null
	address = null
	locType = null
	communication = 1
	deleted = 0
	created = null
	modified = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = DbDevice
