const mongoose =require('mongoose')

const db = {}
db.mongoose = mongoose
db.url = process.env.MONGO_URI

export default db