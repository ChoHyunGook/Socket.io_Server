

//초대 시 맴버 테이블 생성 - 부계약자들이 맴버 생성 못하게 = 개인 맴버 키는 있고 개인 유저키 조회 시 데이터가 없으면 부계약자
const Members = function (mongoose){
    const MembersSchema = new mongoose.Schema({
        user_key:{type:String, unique: true}, //마스터 유저키
        unit:[
            {
                user_key:String,
                token:String,
                state: {
                    type: String,
                    enum: [
                        'INVITED', //초대중
                        'PENDING_APPROVAL',//최종 승인 대기중
                        'APPROVED',// 최종 승인 완료
                        'APPROVED_REJECTED', // 마스터 거절
                        'REJECTED',// 거절됨 - 부계약자가 거절 시
                        'EXPIRED' // 토큰 만료됨 - 이메일 재전송
                    ],
                    default: 'INVITED'
                },
                join_at:{type:Date},
            }
        ],
        created_at:{type:Date}
    },{ versionKey : false })

    return mongoose.model('Members',MembersSchema)
}

module.exports = Members