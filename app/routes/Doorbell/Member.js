const express = require('express')
const app = express();
const Members = require("../../service/Doorbell");

//본인 계정정보
app.get('/get/userInfo',(req,res)=>{
    Members.getUserInfo(req,res)
})
//맴버 (그룹) 조회
app.get('/get/groupInfo',(req,res)=>{
    Members.getMemberInfo(req,res)
})
//맴버 (그룹) 생성
app.post('/create',(req,res)=>{
    Members().createMembers(req,res)
})
//초대할 사람 검색
app.get('/find/invite/user',(req,res)=>{
    Members().findUsers(req,res)
})
//초대 email 보내기
app.post('/send/invite',(req,res)=>{
    Members().sendInvitation(req,res)
})
//email 수락버튼
app.get('/invite/confirm',(req,res)=>{
    Members().inviteConfirm(req,res)
})
//email 거부버튼
app.get('/invite/reject',(req,res)=>{
    Members().inviteReject(req,res)
})
//그룹장(마스터) 최종승인
app.post('/invite/approve',(req,res)=>{
    Members().memberApprove(req,res)
})
//마스터 - 맴버(그룹)원 삭제
app.delete('/remove/unit',(req,res)=>{
    Members().removeMemberFromUnit(req,res)
})
//마스터 - 그룹 전체 삭제
app.delete('/remove/group',(req,res)=>{
    Members().removeGroup(req,res)
})
//맴버(그룹)원 - 그룹탈퇴
app.delete('/leave/unit',(req,res)=>{
    Members().leaveGroup(req,res)
})
//마스터 - 디바이스 권한 관리 (덮어쓰기 개념)
app.patch('/update/device',(req,res)=>{
    Members().assignDevicePermission(req,res)
})

module.exports = app