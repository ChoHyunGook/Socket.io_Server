
const db = require("../../DataBase");
const Date = require("../../Data/date");
const logger = require('morgan')
const express =require('express')
const socketRouter = require("../router/socketRouter");




const DeviceSocket = function (infoData){

    const app = express();

    //post 방식 일경우 begin
//post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
    app.use(express.static('public'));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅

    const DEVICE_PORT = infoData.DEVICE_PORT;

    let server = app.listen(DEVICE_PORT,()=>{
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
        console.log(`********** Device 소켓서버(port :${DEVICE_PORT}) On **********`)
        console.log(`********* 서버오픈일자: ${Date.today()} *********`)
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
    })

    const socketLogs = db.logs

    const openDate = Date.today()

    const logDb = {log:`DeviceSocketServer::${infoData.ip}::${openDate}::${DEVICE_PORT}::${infoData.MAC}::DeviceServerOpen`}

    new socketLogs(logDb).save()
        .then(r => console.log(`[Success] DeviceSocketServer:${DEVICE_PORT} Open Log data Save...`))
        .catch(err => console.log(`[Fail] DeviceSocketServer:${DEVICE_PORT} Open Log Save Error`,err))

    app.use(logger('dev'))

    // 디바이스 연결확인
    app.get('/connect',(req,res)=>{
        const logDb = {log:`DeviceSocketServer::Connect::${infoData.ip}::${openDate}::${DEVICE_PORT}::${infoData.MAC}::DeviceServerConnect`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] DeviceSocketServer:${DEVICE_PORT} Connected Log data Save...`))
            .catch(err => console.log(`[Fail] DeviceSocketServer:${DEVICE_PORT} Connected Log Save Error`,err))
        res.status(200).send(`Device Socket Port:${DEVICE_PORT} Connected Success`)
    })

    //디바이스=> 앱 메세지전송 {msg:rstp이진화코드}
    app.post(`/msg`,(req,res)=>{
        try{
            let data =req.body
            let message = data[0]
            let APP_PORT=infoData.APP_PORT
            socketRouter().devicePostSocketMessage(message,APP_PORT)
            res.status(200).json({message:'Data Transport Success'})
        }catch(e){
            console.log(e)
            res.status(400).send('Data Transport Fail')
        }

    })

    //디바이스쪽에서 계속 get요청
    app.get(`/`,(req,res)=>{
        const appPostData = socketRouter().deviceGetSocketMessage(DEVICE_PORT)
        const sendMSG = appPostData.map(e => e.msg)
        const sendData = sendMSG.join(',')
        res.status(200).send(sendData)
        socketRouter().appPostDataInitialization(DEVICE_PORT)

    })

    //서버종료
    app.get('/disConnect',(req,res)=>{
        const Info = db.Info
        Info.findOne({APP_PORT:infoData.APP_PORT,DEVICE_PORT:DEVICE_PORT})
            .then(cl=>{
                if(cl !== null){
                    Info.deleteMany({APP_PORT:infoData.APP_PORT,DEVICE_PORT:DEVICE_PORT})
                        .then(com=>{
                            const deviceGet = {log: `DeviceSocket::GET::/disConnect::${DEVICE_PORT}::${openDate}::DeviceDisConnect`}
                            new socketLogs(deviceGet).save()
                                .then(r => console.log('[Success] AppSocket DisConnect Message...'))
                                .catch(e => console.log('[Fail] AppSocket DisConnect Message...', e))
                            server.close(()=>{
                                console.log(`${DEVICE_PORT} 서버 종료`)
                            })
                            res.status(200).send(`Device PORT:${DEVICE_PORT} 서버가 종료되었습니다.`)
                        })
                        .catch(e=>{
                            res.status(400).send(e)
                        })
                }else{
                    server.close(()=>{
                        console.log(`PORT: ${DEVICE_PORT} 서버 종료`)
                    })
                    res.status(400).send(`PORT:${DEVICE_PORT} 이미 삭제된 서버입니다.`)
                }

            })
            .catch(e=>{
                server.close(()=>{
                    console.log(`${DEVICE_PORT} 서버 종료`)
                })
                res.status(400).send(`PORT:${DEVICE_PORT} 이미 삭제된 서버입니다.`)
            })
    })



}
module.exports = DeviceSocket
