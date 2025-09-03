


const AppVersion = function (mongoose){
    const AppVersionSchema = new mongoose.Schema({
        app_id:{type:Number, unique: true, required: true},
        name:{type:String, comment:"앱 이름"},
        platform: {
            type: String,
            enum: ["ios", "android"],
            required: true,
            comment: "플랫폼 (ios | android)"
        },
        version:{type:String, comment:"버전"},
        createAt:{type:Date, default:Date.now},
    },{ versionKey : false })

    return mongoose.model('AppVersion',AppVersionSchema)
}

module.exports = AppVersion