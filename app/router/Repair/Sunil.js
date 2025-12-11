const express =require('express')
const app = express();
const ASService = require('../../service/ASService/SunilService')
const multer = require('multer');


const service = ASService();

/* ====== multer 설정 (수리내역 첨부용) ====== */
// S3에 바로 올릴 거라서 메모리 스토리지 사용
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        // 파일 1개당 최대 300MB (필요하면 값 조정)
        fileSize: 300 * 1024 * 1024,
    },
});

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


//첨부파일 조회
app.get('/attached',(req,res)=>{
    service.getAttached(req,res);
})
//수리기사 수리내역 저장
app.post(
    '/repair/info',
    upload.array('files', 20),   // 최대 20개까지 업로드 허용 (원하시면 숫자 조정)
    (req, res) => {
        service.repairInfo(req, res);
    }
);

//수리기사 수리내역 삭제
app.delete('/repair/info',(req,res)=>{
    service.deleteRepairInfo(req,res);
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