const express = require('express')
const app = express();
const Api = require('../../service/api/api')
const Management = require('../../service/api/management')
const multer = require('multer');
var storage = multer.memoryStorage()
var upload = multer({storage: storage});



app.post('/start_up',(req,res)=>{

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

app.get('/deviceVersion/download',(req,res,next)=>{
    Management().deviceVersionDownload(req,res)
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