#!/usr/bin/env nodejs

//#region Express
const dotenv = require('dotenv').load()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pino = require('pino')
const fs = require('fs');
const app = express()
module.exports.logger=pino(pino.destination(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}-others.json`))
const logger=pino(pino.destination(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}.json`))
// logger.info({ MIX: { IN: true } }) // only a one time post

// module.exports.logger = pino(pino.extreme(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}.json`))
const expressPino = require('express-pino-logger')({
	logger: logger
})
// logger.info('test')
// logger.error('test2')
// logger2.info("TEST2")
// logger2.debug("TEST")
// logger2.error({ MIX: { IN: true } })

const updateDevice = require('./api/device/updateDevice')
const createDevice = require('./api/device/createDevice')
const updateReg = require('./api/registry/updateRegistry')
const createReg = require('./api/registry/createRegistry')
const updateDT = require('./api/deviceType/updateDeviceType')
const createDT = require('./api/deviceType/createDeviceType')
const getDeviceData = require('./api/deviceData/getDeviceData')

const port = process.env.NODE_PORT

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(expressPino)

app.use(cors())

app.use('/', [createDT, updateDT])
app.use('/', [createDevice, updateDevice])
app.use('/', [createReg, updateReg])
app.use('/', [getDeviceData])

const startAPIServer = () => {
	console.clear()
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
let mqttStoreClient = new StoreMqttHandler()
mqttStoreClient.connect()

var StateMqttHandler = require('./mqtt/state')
let mqttStateClient = new StateMqttHandler()
mqttStateClient.connect()
//#endregion
// console.log(logger)
