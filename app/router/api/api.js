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

// app.post('/saveHistory',(req,res)=>{
//     Api().saveHistory(req,res)
// })

app.get('/', (req,res)=>{
    Api().getService(req,res)
})

// app.get('/date',(req,res)=>{
//     Api().deviceVideoDate(req,res)
// })

// app.post('/dynamoUserKey',(req,res)=>{
//     Api().dynamoUserKey(req,res)
// })
app.post('/signup/overseas',(req,res)=>{
    Api().overseasSignup(req,res)
})
app.get('/find/overseas',(req,res)=>{
    Api().findAWS(req,res)
})
app.get('/find/test',(req,res)=>{
    Api().findAWS(req,res)
})
app.post('/save/userKey',(req,res)=>{
    Api().saveUserKey(req,res)
})
app.post('/save/deviceId',(req,res)=>{
    Api().saveDeivceId(req,res)
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






module.exports = app