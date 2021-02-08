const sql = (strings, ...expr) =>
	strings
		.map((str, index) => str + (expr.length > index ? String(expr[index]) : ''))
		.join('')

module.exports = sql