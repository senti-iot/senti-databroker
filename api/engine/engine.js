const createAPI = require('apisauce').create
const dotenv = require('dotenv').load()



let engineAPI = createAPI({
	baseURL: 'http://127.0.0.1:3011/v1/function/device',
	headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
})

module.exports = engineAPI