const sentiData = require('senti-apicore').sentiData



class RequestRegistry extends sentiData {
	uuid = null
	name = null
	uuname = null
	region = null
	protocol = 0
	ca_certificate = null
	org = {
		uuid: null
	}
	customer_id = null
	created = null
	description = null
	deleted = 0
	config = null

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}

module.exports = RequestRegistry