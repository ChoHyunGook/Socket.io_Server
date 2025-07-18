const dotenv = require('dotenv')
const mongoose = require("mongoose");
const Groups = require("./Groups.js")
const db = {}
db.mongoose = mongoose
db.url = dotenv.MONGO_URI
db.Groups=new Groups(mongoose)

module.exports = db



