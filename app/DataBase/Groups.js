
const Groups = function (mongoose){
    const GroupsSchema = new mongoose.Schema({
        group_name:{type:String}, // 그룹 이름 (별명) - 기본 "(유저이름)의 그룹"
        user_key: {type:String, unique:true},//마스터 유저키 ( 유니크 값으로 그룹 검색하기 쉽도록 )
        unit:[ // 그룹 구성 ( 마스터 포함 최대 6명 마스터 + 그룹원(5명) )
            {
                user_key:String, // 각자 유저키
                user_name:String, // 기본 - tables의 이름 / 변경 후 - 별명 (마스터 전용)
                alias_name:String, // 해당 그룹 별명 (그룹원 전용)
                email:String, // 각자 이메일 정보 ( 그룹원 초대 시 회원가입 필요한사람은 email로 구분 )
                latest_device_id:String,//마지막 사용 디바이스아이디
                device_info:[ // 각 그룹원 디바이스 정보 => 각 디바이스 마다 fcm 전송 여부 확인 후 fcm 보내는 요청하면됨.
                    {
                        device_id: String,//디바이스 아이디
                        device_name: String, //디바이스 이름 ( 별명 )
                        privacy:{ type: Boolean, default: false } // fcm 받을지 말지 여부
                    }
                ],
                token:String, // 초대 토큰 인증용 ( 마스터는 null )
                auth:Boolean, // 마스터 체크 용
                state: { // 마스터는 바로 'ACTIVE'
                    type: String,
                    enum: [
                        'INVITED', // 기존 유저 초대중
                        'REJECT',// 기존 가입자 거절
                        'ACTIVE',// 등록 완료
                        'EXPIRED' // 토큰 만료됨 - 이메일 재전송
                    ],
                    default: 'INVITED'
                },
                join_at:{type:Date},//그룹 참가 날짜
            }
        ],
        created_at:{type:Date} // 그룹 생성 일자 ( 마스터 신규가입 날짜 )
    },{ versionKey : false })

    return mongoose.model('Groups',GroupsSchema)
}

module.exports = Groups