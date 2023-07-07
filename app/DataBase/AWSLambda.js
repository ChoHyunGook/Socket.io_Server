const AwsLogs = function (mongoose){
    const AwsLogsSchema = new mongoose.Schema({
        logs:{type:[String]},
        date:{type:String, trim:true},
        regDate:{type:Date,default:Date.now},
        createAt:{type:Date},
        expiredAt:{type:Date, expires:0 }
    },{ versionKey : false })
    return mongoose.model('AwsLog',AwsLogsSchema)
}

module.exports = AwsLogs