const express = require('express')
const router = express.Router()
const mysqlConn = require('../../mysql/mysql_handler')

const createShortHash = `ALTER TABLE #
ADD shortHash varchar(11) not null`
const selectObjects = `SELECT * from #`
const updateShortHashQuery = `UPDATE # d
SET d.shortHash=? where id=?`

//#region Short Hash function generator
function parseHexString(str) {
	var result = [];
	while (str.length >= 2) {
		result.push(parseInt(str.substring(0, 2), 16));
		str = str.substring(2, str.length);
	}
	return result;
}
function shortHash(source) {
	var i = 0, j = 0, bitshift = 0, mask = 0x3f, mask0 = 0, mask1 = 0, val = 0;
	var block = [];
	//              0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
	var dictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$";
	var result = "";
	var binsrc = parseHexString(source);
	// init block of 8 bytes plus one guard byte
	for (i = 0; i < 9; i++) {
		block[i] = 0;
	}
	// fold input
	for (i = 0; i < binsrc.length; i++) {
		block[i % 8] = block[i % 8] ^ binsrc[i];
	}
	i = 0;
	while (i < 64) {
		j = i >> 3; // byte index
		bitshift = i % 8; // bit index
		mask0 = mask << bitshift;
		result = result + dictionary[(block[j] & mask0 & 0xff | block[j + 1] << 8 & mask0 & 0xff00) >> bitshift];
		i += 6;
	}
	return result;
}

//#endregion

router.get('/hotmess/do/not/run/:pass/:table', async (req, res) => {
	let pass = req.params.pass
	let table = req.params.table
	if (pass === process.env.hotmessPassword) {

		let createHashQuery;
		let selectDevicesQuery;
		let updateShortHash;
		let errors = []
		createHashQuery = createShortHash.replace('#', table)
		selectDevicesQuery = selectObjects.replace('#', table)
		updateShortHash = updateShortHashQuery.replace('#', table)
		try {
			await mysqlConn.query(createHashQuery)
		}
		catch (e) {
			errors.push(e)
		}
		try {

			let [devices] = await mysqlConn.query(selectDevicesQuery)
			devices.forEach(async d => {
				let sh = shortHash(d.uuid)
				console.log(sh)
				await mysqlConn.query(updateShortHash, [sh, d.id])
			})
		}
		catch{
			errors.push(e)
		}
		res.status(200).json({
			"createHashQuery": mysqlConn.format(createHashQuery),
			"selectDevicesQuery": mysqlConn.format(selectDevicesQuery),
			"updateShortHash": mysqlConn.format(updateShortHash),
			"errors": errors
		})

		// mysqlConn.query(createShortHash, [table]).then(rs => res.json(rs))
	}
});


module.exports = router