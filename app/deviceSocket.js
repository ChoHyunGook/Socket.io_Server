
const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')
const express =require('express')
const appSocket = require("./appSocket");



const deviceSocket = function (){


    return {
        deviceSocket(infoData, appPostData){

            const app = express();

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

            const logDb = {log:`SocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::DeviceServerOpen`}

            new socketLogs(logDb).save()
                .then(r => console.log('[Success] SocketServer Open Log data Save...'))
                .catch(err => console.log('[Fail] SocketServer Open Log Save Error',err))

            app.use(logger('dev'))


            app.get('/connect',(req,res)=>{
                res.status(200).send(`Device Socket Port:${PORT} Connected Success`)
            })

            let appMessage = appPostData

            //디바이스쪽에서 계속 get요청
            app.get(`/`,(req,res)=>{
                if(appMessage === undefined){
                    console.log(`get: ${PORT}/device requseting...`)
                }else{
                    const deviceGet={log:`DeviceSocket::GET::${PORT}::${openDate}::${appMessage}::DeviceGetMessage`}
                    new socketLogs(deviceGet).save()
                        .then(r=>console.log('[Success] DeviceSocket Get Message...'))
                        .catch(e=>console.log('[Fail] DeviceSocket Get Message...',e))

                    res.status(200).send(appMessage)
                    appMessage = undefined;

                }
            })



            //디바이스=> 앱 메세지전송
            app.post(`/device`,(req,res)=>{
                try{
                    let devicePostData =req.body
                    appSocket().appSocket(devicePostData)
                    const devicePost={log:`DeviceSocket::POST::${PORT}::${openDate}::${devicePostData}::DevicePOSTMessage`}
                    new socketLogs(devicePost).save()
                        .then(r=>console.log('[Success] DeviceSocket POST Message...'))
                        .catch(e=>console.log('[Fail] DeviceSocket POST Message...',e))

                    res.status(200).send('Data Transport Success')
                }catch(e){
                    res.status(400).send('Data Transport Fail')
                }

            })


        }
    }
}
module.exports = deviceSocket