
const apisauce = require('apisauce')
let host;
let env = process.env.NODE_ENV
if (env === 'localhost') {
	host = 'http://localhost:3019'
}
else {
	if (env === 'development') {
		host = 'https://dev.services.senti.cloud/logger'
	}
	else {
		host = 'https://services.senti.cloud/logger'
	}
}


const loggerService = apisauce.create({
	baseURL: host,
	timout: 30000,
	headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	}
})
const origin = 'dataBroker'

const log = async (msg, type) => {
	let response = await loggerService.post('/log', { message: msg, type: type, origin: origin })
	console.log(msg, type)
	console.log(response.data)
	return response.data
}

module.exports.log = log