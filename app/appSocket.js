const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')
const express =require('express')
const DeviceSocket = require("./deviceSocket");




const ApplicationSocket = function (infoData,devicePostData){
    const app = express();

    //post 방식 일경우 begin
    //post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
    app.use(express.static('public'));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅

    const PORT = infoData.APP_PORT;

    app.listen(PORT,()=>{
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
        console.log(`********** App 소켓서버(port :${PORT}) On **********`)
        console.log(`********* 서버오픈일자: ${Date.today()} *********`)
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
    })

    const socketLogs = db.logs

    const openDate = Date.today()

    const logDb = {log:`AppSocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::AppServerOpen`}

    new socketLogs(logDb).save()
        .then(r => console.log(`AppSocketServer:${PORT} Open Log data Save...`))
        .catch(err => console.log(`AppSocketServer:${PORT} Open Log Save Error`,err))

    app.use(logger('dev'))

    app.get('/connect',(req,res)=>{
        const logDb = {log:`AppSocketServer::Connect::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::DeviceServerConnect`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] AppSocketServer:${PORT} Connected Log data Save...`))
            .catch(err => console.log(`[Fail] AppSocketServer:${PORT} Connected Log Save Error`,err))

        res.status(200).send(`App Socket Port:${PORT} Connected Success`)
    })


    //앱 => 디바이스 메세지전송
    app.post(`/message`,(req,res)=>{
        try {
            let appPostData=req.body
            DeviceSocket().getService(appPostData)
            res.status(200).send('Data Transport Success')
            const appPost={log:`AppSocket::POST::${PORT}::${openDate}::${appPostData}::DevicePOSTMessage`}
            new socketLogs(appPost).save()
                .then(r=>console.log('[Success] AppSocket POST Message...'))
                .catch(e=>console.log('[Fail] AppSocket POST Message...',e))

        }catch (e){
            res.status(400).send('Data Transport Fail')
        }


    })

    //앱 쪽에서 계속 get요청

    app.get(`/`,(req,res)=>{
        if(devicePostData === undefined){
            console.log(`get: ${PORT}/device requseting...`)
        }else {
            const deviceGet={log:`AppSocket::GET::${PORT}::${openDate}::${devicePostData}::AppGetMessage`}
            new socketLogs(deviceGet).save()
                .then(r=>console.log('[Success] AppSocket Get Message...'))
                .catch(e=>console.log('[Fail] AppSocket Get Message...',e))

            res.status(200).send(devicePostData)
        }
    })

}
module.exports = ApplicationSocket

