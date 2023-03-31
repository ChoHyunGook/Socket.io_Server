const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')
const express =require('express')
const deviceSocket = require("./deviceSocket");




const appSocket = function (){

    return {
        appSocket(infoData,devicePostData){

            const app = express();

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

            const logDb = {log:`SocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.IP}::AppServerOpen`}

            new socketLogs(logDb).save()
                .then(r => console.log(`AppSocketServer:${PORT} Open Log data Save...`))
                .catch(err => console.log(`AppSocketServer:${PORT} Open Log Save Error`,err))

            app.use(logger('dev'))

            let deviceMessage=devicePostData;

            app.get('/connect',(req,res)=>{
                res.status(200).send(`App Socket Port:${PORT} Connected Success`)
            })

            //앱 쪽에서 계속 get요청
            app.get(`/`,(req,res)=>{
                if(deviceMessage === undefined){
                    console.log(`get: ${PORT}/device requseting...`)
                }else {
                    const deviceGet={log:`AppSocket::GET::${PORT}::${openDate}::${deviceMessage}::AppGetMessage`}
                    new socketLogs(deviceGet).save()
                        .then(r=>console.log('[Success] AppSocket Get Message...'))
                        .catch(e=>console.log('[Fail] AppSocket Get Message...',e))

                    res.status(200).send(deviceMessage)
                    deviceMessage = undefined
                }
            })


            //앱 => 디바이스 메세지전송
            app.post(`/app`,(req,res)=>{
                try {
                    let appPostData=req.body
                    deviceSocket().deviceSocket(appPostData)
                    res.status(200).send('Data Transport Success')
                    const appPost={log:`AppSocket::POST::${PORT}::${openDate}::${appPostData}::DevicePOSTMessage`}
                    new socketLogs(appPost).save()
                        .then(r=>console.log('[Success] AppSocket POST Message...'))
                        .catch(e=>console.log('[Fail] AppSocket POST Message...',e))

                }catch (e){
                    res.status(400).send('Data Transport Fail')
                }


            })
        }
    }
}
module.exports = appSocket

