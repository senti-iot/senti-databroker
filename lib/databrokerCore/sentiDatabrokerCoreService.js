

class sentiDatabrokerCoreService {
	db = null

	constructor(db = null) {
		this.db = db
	}

	async getOrganisationIdByUUID(uuid = false, deleted = 0) {
		if (uuid === false) {
			return false
		}
		let select = `SELECT id FROM organisation o WHERE o.uuid = ? AND o.deleted = ?`
		let rs = await this.db.query(select, [uuid, deleted])
		if (rs[0].length !== 1) {
			return false
		}
		return rs[0][0].id
	}
	async getAclOrgResourcesOnName(id) {
		let sql = `SELECT AOR.uuid, R.name, R.type FROM aclOrganisationResource AOR INNER JOIN aclResource R ON AOR.resourceId = R.id WHERE AOR.orgId = ?;`
		let rs = await mysqlConn.query(sql, [id])
		if (rs[0].length === 0) {
			return false
		}
		let result = []
		rs[0].forEach(orgResource => {
			result[orgResource.name] = { uuid: orgResource.uuid, type: orgResource.type }
		})
		return result
	}
}

module.exports = sentiDatabrokerCoreService