const sentiData = require('senti-apicore').sentiData

class RequestDevice extends sentiData {
	uuid = null
	uuname = null
	name  = false
	description
	typeUUID = null
	regUUID = null
	metadata
	lat
	lng
	address
	locType
	communication = null
	type_id = false
	reg_id = false

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = RequestDevice
