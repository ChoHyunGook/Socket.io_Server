//K0xAL-GMP => 기기권한변경
//K0xAL-GMR => 그룹초기화
//K0xAL-GMD => 그룹연결해제(추방)
//K0xAL-GUL => 그룹 탈퇴(그룹원)


const FcmProtocols = function (mongoose){
    const newSchema = new mongoose.Schema({
        pt_id:{type:Number, unique:true, require:true},
        protocol:{type:String, unique:true, require:true},
        title:{type:String},
        message:{type:String},
        bypass:{type:Boolean},// true면 privacy가 true라도 send
        created_at:{type:Date}, // 그룹 생성 일자 ( 마스터 신규가입 날짜 )
        updated_at:{type:Date} // 업데이트 일자
    },{ versionKey : false })

    return mongoose.model('FcmProtocols',newSchema)
}


module.exports = FcmProtocols