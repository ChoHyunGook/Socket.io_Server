const meetingHelper = require("./utils/meeting-helper");
const {MeetingPayloadEnum} = require("./utils/meeting-payload.enum");

function parseMessage(message) {
    try {
        const payload = JSON.parse(message);
        return payload;
    } catch (error) {
        return { type: MeetingPayloadEnum.UNKNOWN };
    }
}

function listenMessage(meetingId, socket, meetingServer) {
    socket.on('message', (message) => handleMessage(meetingId, socket, message, meetingServer));
}

function handleMessage(meetingId, socket, message, meetingServer) {
    var payload = "";
    if(typeof message === 'string') {
        payload = parseMessage(message);
    }
    else {
        payload = message;
    }

    console.log('handleMessage: ');
    switch(payload.type) {
        case MeetingPayloadEnum.JOIN_MEETING:
            console.log('handleMessage: JOIN_MEETING');
            console.log('handleMessage: JOIN_MEETING');
            meetingHelper.joinMeeting(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.CONNECTION_REQUEST:
            console.log('handleMessage: CONNECTION_REQUEST');
            meetingHelper.forwardConnectionRequest(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.OFFER_SDP:
            console.log('handleMessage: OFFER_SDP');
            meetingHelper.forwardOfferSDP(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.ICECANDIDATE:
            console.log('handleMessage: ICECANDIDATE');
            meetingHelper.forwardIceCandidate(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.ANSWER_SDP:
            console.log('handleMessage: ANSWER_SDP');
            meetingHelper.forwardAnswerSDP(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.LEAVE_MEETING:
            console.log('handleMessage: LEAVE_MEETING');
            meetingHelper.userLeft(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.END_MEETING:
            console.log('handleMessage: END_MEETING');
            meetingHelper.endMeeting(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.VIDEO_TOGGLE:
        case MeetingPayloadEnum.AUDIO_TOGGLE:
            console.log('handleMessage: AUDIO_TOGGLE');
            meetingHelper.forwardEvent(meetingId, socket, meetingServer, payload)
            break;
        case MeetingPayloadEnum.UNKNOWN:
            console.log('handleMessage: UNKNOWN');
            break;
        default:
            break;
    }
}

function initMeetingServer(server) {
    const {Server} = require('socket.io');
    const meetingServer = new Server(server, {transports: ['websocket']});
    console.log('! ! initMeetingServer');
    meetingServer.on('connection', socket => {
        const meetingId = socket.handshake.query.id;
        console.log("meetingServer" + meetingId);
        listenMessage(meetingId, socket, meetingServer);
    });

}

module.exports = {
    initMeetingServer
}