const sentiData = require('senti-apicore').sentiData


/**
 * Return to UI
 */
class CloudFunction extends sentiData {
	id = null
	uuid = null
	name = null
	js = null
	type = null
	description = null
	orgId = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = CloudFunction
