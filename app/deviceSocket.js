
const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')
const express =require('express')
const ApplicationSocket = require("./appSocket");



const DeviceSocket = function (infoData){

    const app = express();

    //post 방식 일경우 begin
//post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
    app.use(express.static('public'));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅

    const PORT = infoData.DEVICE_PORT;

    app.listen(PORT,()=>{
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
        console.log(`********** Device 소켓서버(port :${PORT}) On **********`)
        console.log(`********* 서버오픈일자: ${Date.today()} *********`)
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
    })

    const socketLogs = db.logs

    const openDate = Date.today()

    const logDb = {log:`DeviceSocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::DeviceServerOpen`}

    new socketLogs(logDb).save()
        .then(r => console.log(`[Success] DeviceSocketServer:${PORT} Open Log data Save...`))
        .catch(err => console.log(`[Fail] DeviceSocketServer:${PORT} Open Log Save Error`,err))

    app.use(logger('dev'))


    app.get('/connect',(req,res)=>{
        const logDb = {log:`DeviceSocketServer::Connect::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::DeviceServerConnect`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] DeviceSocketServer:${PORT} Connected Log data Save...`))
            .catch(err => console.log(`[Fail] DeviceSocketServer:${PORT} Connected Log Save Error`,err))
        res.status(200).send(`Device Socket Port:${PORT} Connected Success`)
    })

    //디바이스=> 앱 메세지전송
    app.post(`/message`,(req,res)=>{
        try{
            let devicePostData =req.body
            ApplicationSocket(devicePostData)
            const devicePost={log:`DeviceSocket::POST::${PORT}::${openDate}::${devicePostData}::DevicePOSTMessage`}
            new socketLogs(devicePost).save()
                .then(r=>console.log('[Success] DeviceSocket POST Message...'))
                .catch(e=>console.log('[Fail] DeviceSocket POST Message...',e))
            res.status(200).json({message:'Data Transport Success'})
        }catch(e){
            console.log(e)
            res.status(400).send('Data Transport Fail')
        }

    })


    return {
        getService(appPostData){

            //디바이스쪽에서 계속 get요청
            app.get(`/`,(req,res)=>{
                if(appPostData === undefined){
                    console.log(`get: ${PORT}/device requseting...`)
                }else{
                    const deviceGet={log:`DeviceSocket::GET::${PORT}::${openDate}::${appPostData}::DeviceGetMessage`}
                    new socketLogs(deviceGet).save()
                        .then(r=>console.log('[Success] DeviceSocket Get Message...'))
                        .catch(e=>console.log('[Fail] DeviceSocket Get Message...',e))

                    res.status(200).send(appPostData)
                    appPostData = undefined;

                }
            })




        }
    }
}
module.exports = DeviceSocket