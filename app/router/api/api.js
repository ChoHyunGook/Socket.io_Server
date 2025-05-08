const express = require('express')
const app = express();
const Api = require('../../service/api/api')
const Management = require('../../service/api/management')
const multer = require('multer');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
var storage = multer.memoryStorage()
var upload = multer({storage: storage});
const moment = require("moment-timezone");
const db = require("../../DataBase")
const semiDate = require("../../service/Data/date")
const EagleSafesInquiries = require("../../service/myrucell");
const fs = require('fs');
const path = require('path');
const RTFParser = require('rtf-parser');


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION,AWS_DOORBELL_NAME
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS
const Bucket_name = AWS_DOORBELL_NAME

const s3 = new AWS.S3({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const Log = db.logs


setInterval(()=>{
    s3.listObjects({Bucket:Bucket_name}).promise().then((list)=>{
        const listData = list.Contents
        const filterTime = moment().tz('Asia/Seoul')
        let beforeTime = filterTime.subtract(3,'d').format('YYYY-MM-DD kk:mm:ss')
        //let testTime = filterTime.subtract(1,'minutes').format('YYYY-MM-DD kk:mm:ss')
        listData.map(e=>{
            if(e.Key.split('/')[2] !== undefined){
                const splitData = new Date(e.LastModified)
                const year = splitData.getFullYear()
                let month = ('0' + (splitData.getMonth() +  1 )).slice(-2);
                let date = ('0' + splitData.getDate()).slice(-2);
                let hour = ('0' + splitData.getHours()).slice(-2);
                let minutes = ('0' + splitData.getMinutes()).slice(-2);
                let seconds = ('0' + splitData.getSeconds()).slice(-2);
                let checkTime = `${year}-${month}-${date} ${hour}:${minutes}:${seconds}`
                //console.log(moment(checkTime).isBefore(testTime))
                if(moment(checkTime).isBefore(beforeTime) === true){
                    const params = {
                        Bucket:Bucket_name,
                        Key:e.Key
                    }
                    s3.deleteObject(params,function (err,delPoint){
                        if(err){
                            console.log(err)
                        }else{
                            let saveData = {
                                log:`Automatically delete video files 3 days ago:${Bucket_name}:${e.Key}:VideoSaveTime_${checkTime}:StandardTime_${beforeTime}`,
                                date:semiDate.logDate()
                            }
                            new Log(saveData).save()
                                .then(r=>console.log(saveData.log))
                                .catch(err=>console.log(err))
                        }
                    })
                }
            }
        })
    })
},1000*60*60*24)



app.get('/get/personal/policy',async (req, res) => {
    const filePath = path.join(__dirname, '../../../views', 'personalPolicy.rtf');

    res.setHeader('Content-Type', 'application/rtf');
    res.setHeader('Content-Disposition', 'inline; filename="personalPolicy.rtf"');

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('파일 전송 중 에러 발생:', err);
            res.status(500).send('파일을 전송할 수 없습니다.');
        }
    });
})


app.post('/get/aws/table',(req,res)=>{
    Api().awsFindData(req,res)
})

app.get('/update/admin',(req,res)=>{
    Api().readDoorbell(req,res)
})


app.get('/findLog',(req,res)=>{
    Api().findLog(req,res)
})
app.post('/b2c/service',(req,res)=>{
    Api().b2cService(req,res)
})

app.post('/faceRegister',(req,res)=>{
    Api().face_register(req,res)
})

app.post('/sendSms',(req,res)=>{
    Api().sendSms(req,res)
})

app.get('/awslog',(req,res)=>{
    Api().getAwsLogHistory(req,res)
})
app.post('/AWSlogs',(req,res)=>{
    Api().getAWSLogs(req,res)
})
app.post('/getHistory',(req,res)=>{
    Api().getHistory(req,res)
})

app.post('/startUpInfo',(req,res)=>{
    Api().start_up(req,res)
})

app.post('/niceApi',(req,res)=>{
    Api().niceApi(req,res)
})

app.post('/send/email',(req,res)=>{
    Api().sendEmail(req,res)
})

app.post('/check/auth',(req,res)=>{
    Api().checkAuthNum(req,res)
})

app.get('/find/deviceInfo',(req,res)=>{
    Api().findDeviceInfo(req,res)
})

// app.post('/saveHistory',(req,res)=>{
//     Api().saveHistory(req,res)
// })

app.get('/', (req,res)=>{
    Api().getService(req,res)
})

