#!/usr/bin/env nodejs

//#region Express
const dotenv = require('dotenv').load()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pino = require('pino')
const fs = require('fs');
const app = express()
// module.exports.logger = console
module.exports.logger = pino(pino.destination(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}-others.json`))
// const logger=pino(pino.destination(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}.json`))
// module.exports.logger = pino(pino.extreme(`/var/log/nodejs/databroker/${new Date().toLocaleDateString().replace(/\//g, '-')}-others.json`))
// const expressPino = require('express-pino-logger')({
// 	logger: logger
// })
const testing = require('./api/logging/logger')

// const pino = require('pino')()
// const expressPino = require('express-pino-logger')({
// 	logger: pino()
// })
// app.use([expressPino])
app.use('/', testing)
//#region Device
const getDevice = require('./api/device/getDevice')
const getDevices = require('./api/device/getDevices')
const updateDevice = require('./api/device/updateDevice')
const createDevice = require('./api/device/createDevice')
//#endregion

//#region Registries
const getRegistries = require('./api/registry/getRegistries')
const getRegistryDevices = require('./api/registry/getRegistryDevices')
const getRegistry = require('./api/registry/getRegistry')
const createReg = require('./api/registry/createRegistry')
const updateReg = require('./api/registry/updateRegistry')
//#endregion

//#region Device Types
const getDT = require('./api/deviceType/getDeviceType')
const getDTs = require('./api/deviceType/getDeviceTypes')
const updateDT = require('./api/deviceType/updateDeviceType')
const createDT = require('./api/deviceType/createDeviceType')
//#endregion

//#region Device Data
const getDeviceData = require('./api/deviceData/getDeviceData')
const getMessages = require('./api/deviceData/getMessages')
//#endregion

//#region Customer
const updateCustomer = require('./api/customer/updateCustomer')
const createCustomer = require('./api/customer/createCustomer')
const getCustomer = require('./api/customer/getCustomer')
//#endregion

const port = process.env.NODE_PORT

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())

app.use('/', [getDT, getDTs, createDT, updateDT, getMessages])
app.use('/', [getDevice, getDevices, createDevice, updateDevice])
app.use('/', [getRegistry, getRegistryDevices, getRegistries, createReg, updateReg])
app.use('/', [createCustomer, getCustomer, updateCustomer])
app.use('/', [getDeviceData])

var allRoutes = require('./api/logging/routeLogging');

const startAPIServer = () => {
	console.clear()
	console.log('Senti'.green.bold + ' - Data'.cyan.bold + ' Broker'.cyan.bold)
	app.listen(port, () => {
		console.log('Server started on port: ' + port.yellow.bold)
		// allRoutes(app)
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

// var MDataStoreMqttHandler = require('./mqtt/missedData')
// let mqttmDataStoreClient = new MDataStoreMqttHandler()
// mqttmDataStoreClient.connect()

// var StateMqttHandler = require('./mqtt/state')
// let mqttStateClient = new StateMqttHandler()
// mqttStateClient.connect()
//#endregion
// console.log(logger)
