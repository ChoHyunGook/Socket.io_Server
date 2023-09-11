const express = require('express')
const app = express();
const Api = require('../../service/api/api')
const multer = require('multer');
const {router} = require("express/lib/application");
var storage = multer.memoryStorage()
var upload = multer({storage: storage});


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
    Api().deviceVersionDownload(req,res)
})
app.get('/deviceVersion/update/dev',(req,res)=>{
    Api().deviceUpload(req,res)
})

app.post('/uploadS3File', upload.single('file'), function (req,res){
    Api().deviceS3Upload(req,res)
});






module.exports = app