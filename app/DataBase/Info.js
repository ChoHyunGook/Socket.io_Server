const Info = function (mongoose){
    const InfoSchema = new mongoose.Schema({
        company:{type:String, trim:true, required:true},
        contract_num:{type:String, trim:true, required:true},
        ip:{type:String, trim:true, required:true},
        id:{type:String, trim:true, required:true},
        name:{type:String, trim:true, required:true},
        MAC:{type:String, trim:true, required:true},
        VOICE_PORT: {type:Number, trim:true, unique:1, required:true},
        VIDEO_PORT: {type:Number, trim:true, unique:1, required:true},
        Voice_WSAddr: {type:String, trim:true, unique:1, required:true},
        Video_WSAddr:{type:String, trim:true, unique:1, required:true},
        connectDate:{type:String, trim:true, required:true}
    },{ versionKey : false })
    return mongoose.model('infos',InfoSchema)
}

module.exports = Info