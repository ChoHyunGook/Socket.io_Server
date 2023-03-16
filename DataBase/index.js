const dotenv = require('dotenv')
const dataBase = require("./db");
const mongoose = require("mongoose");

const db = {}
db.mongoose = mongoose
db.url = dotenv.MONGO_URI
db.Logs=new dataBase(mongoose)


module.exports = db