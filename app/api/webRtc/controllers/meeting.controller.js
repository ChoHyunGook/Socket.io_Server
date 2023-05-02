const meetingServices = require("../services/meeting.service");

exports.findMeetingRooms = (req, res, next) => {
    const {hostName} = req.query;
    console.log('findMeetingRooms');
    meetingServices.findMeetingRooms(hostName, (error, results) => {
        if(error) {
            return next(error);
        }
        return res.status(200).send({
            message: "Success",
            data: results
        });
    })
}

exports.startMeeting = (req, res, next) => {
    const {hostId, hostName, userRoomPassword, roomName } = req.body;
    console.log('startMeeting');
    var model = {
        hostId: hostId,
        userRoomPassword: userRoomPassword,
        roomName: roomName,
        hostName: hostName,
        startTime: Date.now()
    };

    meetingServices.startMeeting(model, (error, result) => {
        if(error) {
            return next(error);
        }
        return res.status(200).send({
            message: "Success",
            data: result,
        });
    })
}

exports.checkMeetingExists = (req, res, next) => {
    const {meetingId} = req.query;
    console.log('checkMeetingExists');
    meetingServices.checkMeetingExists(meetingId, (error, results) => {
        if(error) {
            return next(error);
        }
        return res.status(200).send({
            message: "Success",
            data: results
        });
    })
}

exports.getAllMeetingUsers = (req, res, next) => {
    const {meetingId} = req.query;
    console.log('getAllMeetingUsers');
    meetingServices.getAllMeetingUsers(meetingId, (error, results) => {
        if(error) {
            return next(error);
        }
        return res.status(200).send({
            message: "Success",
            data: results
        });
    });
}

exports.deleteMeetingRooms = (req, res, next) => {
    const {hostName, listRoomSelected} = req.body;
    console.log('deleteMeetingRooms');

    meetingServices.deleteMeetingRooms(hostName, listRoomSelected, (error, result) => {
        if(error) {
            return next(error);
        }
        return res.status(200).send({
            message: "Success",
            data: result,
        });
    })
}