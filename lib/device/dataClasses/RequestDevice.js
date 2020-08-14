const sentiData = require('senti-apicore').sentiData

/**
 * UI sending to Backend
 */
class RequestDevice extends sentiData {
	uuid = null // DB
	uuname = null // DB
	name = false // DB
	description // DB
	deviceType = {
		uuid: null
	}
	registry = {
		uuid: null
	}
	typeUUID = null
	regUUID = null
	metadata // DB
	lat // DB
	lng // DB
	address // DB
	locType // DB
	communication = null // DB
	type_id = false // DB
	reg_id = false // DB

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = RequestDevice
