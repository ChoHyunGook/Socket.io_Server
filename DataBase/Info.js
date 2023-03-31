const Info = function (mongoose){
    const InfoSchema = new mongoose.Schema({
        ip:{type:String, trim:true, required:true},
        MAC:{type:String, trim:true, required:true},
        IP:{type:String, trim:true, required:true},
        PORT:{type:String, trim:true, required:true},
        APP_PORT: {type:Number, trim:true, unique:1, required:true},
        DEVICE_PORT:{type:Number, trim:true, unique:1, required:true},
        connectDate:{type:String, trim:true, required:true}
    },{ versionKey : false })
    return mongoose.model('infos',InfoSchema)
}

module.exports = Info