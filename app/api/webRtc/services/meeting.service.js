const {meeting} = require("../models/meeting.model");
const {meetingUser} = require("../models/meeting-user.model");

async function getAllMeetingUsers(meetId, callback) {
    meetingUser.find({meetingId: meetId})
        .then((response) => {
            return callback(null, response);
        })
        .catch((error) => {
            return callback(error);
        });
}
async function deleteMeetingUser(meetId, userId,  callback) {

    meetingUser.deleteMany({meetingId: meetId, userId: userId})
        .then((response) => {
            return callback(null, response)
        })
        .catch((error) => {
            return callback(error);
        });
}

// 미팅시작
async function startMeeting(params, callback) {
    const meetingSchema = new meeting(params);
    console.log('startMeeting meeting service');
    meetingSchema
        .save()
        .then((response) => {
            return callback(null, response)
        })
        .catch((error) => {
            return callback(error);
        });
}

// 미팅 참여
async function joinMeeting(params, callback) {
    console.log('joinMeeting meeting service start');
    const meetingUserModel = new meetingUser(params);
    console.log('joinMeeting meeting service ' + meetingUserModel);
    meetingUserModel
        .save()
        .then(async (response) => {
            console.log('joinMeeting meeting service then');
            await meeting.findOneAndUpdate({id: params.meetingId}, { $addToSet: { "meetingUsers": meetingUserModel}});
            console.log('joinMeeting meeting service then update done');
            return callback(null, response);
        })
        .catch((error) => {
            return callback(error);
        });
}

async function isMeetingPresent(meetingId, callback) {
    console.log('isMeetingPresent meeting service try');
    console.log('isMeetingPresent meeting service try ' + meetingId);

    meeting.findById(meetingId)
        .populate("meetingUsers", "MeetingUser")
        .then((response) => {
            console.log('isMeetingPresent meeting service ' + response);
            console.log('isMeetingPresent meeting service ' + response);
            if(!response) callback("Invalid Meeting Id");
            else callback(null, true);
        })
        .catch((error) => {
            return callback(error, false);
        });
}

async function findMeetingRooms(hostName, callback) {
    console.log('checkMeetingExists meeting service ');

    meeting.find({hostName: hostName})
        .then((response) => {
            if(!response) callback("Invalid Meeting Id");
            else callback(null, response);
        })
        .catch((error) => {
            return callback(error, false);
        });
}

async function deleteMeetingRooms(hostName, listRoomSelected, callback) {
    console.log('checkMeetingExists meeting service ');

    if(listRoomSelected != null && listRoomSelected.length > 0) {
        listRoomSelected.forEach(element => {
            console.log("element element: " + element);

            meeting.deleteOne({hostName: hostName, _id: element})
                .then((response) => {
                    return callback(null, response)
                })
                .catch((error) => {
                    return callback(error);
                });
        });
    }


    // meeting.find({hostName: hostName})
    // .then((response) => {
    //     if(!response) callback("Invalid Meeting Id");
    //     else callback(null, response);
    // })
    // .catch((error) => {
    //     return callback(error, false);
    // });
}


async function checkMeetingExists(meetingId, callback) {
    console.log('checkMeetingExists meeting service ');

    meeting.findById(meetingId, "hostId, hostName, startTime")
        .populate("meetingUsers", "MeetingUser")
        .then((response) => {
            if(!response) callback("Invalid Meeting Id");
            else callback(null, response);
        })
        .catch((error) => {
            return callback(error, false);
        });
}

async function leftMeetingUser(params, callback) {
    const {meetingId, userId} = params;
    console.log('leftMeetingUser meeting service ');

    meetingUser.deleteOne({meetingId: meetingId, userId: userId})
        .then((response) => {
            console.log('leftMeetingUser meeting service ok ok');
            return callback(null, response)
        })
        .catch((error) => {
            return callback(error);
        });
}

async function getMeetingUser(params, callback) {
    const {meetingId, userId} = params;
    console.log('getMeetingUser meeting service ');


    meetingUser.find({meetingId, userId})
        .then((response) => {
            console.log('meetingUser.find ' + response[0]);
            return callback(null, response[0])
        })
        .catch((error) => {
            return callback(error);
        });
}

async function findMeetingUsers(params, callback) {
    const {meetingId} = params;
    console.log('getMeetingUser meeting service ');


    meetingUser.find({meetingId})
        .then((response) => {
            return callback(null, response[0])
        })
        .catch((error) => {
            return callback(error);
        });
}

async function updateMeetingUser(params, callback) {
    console.log('updateMeetingUser meeting service ');
    meetingUser.updateOne({userId: params.userId}, {$set: params}, {new: true})
        .then((response) => {
            return callback(null, response);
        })
        .catch((error) => {
            return callback(error);
        });
}

async function getUserBySocketId(params, callback) {
    const {meetingId, socketId} = params;
    console.log('getUserBySocketId meeting service ');

    meetingUser
        .find({meetingId, socketId})
        .limit(1)
        .then((response) => {
            return callback(null, response);
        })
        .catch((error) => {
            return callback(error);
        });
}

module.exports = {
    startMeeting,
    joinMeeting,
    getAllMeetingUsers,
    deleteMeetingUser,
    isMeetingPresent,
    findMeetingRooms,
    deleteMeetingRooms,
    checkMeetingExists,
    leftMeetingUser,
    getUserBySocketId,
    updateMeetingUser,
    getMeetingUser,
    findMeetingUsers
}