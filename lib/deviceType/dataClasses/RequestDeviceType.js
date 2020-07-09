const sentiData = require('senti-apicore').sentiData

class RequestDeviceType extends sentiData {
	id
	uuid = null
	name  = false
	description  = null
	decoder = null
	inbound = null
	outbound = null
	metadata  = null
	org = {
		uuid: null
	}
	orgUUID = null
	deleted = 0

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}

module.exports = RequestDeviceType
