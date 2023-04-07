const db = require("../../DataBase");
const Date = require("../../Data/date");
const logger = require('morgan')
const express =require('express')
const socketRouter = require("../router/socketRouter");





const ApplicationSocket = function (infoData,Restart){
    const app = express();

    //post 방식 일경우 begin
    //post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
    app.use(express.static('public'));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅

    const APP_PORT = infoData.APP_PORT;

    const socketLogs = db.logs

    const openDate = Date.today()

    let server;

    if(Restart.reStart === 'None'){
        server = app.listen(APP_PORT,(err)=>{
            if(err) throw err
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** App 소켓서버(port :${APP_PORT}) On **********`)
            console.log(`********* 서버오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`AppSocketServer::${infoData.ip}::${openDate}::${APP_PORT}::${infoData.MAC}::AppServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`AppSocketServer:${APP_PORT} Open Log data Save...`))
            .catch(err => console.log(`AppSocketServer:${APP_PORT} Open Log Save Error`,err))
    }else{
        server = app.listen(APP_PORT,()=>{
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** App 소켓서버(port :${APP_PORT}) On **********`)
            console.log(`********* 서버 재오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`RestartAppSocketServer::${infoData.ip}::${openDate}::${APP_PORT}::${infoData.MAC}::RestartAppServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`RestartAppSocketServer:${APP_PORT} Open Log data Save...`))
            .catch(err => console.log(`RestartAppSocketServer:${APP_PORT} Open Log Save Error`,err))
    }


    app.use(logger('dev'))


    // 앱 연결확인
    app.get('/connect',(req,res)=>{
        try {
            const logDb = {log:`AppSocketServer::Connect::${infoData.ip}::${openDate}::${APP_PORT}::${infoData.MAC}::DeviceServerConnect`}

            new socketLogs(logDb).save()
                .then(r => console.log(`[Success] AppSocketServer:${APP_PORT} Connected Log data Save...`))
                .catch(err => console.log(`[Fail] AppSocketServer:${APP_PORT} Connected Log Save Error`,err))

            res.status(200).send(`App Socket Port:${APP_PORT} Connected Success`)
        }catch (e){
            res.status(400).send(`App Socket Connected Fail...`)
        }

    })


    app.post(`/msg`,(req,res)=>{
        try {
            socketRouter().appPostSocketMessage(req.body[0], infoData.DEVICE_PORT)
            res.status(200).send('Data Transport Success')
        }catch (e){
            res.status(400).send('Data Transport Fail')
        }


    })

    //앱 쪽에서 계속 get요청
    app.get(`/`, (req, res) => {
        res.status(200).send(socketRouter().appGetSocketMessage(APP_PORT))
        socketRouter().devicePostDataInitialization(APP_PORT)
    })


    //DB내 삭제 및 app종료
    app.get('/disConnect',(req,res)=>{
        const Info = db.Info
        Info.findOne({APP_PORT:APP_PORT,DEVICE_PORT:infoData.DEVICE_PORT})
            .then(cl=>{
                if(cl !== null){
                    Info.deleteMany({APP_PORT:APP_PORT,DEVICE_PORT:infoData.DEVICE_PORT})
                        .then(com=>{
                            const deviceGet = {log: `AppSocket::GET::/disConnect::${APP_PORT}::${openDate}::AppDisConnect`}
                            new socketLogs(deviceGet).save()
                                .then(r => console.log('[Success] AppSocket DisConnect Message...'))
                                .catch(e => console.log('[Fail] AppSocket DisConnect Message...', e))
                            server.close(()=>{
                                console.log(`${APP_PORT} 서버 종료`)
                            })
                            res.status(200).send(`App PORT:${APP_PORT} 앱 서버가 종료되었습니다.`)
                        })
                        .catch(e=>{
                            res.status(400).send(e)
                        })
                }else{
                    server.close(()=>{
                        console.log(`${APP_PORT} 서버 종료`)
                    })
                    res.status(400).send(`PORT:${APP_PORT} 이미 삭제된 서버입니다.`)
                }
            })
            .catch(e=>{
                server.close(()=>{
                    console.log(`${APP_PORT} 서버 종료`)
                })
                res.status(400).send(`PORT:${APP_PORT} 이미 삭제된 서버입니다.`)
            })


    })

}
module.exports = ApplicationSocket

