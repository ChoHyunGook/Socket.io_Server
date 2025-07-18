const GroupService = require('../service/groupService');

class GroupController {
    constructor() {
        this.service = new GroupService();
    }

    // GET /get/userInfo
    async MigrateTablesToGroups(req, res) {
        try {
            const userInfo = await this.service.migrateTablesToGroups();
            res.status(200).json(userInfo);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // GET /get/groupInfo
    async getGroupInfo(req, res) {
        try {
            const userInfo = await this.service.getGroupInfo();
            res.status(200).json(userInfo);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = GroupController;
