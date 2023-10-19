const dotenv = require('dotenv')
const mongoose = require("mongoose");
const logs = require("./Logs");
const InfoData = require('./Info')
const history = require('./history')
const version = require('./Version')
const FaceRegister = require('./FaceRegister')

const db = {}
db.mongoose = mongoose
db.url = dotenv.MONGO_URI
db.logs=new logs(mongoose)
db.Info =new InfoData(mongoose)
db.history = new history(mongoose)
db.version = new version(mongoose)
db.face = new FaceRegister(mongoose)


module.exports = db



