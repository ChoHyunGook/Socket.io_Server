const express =require('express')
const app = express();
const ASService = require('../../service/ASService/SunilService')


const service = ASService();
//드라이버 로그인
app.post('/login/driver',(req,res)=>{
    service.driverLogin(req,res);
})
//드라이버 아이디 찾기
app.post('/find/driver',(req,res)=>{
    service.findDriver(req,res);
})
//드라이버 비밀번호 변경
app.post('/driver/change-password',(req,res)=>{
    service.changePassword(req,res);
})

//드라이버 아이디 기준 조회
app.get('/find/driverById',(req,res)=>{
    service.findDriverById(req,res)
})

//as조회
app.get('/list',(req,res)=>{
    service.list(req,res)
})

//as신청
app.post('/subscribe',(req,res)=>{
    service.create(req,res)
})
//방문요청 일자 변경
app.patch('/patch/date',(req,res)=>{
    service.updateDate(req,res)
})
//as수정
app.patch('/patch',(req,res)=>{
    service.update(req,res)
})
//as삭제
app.delete('/remove',(req,res)=>{
    service.remove(req,res)
})



module.exports = app;