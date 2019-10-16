const express = require('express')
const router = express.Router()
const fileLogger = require('../../server').logger

router.all('*', (req, res, next) => {
	// fileLogger.info(req)
	// req.log.child = {}
	// res.log.info(req)
	next()
});


module.exports = router