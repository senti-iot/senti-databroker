const sentiData = require('senti-apicore').sentiData

class Organisation extends sentiData {
	uuid = null
	uuname
	name
	nickname
	address
	zip
	city
	country
	website
	aux = null
	org = false
	created
	modified

	constructor(data = null, vars = null) {
		super()
		this.assignData(data, vars)
	}
}
module.exports = Organisation