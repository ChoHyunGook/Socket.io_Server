const express = require('express')
const app = express();
const Doorbell = require('../../service/Doorbell')
const Members = require("../../service/Doorbell/Member");


app.post('/signUp',(req,res)=>{
    Doorbell().signUp(req,res)
})

app.post('/send/signUp/email',(req,res)=>{
    Doorbell().signUpEmail(req,res)
})

app.post('/send/find/email',(req,res)=>{
    Doorbell().findEmail(req,res)
})

app.patch('/patch/user',(req,res)=>{
    Doorbell().updateUser(req,res);
})

app.post('/auto/signIn',(req,res)=>{
    Doorbell().autoSignIn(req,res)
})


//본인 계정정보
app.get('/member/get/userInfo',(req,res)=>{
    Members.getUserInfo(req,res)
})
//맴버 (그룹) 조회
app.get('/member/get/memberInfo',(req,res)=>{
    Members.getMemberInfo(req,res)
})
//맴버 (그룹) 생성
app.post('/member/create',(req,res)=>{
    Members().createMembers(req,res)
})
//초대할 사람 검색
app.get('/member/find/invite/user',(req,res)=>{
    Members().findUsers(req,res)
})
//초대 email 보내기
app.post('/member/send/invite',(req,res)=>{
    Members().sendInvitation(req,res)
})
//email 수락버튼
app.get('/member/invite/confirm',(req,res)=>{
    Members().inviteConfirm(req,res)
})
//email 거부버튼
app.get('/member/invite/reject',(req,res)=>{
    Members().inviteReject(req,res)
})
//그룹장(마스터) 최종승인
app.post('/member/invite/approve',(req,res)=>{
    Members().memberApprove(req,res)
})
//마스터 - 맴버(그룹)원 삭제
app.delete('/member/remove/unit',(req,res)=>{
    Members().removeMemberFromUnit(req,res)
})
//맴버(그룹)원 - 그룹탈퇴
app.delete('/member/leave/unit',(req,res)=>{
    Members().leaveGroup(req,res)
})
//마스터 - 디바이스 권한 관리 (덮어쓰기 개념)
app.patch('/member/update/device',(req,res)=>{
    Members().assignDevicePermission(req,res)
})

module.exports = app