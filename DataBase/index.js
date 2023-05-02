const dotenv = require('dotenv')
const mongoose = require("mongoose");
const logs = require("./Logs");
const InfoData = require('./Info')
const RtcPort = require('./RtcPort')



const db = {}
db.mongoose = mongoose
db.url = dotenv.MONGO_URI
db.logs=new logs(mongoose)
db.Info =new InfoData(mongoose)
db.Rtc = new RtcPort(mongoose)


module.exports = db