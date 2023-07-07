const AwsLogs = function (mongoose){
    const AwsLogsSchema = new mongoose.Schema({
        user_key:{type:String, trim:true},
        title:{type:String, trim:true},
        message:{type:String, trim:true},
        fileName:{type:String, trim:true},
        MacAddr:{type:String, trim:true},
        upKey:{type:String, trim:true},
        regDate:{type:Date,default:Date.now},
        createAt:{type:Date},
        expiredAt:{type:Date, expires:0 }
    },{ versionKey : false })
    return mongoose.model('AwsLog',AwsLogsSchema)
}

module.exports = AwsLogs