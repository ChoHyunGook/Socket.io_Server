
//{ title: "protocol", message: "0xD5", ...원래 그대로 }
const fcm_alarm_settings = function (mongoose){
    const fcm_alarm_settings_schema = new mongoose.Schema({
        code:{ type:String, unique:true }, //프로토콜 값 (유니크)
        bypass:{ type:Boolean, required:true }, // 예외 여부
        title: {type:String, required:true},
        message: {type:String, required:true},
        created_at:{type:Date}, // 생성일자
        updated_at:{type:Date} // 업데이트 일자

    },{ versionKey : false })

    return mongoose.model('fcm_alarm_settings',fcm_alarm_settings_schema)
}

module.exports = fcm_alarm_settings