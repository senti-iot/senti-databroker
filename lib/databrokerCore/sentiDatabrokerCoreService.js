
var moment = require('moment');
var DbOrganisation = require('../organisation/dataClasses/dbOrganisation')
var Organisation = require('../organisation/dataClasses/organisation')
const sqlOrganisationFields = `O.uuid, O.uuname, O.name, O.nickname, O.address, O.zip, O.city, O.country,
	O.website, O.aux, O.parentOrgId, O.created, O.modified`

class sentiDatabrokerCoreService {
	db = null

	constructor(db = null) {
		this.db = db
	}
	async getDbOrganisationById(id) {
		let organisationByIdSQL = `SELECT id, uuid, uuname, name, nickname, address, zip, city, country, website, aux, internal, parentOrgId, deleted, created, modified
			FROM organisation O
			WHERE O.id = ?;`
		let rs = await this.db.query(organisationByIdSQL, [id])
		if (rs[0].length !== 1) {
			return false
		}
		let organisation = new DbOrganisation(rs[0][0])
		return organisation
	}
	async getDbOrganisationByUUID(id) {
		let orgSQL = `SELECT id FROM organisation O WHERE O.uuid = ?;`
		let rs = await this.db.query(orgSQL, [id])
		if (rs[0].length !== 1) {
			return false
		}
		return await this.getDbOrganisationById(rs[0][0].id)
	}
	async getOrganisationById(id) {
		let organisationByIdSQL = `SELECT ${sqlOrganisationFields}
			FROM organisation O
			WHERE O.id = ?
				AND O.deleted = 0;`

		let rs = await this.db.query(organisationByIdSQL, [id])
		if (rs[0].length !== 1) {
			return false
		}
		let organisation = new Organisation(rs[0][0])
		organisation.created = moment(organisation.created).format()
		organisation.modified = moment(organisation.modified).format()
		if (rs[0][0].orgId !== 0) {
			organisation.org = await this.getOrganisationById(rs[0][0].parentOrgId)
		}
		return organisation
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
		let rs = await this.db.query(sql, [id])
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