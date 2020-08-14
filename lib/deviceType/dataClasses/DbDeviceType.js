const sentiData = require('senti-apicore').sentiData

class DbDeviceType extends sentiData {
	id
	uuid = null
	name  = false
	description  = null
	decoder = null
	inbound = null
	outbound = null
	metadata  = null
	orgId = null
	deleted = 0

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = DbDeviceType
