const express = require('express');
const GroupController = require('../controller/groupController');

const router = express.Router();
const groupController = new GroupController();

//기존 몽고 + 다이나모디비로 그룹 데이터 생성
router.get('/migrate',groupController.MigrateTablesToGroups.bind(groupController))

// GET /group/get/userInfo
router.get('/groupInfo', groupController.getGroupInfo.bind(groupController));

module.exports = router;
