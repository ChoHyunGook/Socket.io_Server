const express = require('express')
const app = express();
const Members = require("../../service/Doorbell");


//--------------Group Home ( 화면 공통 )----------------//

//본인 계정정보 - 본인정보(개인) + 그룹 정보 조회 ( 마스터 + 그룹원 )
app.get('/info',(req,res)=>{
    Members().getInfo(req,res)
})


//--------------Group Home ( Master )----------------//

//그룹이름 변경 - 그룹자체의 group_name 업데이트 ( 마스터 )
app.patch('/group_name',(req,res)=>{
    Members().patchGroupName(req,res)
})
//그룹원 이름 변경 - 마스터가 사용할 그룹원의 별칭 지정 - user_name ( 마스터 )
app.patch('/unit/user_name',(req,res)=>{
    Members().patchUnitUserName(req,res)
})

//그룹 초기화 - unit 내의 본인 제외 배열을 돌며 device_info가 빈배열이 아니면 DynamoDB DEVICE_TABLE 순회하며 삭제 후 unit의 내부에서 본인(마스터) 유저키 제외한 값 삭제
app.delete('/reset',(req,res)=>{
    Members().deleteReset(req,res)
})

//그룹원 추방 - unit 삭제 및 "ACTIVE"상태일 경우 device_info가 빈배열이 아니면 배열을 돌며 device_id + 해당 그룹원 user_key로 DynamoDB DEVICE_TABLE 삭제
app.delete('/unit/remove',(req,res)=>{
    Members().deleteUnitRemove(req,res)
})


//--------------Group Home ( Unit )----------------//

//그룹이름 변경 - 그룹원이 본인이 속해있는 그룹의 별칭 지정 - alias_name ( 그룹원 )
app.patch('/unit/alias_name',(req,res)=>{
    Members().patchUnitAliasName(req,res)
})
//기기 이름 변경 - 그룹원이 권한을 받은 기기의 별칭 지정 - device_name ( 그룹원 )
app.patch('/unit/device_name',(req,res)=>{
    Members().patchUnitDeviceName(req,res)
})

//그룹탈퇴 - 본인이 그룹에서 본인 unit 객체 삭제, device_info가 빈배열이 아니면 본인 user_key+device_id 매칭하며 배열을 돌면서 DynamoDB DEVICE_TABLE 삭제
app.delete('/unit/leave',(req,res)=>{
    Members().deleteUnitLeave(req,res)
})


//--------------Invite Page ----------------//

//초대할 사람 찾기 - company + email을 body로 받아서 조회
app.post('/invite/find',(req,res)=>{
    Members().postInviteFind(req,res)
})

//기존 가입자 초대 이메일 전송 - 수락, 거부버튼 넣어서 수락 클릭시 get으로 api 쏴서 state, join_at 등 데이터 처리
app.post('/invite/send',(req,res)=>{
    Members().postInviteSend(req,res)
})

//기존 가입자 초대 이메일 수락버튼 - unit 데이터 업데이트
app.get('/invite/confirm',(req,res)=>{
    Members().getInviteConfirm(req,res)
})
//기존 가입자 초대 이메일 거부버튼 - unit 데이터 업데이트
app.get('/invite/reject',(req,res)=>{
    Members().getInviteReject(req,res)
})


//신규 가입자 초대 이메일 전송 - 그룹장 user_key + company + 초대 보낼 email => token 생성 후 회원가입 링크 이메일 전송
app.post('/invite/send/sign_up',(req,res)=>{
    Members().postInviteSendSignUp(req,res)
})

//초대링크 내 회원가입 html
app.get('/invite/sign_up/link',(req,res)=>{
    res.render('subSignUpForm', { token: req.query.token, company: req.query.company });
})

//신규 가입자 초대 이메일 회원가입 버튼 - 회원가입 ( 몽고디비, 다이나모 디비 signUp ) 및 맴버 업데이트 ( state, join_at 등 데이터 처리)
app.post('/invite/sign_up',(req,res)=>{
    Members().postInviteSignUp(req,res)
})



//--------------Device Permission Page ----------------//

//그룹원 기기 권한 덮어쓰기
app.patch('/device_permission',(req,res)=>{
    Members().patchDevicePermission(req,res)
})

//마스터 본인 디바이스 이름 변경
app.patch('/master/device_name',(req,res)=>{
    Members().patchMasterDeviceName(req,res)
})


//--------------Alarm Setting Page ----------------//

//알람 정보 조회 - 본인그룹 + 본인이 속해있는 그룹 => master => 본인 그룹 조회 후 unit 내 본인 device_info / 본인 유저키로 unit에 속해있는 데이터 전체 조회- 데이터 정제필요
app.get('/alarm/info',(req,res)=>{
    Members().getAlarmInfo(req,res)
})

//각 알림 설정 변경 - body의 master_user_key가 null 이면 본인그룹 내 본인 user_key기준 업데이트, 아닐시 master_user_key로 조회 후 unit 내 본인(그룹원)의 user_key 찾아서 업데이트
app.patch('/alarm/settings',(req,res)=>{
    Members().patchAlarmSettings(req,res)
})

//디바이스에서 lambda에 fcm요청 했을때 기기권한을 가지고 있는 그룹장 + 그룹원들의 알림세팅 정보
app.post('/check/settings',(req,res)=>{
    Members().getDeviceAlarmInfo(req,res)
})





module.exports = app