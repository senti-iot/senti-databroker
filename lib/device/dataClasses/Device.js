const sentiData = require('senti-apicore').sentiData

class Device extends sentiData {
	id = null
	name  = null
	type_id = null
	reg_id = null
	metadata = null
	cloudfunctions = null
	communication = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Device
