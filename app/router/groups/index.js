const express =require('express')
const app = express();
const Groups = require('../../service/Groups');


app.get('/alarms/info', (req, res) => {
    Groups().getAlarms(req,res)
})

app.patch('/alarms/master/privacy',(req,res)=>{
    Groups().patchMasterPrivacy(req,res)
})

app.get('/latest_device_id', (req,res)=>{
    Groups().latestDeviceId(req,res)
})

app.patch('/latest_device_id',(req,res)=>{
    Groups().patchLatestDeviceId(req,res)
})

//http://socket.doorbellsquare.com:8080


module.exports = app;