function parseHexString(str) {
	var result = [];
	while (str.length >= 2) {
		result.push(parseInt(str.substring(0, 2), 16));
		str = str.substring(2, str.length);
	}
	return result;
}
function shortHashGen(source) {
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
module.exports = shortHashGen