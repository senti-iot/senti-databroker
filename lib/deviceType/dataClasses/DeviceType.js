const sentiData = require('senti-apicore').sentiData

class DeviceType extends sentiData {
	uuid = null
	name  = false
	description  = null
	decoder = null
	inbound = null
	outbound = null
	metadata  = null
	org = false
	orgId = false
	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = DeviceType
