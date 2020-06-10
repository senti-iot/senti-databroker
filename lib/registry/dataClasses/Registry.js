const sentiData = require('senti-apicore').sentiData


class Registry extends sentiData {
	// id = null
	uuid = null
	uuname = null
	name = null
	description = null
	org = null
	created = null
	orgId = null
	protocol = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}

module.exports = Registry