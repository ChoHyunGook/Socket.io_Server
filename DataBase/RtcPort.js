const RtcPort = function (mongoose){
    const RtcPortSchema = new mongoose.Schema({
        ip:{type:String, trim:true, required:true},
        RTC_PORT: {type:Number, trim:true, unique:1, required:true}
    },{ versionKey : false })
    return mongoose.model('RtcPort',RtcPortSchema)
}

module.exports = RtcPort