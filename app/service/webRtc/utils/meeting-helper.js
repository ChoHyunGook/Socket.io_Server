const meetingServices = require("../services/meeting.service");
const { meeting } = require("../models/meeting.model");
const {MeetingPayloadEnum} = require("./meeting-payload.enum");

async function joinMeeting(meetingId, socket, meetingServer, payload) {
    const {userId, name, selectedMeetingId} = payload.data;

    console.log('joinMeeting helper start' + selectedMeetingId);

    meetingServices.isMeetingPresent(selectedMeetingId, async (error, results) => {
        console.log('isMeetingPresent helper 2');
        if(error && !results) {
            console.log('isMeetingPresent meeting helper error!!');
            sendMessage(socket, {
                type: MeetingPayloadEnum.NOT_FOUND
            });
        }
        if(results) {
            addUser(socket, {meetingId, selectedMeetingId, userId, name}).then((result) => {
                console.log('isMeetingPresent meeting helper results addUser');

                if(result) {
                    console.log('isMeetingPresent meeting helper results result result');
                    sendMessage(socket, {
                        type: MeetingPayloadEnum.JOINED_MEETING, data: {
                            userId,
                            selectedMeetingId
                        }
                    });


                    //NOT // 멤버 화면에 추가
                    broadcastUsers(meetingId, socket, meetingServer, {
                        type: MeetingPayloadEnum.USER_JOINED,
                        data: {
                            userId,
                            name,
                            selectedMeetingId,
                            ...payload.data
                        }
                    });
                } else {
                    console.log('isMeetingPresent meeting helper results no null');
                }
            }, (error) => {
                console.log(error);
            });
        }
    });
}

function forwardConnectionRequest(meetingId, socket, meetingServer, payload) {
    const {userId, otherUserId, name, selectedMeetingId} = payload.data;
    console.log('forwardConnectionRequest meeting helper: ' + selectedMeetingId);
    var model = {
        meetingId: selectedMeetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            console.log('forwardConnectionRequest meeting helper: result ' + selectedMeetingId);
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.CONNECTION_REQUEST,
                data: {
                    userId,
                    name,
                    selectedMeetingId,
                    ...payload.data
                }
            });
            console.log('forwardConnectionRequest meeting helper: result socketId ' + result.socketId);
            console.log('forwardConnectionRequest meeting helper: result socketId ' + result.socketId);

            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);


        }
    })
}

function forwardIceCandidate(meetingId, socket, meetingServer, payload) {
    const {userId, selectedMeetingId, otherUserId, candidate} = payload.data;
    console.log('forwardIceCandidate meeting helper');
    var model = {
        meetingId: selectedMeetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.ICECANDIDATE,
                data: {
                    userId,
                    selectedMeetingId,
                    candidate
                }
            });

            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function forwardOfferSDP(meetingId, socket, meetingServer, payload) {
    const {userId, selectedMeetingId, otherUserId, sdp} = payload.data;
    console.log('forwardOfferSDP meeting helper');

    var model = {
        meetingId: selectedMeetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.OFFER_SDP,
                data: {
                    userId,
                    selectedMeetingId,
                    sdp
                }
            });

            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function forwardAnswerSDP(meetingId, socket, meetingServer, payload) {
    const {userId, selectedMeetingId, otherUserId, sdp} = payload.data;
    console.log('forwardAnswerSDP meeting helper');

    var model = {
        meetingId: selectedMeetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.ANSWER_SDP,
                data: {
                    userId,
                    selectedMeetingId,
                    sdp
                }
            });
            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function userLeft(meetingId, socket, meetingServer, payload) {
    const {userId, selectedMeetingId} = payload.data;
    console.log('userLeft meeting helper');

    var model = {
        meetingId: selectedMeetingId,
        userId: userId
    };

    console.log('forwardEvent meeting helper');

    broadcastUsers(selectedMeetingId, socket, meetingServer, {
        type: MeetingPayloadEnum.USER_LEFT,
        data: {
            userId: userId,
            selectedMeetingId,
            ...payload.data
        }
    });

    meetingServices.leftMeetingUser(model, (error, result) => {
        if(result) {
            // console.log("leftMeetingUser: " + result.data);
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.USER_LEFT,
                data: {
                    userId: userId,
                    selectedMeetingId,
                }
            });
            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })

}

function endMeeting(meetingId, socket, meetingServer, payload) {
    console.log('endMeeting');
    const {userId} = payload.data;
    // const {name} = payload.data;
    console.log('endMeeting meeting helper');

    broadcastUsers(meetingId, socket, meetingServer, {
        type: MeetingPayloadEnum.USER_LEFT,
        data: {
            userId: userId
            // name: name
        }
    });

    meetingServices.deleteMeetingUser(meetingId, userId, name, (error, results) => {
        if(results) {
            console.log("results :" + results);
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.USER_LEFT,
                data: {
                    userId: userId
                }
            });
            // meetingServer.broadcast.emit('message', sendPayload);
            meetingServer.emit('message', sendPayload);
            // meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    });
}

function forwardEvent(meetingId, socket, meetingServer, payload) {
    const {userId, selectedMeetingId} = payload.data;
    console.log('forwardEvent meeting helper');

    broadcastUsers(meetingId, socket, meetingServer, {
        type: payload.type,
        data: {
            userId: userId,
            selectedMeetingId: selectedMeetingId,
            ...payload.data
        }
    });

}

function addUser(socket, {meetingId, selectedMeetingId, userId, name}) {

    let promise = new Promise(function (resolve, reject) {
        meetingServices.getMeetingUser({selectedMeetingId, userId}, (error, result) => {
            if(!result) {
                console.log("addUser meeting-helper !result");
                var model = {
                    socketId: socket.id,
                    meetingId: selectedMeetingId,
                    userId: userId,
                    joined: true,
                    name: name,
                    isAlive: true
                };
                meetingServices.joinMeeting(model, (error, results) => {
                    if(results) {
                        resolve(true);
                    }
                    if(error) {
                        reject(error);
                    }
                });
            }
            else {
                console.log("addUser meeting-helper result ok ok");
                meetingServices.updateMeetingUser({
                    userId: userId,
                    socketId: socket.id,
                }, (error, results) => {
                    if(results) {
                        resolve(true);
                    }
                    if(error) {
                        reject(error);
                    }
                });
            }
        });
    });

    console.log("addUser meeting-helper promise" + promise);

    return promise;
}

function sendMessage(socket, payload) {
    socket.send(JSON.stringify(payload));
}

function broadcastUsers(meetingId, socket, meetingServer, payload) {
    socket.broadcast.emit("message", JSON.stringify(payload));
}

module.exports = {
    joinMeeting,
    forwardConnectionRequest,
    forwardIceCandidate,
    forwardOfferSDP,
    forwardAnswerSDP,
    userLeft,
    endMeeting,
    forwardEvent
}