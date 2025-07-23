const history = function (mongoose){
    const historySchema = new mongoose.Schema({
        user_key:{type:String,required: true},
        title:{type:String, trim:true},
        body:{type:String, trim:true},
        upKey:{type:String, trim:true},
        device_id:{type:String, trim:true},
        fileName:{type:String, trim:true},
        date:{type:String, trim:true},
        regDate:{type:Date,default:Date.now},
        createAt:{type:Date},
        expiredAt:{type:Date, expires:0 }
    },{ versionKey : false })
    return mongoose.model('history',historySchema)
}

module.exports = history