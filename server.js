#!/usr/bin/env nodejs

//#region Express
const dotenv = require('dotenv').load()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const app = express()


// API endpoint imports
// const indexRouter = require('./api/index')
// const weatherRouter = require('./api/weather')
// const holidaysRouter = require('./api/holidays')
// const annualRouter = require('./api/annual')
// const apiVersionRouter = require('./api/apiversion')
// const templateRouter = require('./api/template')

const editDevice = require('./api/editDevice')
const createDevice = require('./api/createDevice')
const createDT = require('./api/createDeviceType')
const createReg = require('./api/createRegistry')
const storeRouter = require('./api/store')
const port = process.env.NODE_PORT || 3001

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


app.use(cors())

app.use('/', createDT)
app.use('/', [createDevice, editDevice])
app.use('/', createReg)
// app.use('/weather', weatherRouter)
// app.use('/holidays', holidaysRouter)
// app.use('/annual', annualRouter)
// app.use('/apiversion', apiVersionRouter)
// app.use('/template', templateRouter)
// app.use('/sigfox', sigfoxRouter)
//---Start the express server---------------------------------------------------


const startAPIServer = () => {
	app.listen(port, () => {
		console.log('Senti Message Broker server started on port:', port)
	}).on('error', (err) => {
		if (err.errno === 'EADDRINUSE') {
			console.log('Server not started, port ' + port + ' is busy')
		} else {
			console.log(err)
		}
	})
}

startAPIServer()
//#endregion

//#region MQTT 
var StoreMqttHandler = require('./mqtt/store')
let mqttClient = new StoreMqttHandler('senti-data')
mqttClient.connect()
//#endregion