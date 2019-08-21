const logApi = require('../api/engine/logApi')


class logService {
	constructor() {

	}

	log(msg) {
		let packet = {
			origin: 'databroker',
			message: msg
		}
		logApi.post('/log-info', packet)
	}
}

module.exports = logService
