const express = require('express')
const router = express.Router()
const verifyAPIVersion = require('senti-apicore').verifyapiversion
const { authenticate } = require('senti-apicore')
var mysqlConn = require('../../mysql/mysql_handler')
const asyncForEach = require('../../utils/asyncForEach')

router.get('/:version/:customerID/location/:location/registries/:registryName/devices/:deviceName', async (req, res) => {
	let apiVersion = req.params.version
	let deviceName = req.params.deviceName
	let registryName = req.params.registryName
	let authToken = req.headers.auth
	if (verifyAPIVersion(apiVersion)) {
		if (authenticate(authToken)) {
			if (deviceName && registryName) {
				let regQ = "SELECT * from `Registry` where name=? && isDeleted = 0"
				let devQ = "SELECT * from `Device` where reg_name=? && isDeleted = 0"
				let devDataQ = "SELECT * from `Device_data` where device_name=? && reg_name=?"
				let registriy = null
				// console.log(devDataQ, deviceName, registryName)
				let [regs, fields] = await mysqlConn.query(regQ, [registryName])
				if (regs.length !== 0) {
					registry = regs[0]
					let [devices, fields] = await mysqlConn.query(devQ, [registryName])
					let dArr = devices
					await asyncForEach(devices,async d => {
						let [deviceData, fields] = await mysqlConn.query(devDataQ, [deviceName, registryName])
						console.log(d)
						d.data = deviceData
						// console.log(d)
					})
					registry.devices = dArr
					res.status(200).json(registry)

				}
				res.status(404);
				// res.status(200).json(result)
				// }
				// console.log('Regs', registries)
			}
		}
	}
});

module.exports = router