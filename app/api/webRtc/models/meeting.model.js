const mongoose = require("mongoose");
const { Schema } = mongoose;

const meeting = mongoose.model(
    "Meeting",
    mongoose.Schema({
        hostId : {
            type: String,
            required: true,
            unique: true
        },
        userRoomPassword : {
            type: String,
            required: true,
        },
        hostName : {
            type: String,
            required: true
        },
        roomName : {
            type: String,
            required: true
        },
        startTime: {
            type: Date,
            required: true
        },
        meetingUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "MeetingUser"
            }
        ]
    }, {
        toJSON: {
            transform: function (doc, ret) {
                ret.id = ret._id.toString(),
                delete ret._id;
                delete ret.__v;
            }
        }
    }, 
    {timestamps: true})
);

module.exports = {
    meeting
}