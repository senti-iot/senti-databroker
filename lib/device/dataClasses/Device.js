const sentiData = require('senti-apicore').sentiData


/**
 * Return to UI
 */
class Device extends sentiData {
	id = null
	uuid = null
	uuname = null
	name = null
	type_id = null
	reg_id = null
	metadata = null
	cloudfunctions = null
	communication = null
	registry = false
	deviceType = false
	created = null
	modified = null
	dataKeys = []

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Device
