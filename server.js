#!/usr/bin/env nodejs
process.title = "senti_databroker"

//#region Express
const dotenv = require('dotenv').load()
if (dotenv.error) {
	console.warn(dotenv.error)
}
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
// const pino = require('pino')
// const fs = require('fs');
const log = require('./api/logging/index').log
const app = express()
module.exports.log = log
// })
// const logService = require('./mqtt/logService')
// const logServ = new logService()
// module.exports.logService = logServ
const testing = require('./api/logging/logger')

// const pino = require('pino')()
// const expressPino = require('express-pino-logger')({
// 	logger: pino()
// })
// app.use([expressPino])

const sentiAuthClient = require('senti-apicore').sentiAuthClient
const authClient = new sentiAuthClient(process.env.AUTHCLIENTURL, process.env.PASSWORDSALT)
module.exports.authClient = authClient

const sentiAclBackend = require('senti-apicore').sentiAclBackend
const sentiAclClient = require('senti-apicore').sentiAclClient

const aclBackend = new sentiAclBackend(process.env.ACLBACKENDTURL)
const aclClient = new sentiAclClient(aclBackend)
module.exports.aclClient = aclClient


app.use('/', testing)
//#region Device
const getDevice = require('./api/device/getDevice')
const getDevices = require('./api/device/getDevices')
const updateDevice = require('./api/device/updateDevice')
const createDevice = require('./api/device/createDevice')
const deleteDevice = require('./api/device/deleteDevice')
// V2
// const getDeviceV2 = require('./api/v2/device/getDevice')
// const getDevicesV2 = require('./api/v2/device/getDevices')
// const createDeviceV2 = require('./api/v2/device/createDevice')

const getWaterworksV2 = require('./api/v2/waterworks/waterworks')

//#endregion

//#region Registries
const getRegistries = require('./api/registry/getRegistries')
const getRegistryDevices = require('./api/registry/getRegistryDevices')
const getRegistry = require('./api/registry/getRegistry')
const createReg = require('./api/registry/createRegistry')
const updateReg = require('./api/registry/updateRegistry')
const deleteReg = require('./api/registry/deleteRegistry')
// V2
// const getRegistryV2 = require('./api/v2/registry/getRegistry')

//#endregion

//#region Device Types
const getDT = require('./api/deviceType/getDeviceType')
const getDTs = require('./api/deviceType/getDeviceTypes')
const updateDT = require('./api/deviceType/updateDeviceType')
const createDT = require('./api/deviceType/createDeviceType')
const deleteDT = require('./api/deviceType/deleteDeviceType')
//#endregion

//#region Device Data
const getDeviceData = require('./api/deviceData/getDeviceData')
const getMessages = require('./api/deviceData/getMessages')
const getDataExternal = require('./api/deviceData/getDataExternal')
//#endregion

//#region Customer
const updateCustomer = require('./api/customer/updateCustomer')
const createCustomer = require('./api/customer/createCustomer')
const getCustomer = require('./api/customer/getCustomer')
const deleteCustomer = require('./api/customer/deleteCustomer')
//#endregion

//#region Org Metadata
const getOrg = require('./api/org/getOrgMetadata')

//#endregion
const port = process.env.NODE_PORT

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())

// V2 USE
// app.use([getDeviceV2, getDevicesV2, createDeviceV2])
// app.use([getRegistryV2])
app.use([getWaterworksV2])

// V1 USE
app.use([getMessages, getDeviceData, getDataExternal,
	getDT, getDTs, createDT, updateDT, deleteDT,
	getDevice, getDevices, createDevice, updateDevice, deleteDevice,
	getRegistry, getRegistryDevices, getRegistries, createReg, updateReg, deleteReg,
	createCustomer, getCustomer, updateCustomer, deleteCustomer,
	getOrg])

//DEV DO NOT UNCOMMENT
const HotMess = require('./api/DONOTRUN/SERIOUSLYDONT')

app.use([HotMess])

var allRoutes = require('./api/logging/routeLogging');

const startAPIServer = () => {
	console.clear()
	allRoutes(app)
	console.log('Senti'.green.bold + ' - Data'.cyan.bold + ' Broker'.cyan.bold)
	app.listen(port, () => {
		console.log('Server started on port: ' + port.toString().yellow.bold)
		// log('Senti DataBroker started on port ' + port.toString(), 'info')
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

const SecureStoreMqttHandler = require('./mqtt/secureStore')
const secureMqttClient = new SecureStoreMqttHandler(process.env.MQTT_HOST, process.env.MQTT_USER, process.env.MQTT_PASS, 'dataBroker')
secureMqttClient.connect()
