const meetingController = require("../controllers/meeting.controller");

const express = require("express");
const router = express.Router();

router.post("/meeting/start", meetingController.startMeeting);

router.get("/meeting/findRoom", meetingController.findMeetingRooms)
router.get("/meeting/join", meetingController.checkMeetingExists);
router.get("/meeting/get", meetingController.getAllMeetingUsers);

router.post("/meeting/deleteRoom", meetingController.deleteMeetingRooms)

module.exports = router;