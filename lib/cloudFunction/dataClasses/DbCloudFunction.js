const sentiData = require('senti-apicore').sentiData


class DbCloudFunction extends sentiData {
	id = null
	uuid = null
	name = null
	js = null
	type = null
	description = null
	orgId = null
	deleted = 0
	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = DbCloudFunction
