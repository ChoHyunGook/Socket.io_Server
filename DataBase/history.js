const history = function (mongoose){
    const historySchema = new mongoose.Schema({
        title:{type:String, trim:true},
        body:{type:String, trim:true},
        upKey:{type:String, trim:true},
        device_id:{type:String, trim:true},
        fileName:{type:String, trim:true},
        date:{type:String, trim:true},
        createAt:{type:Date, expires:30, default:Date.now}
    },{ versionKey : false })
    return mongoose.model('history',historySchema)
}

module.exports = history