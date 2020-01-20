function cleanUpSpecialChars(str) {

	return str.toString()
		.replace(/[øØ]/g, "ou")
		.replace(/[æÆ]/g, "ae")
		.replace(/[åÅ]/g, "aa")
		.replace(/[^a-z0-9]/gi, '-'); // final clean up
}

module.exports = cleanUpSpecialChars