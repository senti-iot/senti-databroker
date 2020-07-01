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

//#region MQTT
const SecureStoreMqttHandler = require('./mqtt/secureStore')
const secureMqttClient = new SecureStoreMqttHandler(process.env.MQTT_HOST, process.env.MQTT_USER, process.env.MQTT_PASS, 'dataBroker')
secureMqttClient.connect()
module.exports.secureMqttClient = secureMqttClient
//#endregion


app.use('/', testing)
//#region Device
const getDevice = require('./api/device/getDevice')
const getDevices = require('./api/device/getDevices')
const updateDevice = require('./api/device/updateDevice')
const createDevice = require('./api/device/createDevice')
const deleteDevice = require('./api/device/deleteDevice')
// V2
const getDeviceV2 = require('./api/v2/device/getDevice')
const getDevicesV2 = require('./api/v2/device/getDevices')
const createDeviceV2 = require('./api/v2/device/createDevice')
const deleteDeviceV2 = require('./api/v2/device/deleteDevice')
const updateDeviceV2 = require('./api/v2/device/updateDevice')
const getWaterworksV2 = require('./api/v2/waterworks/waterworks')
const climaidInsightV2 = require('./api/v2/climaidInsight/climaidInsight')

//#endregion

//#region Registries
// V2
const createRegistryV2 = require('./api/v2/registry/createRegistry')
const getRegistryV2 = require('./api/v2/registry/getRegistry')
const getRegistriesV2 = require('./api/v2/registry/getRegistries')
const updateRegistryV2 = require('./api/v2/registry/updateRegistry')
const deleteRegistryV2 = require('./api/v2/registry/deleteRegistry')
// V1
const getRegistries = require('./api/registry/getRegistries')
const getRegistryDevices = require('./api/registry/getRegistryDevices')
const getRegistry = require('./api/registry/getRegistry')
const createReg = require('./api/registry/createRegistry')
const updateReg = require('./api/registry/updateRegistry')
const deleteReg = require('./api/registry/deleteRegistry')
//#endregion

//#region Device Types
const getDT = require('./api/deviceType/getDeviceType')
const getDTs = require('./api/deviceType/getDeviceTypes')
const updateDT = require('./api/deviceType/updateDeviceType')
const createDT = require('./api/deviceType/createDeviceType')
const deleteDT = require('./api/deviceType/deleteDeviceType')
// V2
const getDeviceTypeV2 = require('./api/v2/devicetype/getDeviceType')
const getDeviceTypesV2 = require('./api/v2/devicetype/getDeviceTypes')
const createDeviceTypeV2 = require('./api/v2/devicetype/createDeviceType')
const updateDeviceTypeV2 = require('./api/v2/devicetype/updateDeviceType')
const deleteDeviceTypeV2 = require('./api/v2/devicetype/deleteDeviceType')
//#endregion

//#region Cloud Functions
const getCFs = require('./api/v2/cloudfunction/getCloudFunctions')
const getCF = require('./api/v2/cloudfunction/getCloudFunction')
const createCF = require('./api/v2/cloudfunction/createCloudFunction')
const updateCF = require('./api/v2/cloudfunction/updateCloudFunction')
const deleteCF = require('./api/v2/cloudfunction/deleteCloudFunction')

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

/**
 * Devices V2
 */
app.use([getDeviceV2, getDevicesV2, createDeviceV2, updateDeviceV2, deleteDeviceV2])

/**
 * Device Types V2
 */
app.use([getDeviceTypeV2, getDeviceTypesV2, createDeviceTypeV2, updateDeviceTypeV2, deleteDeviceTypeV2])

/**
 * Registries V2
 */
app.use([createRegistryV2, getRegistryV2, getRegistriesV2, updateRegistryV2, deleteRegistryV2])
app.use([getWaterworksV2])
app.use([climaidInsightV2])

/**
 * Cloud functions V2
 */
app.use([getCF, getCFs, createCF, updateCF, deleteCF])

// V1 USE
app.use([getMessages, getDeviceData, getDataExternal,
	getDT, getDTs, createDT, updateDT, deleteDT,
	getDevice, getDevices, createDevice, updateDevice, deleteDevice,
	getRegistry, getRegistryDevices, getRegistries, createReg, updateReg, deleteReg,
	createCustomer, getCustomer, updateCustomer, deleteCustomer,
	getOrg])

//DEV DO NOT UNCOMMENT
// const HotMess = require('./api/DONOTRUN/SERIOUSLYDONT')
// app.use([HotMess])

var allRoutes = require('./api/logging/routeLogging')

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
