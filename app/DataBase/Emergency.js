
const Emergency = function (mongoose){
    const EmergencySchema = new mongoose.Schema({
        user_key: {type:String, unique:true},//유저키
        tels: [
            {
                number: String,//전화번호
                createdAt: Date//생성일자
            }
        ],
    },{ versionKey : false })

    return mongoose.model('Emergency',EmergencySchema)
}

module.exports = Emergency