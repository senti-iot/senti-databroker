const sentiData = require('senti-apicore').sentiData


class CloudFunction extends sentiData {
	id = null
	uuid = null
	name = null
	js = null
	type = null
	description = null
	orgId = null
	org = {
		uuid: null,
		name: null
	}

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = CloudFunction
