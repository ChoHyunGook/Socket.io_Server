

const AWSLogin = function (mongoose){
    const errorSchema = new mongoose.Schema({
        id:{type:String},
        fcm_token:{type:String},
        up_key:{type:String},
        createdAt: {
            type: Date,
            default: Date.now,
            expires: '7d' // 문서가 생성된 후 7일 후에 삭제됨
        }
    },{ versionKey : false })
    return mongoose.model('AWSLogin',errorSchema)
}
module.exports = AWSLogin