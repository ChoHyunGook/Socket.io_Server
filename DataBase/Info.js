const Info = function (mongoose){
    const InfoSchema = new mongoose.Schema({
        SERVERNAME: {type:String, trim:true, unique:1, required:true},
        MAC:{type:String, trim:true, required:true},
        IP:{type:String, trim:true, required:true},
        PORT:{type:String, trim:true, required:true},
        MACPORT: {type:String, trim:true, unique:1, required:true},

    },{ versionKey : false })
    return mongoose.model('infos',InfoSchema)
}

module.exports = Info