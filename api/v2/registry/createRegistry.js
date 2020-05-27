const express = require('express')
const router = express.Router()

router.post('/v2/registry', async (req, res) => {
	let lease = await authClient.getLease(req)
	if (lease === false) {
		res.status(401).json()
		return
	}
	
	let access = await aclClient.testPrivileges(lease.uuid, req.params.uuid, [sentiAclPriviledge.device.read])
	if (access.allowed === false) {
		res.status(403).json()
		return
	}
	// let device = await deviceService.getDeviceByUUID(req.params.uuid)
	// if (device === false) {
	// 	res.status(404).json()
	// 	return
	// }
	res.status(200).json(device)

})

module.exports = router