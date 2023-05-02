const meetingServices = require("../services/meeting.service");
const { meeting } = require("../models/meeting.model");
const {MeetingPayloadEnum} = require("../utils/meeting-payload.enum");

async function joinMeeting(meetingId, socket, meetingServer, payload) {
    const {userId, name} = payload.data;

    meetingServices.isMeetingPresent(meetingId, async (error, results) => {
        console.log('isMeetingPresent meeting helper');
        if(error && !results) {
            console.log('isMeetingPresent meeting helper error !redults');
            sendMessage(socket, {
                type: MeetingPayloadEnum.NOT_FOUND
            });
        }
        if(results) {
            console.log('isMeetingPresent meeting helper results');

            addUser(socket, {meetingId, userId, name}).then((result) => {
                console.log('isMeetingPresent meeting helper results addUser');

                if(result) {
                    console.log('isMeetingPresent meeting helper results result result');
                    sendMessage(socket, {
                        type: MeetingPayloadEnum.JOINED_MEETING, data: {
                            userId
                        }
                    });

                    //NOT
                    broadcastUsers(meetingId, socket, meetingServer, {
                        type: MeetingPayloadEnum.USER_JOINED,
                        data: {
                            userId,
                            name,
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
    const {userId, otherUserId, name} = payload.data;
    console.log('forwardConnectionRequest meeting helper');
    var model = {
        meetingId: meetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.CONNECTION_REQUEST,
                data: {
                    userId,
                    name,
                    ...payload.data
                }
            });

            meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function forwardIceCandidate(meetingId, socket, meetingServer, payload) {
    const {userId, otherUserId, candidate} = payload.data;
    console.log('forwardIceCandidate meeting helper');
    var model = {
        meetingId: meetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.ICECANDIDATE,
                data: {
                    userId,
                    candidate
                }
            });

            meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function forwardOfferSDP(meetingId, socket, meetingServer, payload) {
    const {userId, otherUserId, sdp} = payload.data;
    console.log('forwardOfferSDP meeting helper');

    var model = {
        meetingId: meetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.OFFER_SDP,
                data: {
                    userId,
                    sdp
                }
            });

            meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function forwardAnswerSDP(meetingId, socket, meetingServer, payload) {
    const {userId, otherUserId, sdp} = payload.data;
    console.log('forwardAnswerSDP meeting helper');

    var model = {
        meetingId: meetingId,
        userId: otherUserId
    };

    meetingServices.getMeetingUser(model, (error, result) => {
        if(result) {
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.ANSWER_SDP,
                data: {
                    userId,
                    sdp
                }
            });

            meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    })
}

function userLeft(meetingId, socket, meetingServer, payload) {
    const {userId} = payload.data;
    console.log('userLeft meeting helper');

    var model = {
        meetingId: meetingId,
        userId: userId
    };

    console.log('forwardEvent meeting helper');

    broadcastUsers(meetingId, socket, meetingServer, {
        type: MeetingPayloadEnum.USER_LEFT,
        data: {
            userId: userId,
            ...payload.data
        }
    });

    meetingServices.leftMeetingUser(model, (error, result) => {
        if(result) {
            console.log("leftMeetingUser: " + result.data);
            var sendPayload = JSON.stringify({
                type: MeetingPayloadEnum.USER_LEFT,
                data: {
                    userId: userId
                }
            });

            meetingServer.to(result.socketId).emit('message', sendPayload);
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

            meetingServer.to(result.socketId).emit('message', sendPayload);
        }
    });
}

function forwardEvent(meetingId, socket, meetingServer, payload) {
    const {userId} = payload.data;
    console.log('forwardEvent meeting helper');

    broadcastUsers(meetingId, socket, meetingServer, {
        type: payload.type,
        data: {
            userId: userId,
            ...payload.data
        }
    });

}

function addUser(socket, {meetingId, userId, name}) {
    console.log("addUser meeting-helper");
    let promise = new Promise(function (resolve, reject) {
        meetingServices.getMeetingUser({meetingId, userId}, (error, result) => {
            if(!result) {
                console.log("addUser meeting-helper !result");
                var model = {
                    socketId: socket.id,
                    meetingId: meetingId,
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
                console.log("addUser meeting-helper result okok");
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