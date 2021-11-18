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
	lat = null
	lon = null
	cloudfunctions = null
	communication = null
	description = null
	registry = false
	deviceType = false
	created = null
	modified = null
	dataKeys = []
	decoder = []
	tags = []

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Device
