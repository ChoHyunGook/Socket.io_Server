const express = require('express')
const app = express();
const Api = require('../../service/api/api')
const fs = require('fs')


app.get('/allHistory',(req,res)=>{
    Api().getAllHistory(req,res)
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

app.post('/saveHistory',(req,res)=>{
    Api().saveHistory(req,res)
})

app.get('/', (req,res)=>{
    Api().getService(req,res)
})

app.get('/date',(req,res)=>{
    Api().deviceVideoDate(req,res)
})

app.post('/dynamoUserKey',(req,res)=>{
    Api().dynamoUserKey(req,res)
})

// app.get('/quit',(req,res)=>{
//     Api().quitTime(req,res)
// })
//
// app.get('/quit/:quit',(req,res)=>{
//     Api().freeQuit(req,res)
// })
app.post('/quit',(req,res)=>{
    Api().quitTime(req,res)
})



module.exports = app