app.get('/date',(req,res)=>{
    Api().userKeyTest(req,res)
})

app.post('/find/user',(req,res)=>{
    Api().findOverseasUser(req,res)
})
app.post('/update/pw',(req,res)=>{
    Api().updateOverseasUser(req,res)
})
app.get('/testInquiries',(req,res)=>{
    Api().inquTest(req,res)
})
app.post('/api/test',(req,res)=>{
    Api().testAPI(req,res)
})
// app.get('/get/inquiries',(req,res)=>{
//     Api().getInquiries(req,res)
// })
// app.post('/update/inquiries',(req,res)=>{
//     Api().eaglesSafesInquiries(req,res)
// })
app.post('/delete/history',(req,res)=>{
    Api().deleteHistory(req,res)
})
// app.post('/dynamoUserKey',(req,res)=>{
//     Api().dynamoUserKey(req,res)
// })
// app.get('/connect/doorbell',(req,res)=>{
//     Api().saveUsersKey(req,res)
// })
app.get('/check/pairing',(req,res)=>{
    Api().checkPairing(req,res)
})
app.get('/cut',(req, res) => {
    Api().cutToken(req,res)
})
app.get('/checkDevice',(req,res)=>{
    Api().findDeviceId(req,res)
})
app.post('/add/deviceId',(req,res)=>{
    Api().addDeviceId(req,res)
})
app.post('/signOut',(req,res)=>{
    Api().signOut(req,res)
})
app.post('/record',(req,res)=>{
    Api().record(req,res)
})
app.post('/force/del/deviceId',(req,res)=>{
    Api().allDeleteDevices(req,res)
})
app.get('/del/all/record',(req,res)=>{
    Api().allDeleteRecord(req,res)
})
app.post('/delete/deviceId',(req,res)=>{
    Api().renewalDeleteDeviceId(req,res)
})
app.post('/del/target/deviceId',(req,res)=>{
    Api().deleteTarget(req,res)
})
app.post('/check/deviceId',(req,res)=>{
    Api().checkDeivceId(req,res)
})
app.post('/signup/overseas',(req,res)=>{
    Api().overseasSignup(req,res)
})
app.get('/find/overseas',(req,res)=>{
    Api().findAWS(req,res)
})
app.post('/find/test',(req,res)=>{
    Api().testToken(req,res)
})
app.post('/save/userKey',(req,res)=>{
    Api().saveUserKey(req,res)
})
app.post('/save/deviceId',(req,res)=>{
    Api().saveDeivceId(req,res)
})
app.post('/update/deviceInfo',(req,res)=>{
    Api().saveDeviceInfo(req,res)
})
app.get('/deviceVersion/download',(req,res,next)=>{
    Management().deviceVersionDownload(req,res)
})
app.get('/blaubit/doorbellsquare/apk/download',(req,res)=>{
    Management().apkDownload(req,res)
})
app.get('/version/dev/file/Management',(req,res)=>{
    Management().fileManagement(req,res)
})

app.post('/uploadS3File', upload.single('file'), function (req,res){
    Management().deviceS3Upload(req,res)
});
app.post('/department/version/download',(req,res)=>{
    Management().departVersionDownload(req,res)
})
app.post('/department/version/delete/file',(req,res)=>{
    Management().departmentVersionDelete(req,res)
})
app.post('/management/history/log',(req,res)=>{
    Management().versionLogFind(req,res)
})
app.post('/management/documents/file/download',(req,res)=>{
    Management().documentsDownload(req,res)
})
app.post('/history/logs/deleted',(req,res)=>{
    Management().deleteLog(req,res)
})
app.post('/history/search/table',(req,res)=>{
    Management().searchTable(req,res)
})


// //플랫폼 문의 + A/S + user
// app.get('/myrucell/get',async (req, res) => {
//     const myRucellService = await EagleSafesInquiries(); // 비동기 호출
//     myRucellService.getMyrucell(req, res)
// })
//
// //inquiries
//
// app.post('/myrucell/create/inquiries',async (req, res) => {
//     const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
//     inquiriesService.createInquiries(req, res)
// })
// app.post('/myrucell/update/inquiries',async (req, res) => {
//     const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
//     inquiriesService.updateInquiries(req, res)
// })
// app.post('/myrucell/delete/inquiries',async (req, res) => {
//     const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
//     inquiriesService.deleteInquiries(req, res)
// })







module.exports = app