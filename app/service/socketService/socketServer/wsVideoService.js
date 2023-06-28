const db = require("../../../DataBase");
const applyDotenv = require("../../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const wsModule = require("ws");


const WsVideoService = function (webSocketServer, broadcast, infoData, server, openDate, socketLogs){

    const { WS_URL } = applyDotenv(dotenv)

    webSocketServer.on('connection',(ws,req)=>{

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if(ws.readyState === ws.OPEN){
            ws.send(`접속한 PORT: ${infoData.VIDEO_PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)
            broadcast(`접속한 PORT: ${infoData.VIDEO_PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)

            const logDb = {log:`SocketServer::Connect::${ip}::${openDate}::${infoData.VIDEO_PORT}::${infoData.MAC}::ServerConnect`}

            new socketLogs(logDb).save()
                .then(r => console.log(`[Success] SocketServer:${infoData.VIDEO_PORT} Connected Log data Save...`))
                .catch(err => console.log(`[Fail] SocketServer:${infoData.VIDEO_PORT} Connected Log Save Error`,err))
        }

        ws.on('message',(msg)=>{
            broadcast(msg)
            ws.send('sendMessage Success')
            ws.send(`보낸메세지: ${msg}`)
        })


        ws.on('error',(error)=>{
            ws.send(error)
            broadcast(error)
        })

        ws.on('close',()=>{
            const Info = db.Info
            Info.findOne({VOICE_PORT:infoData.VOICE_PORT,VIDEO_PORT:infoData.VIDEO_PORT})
                .then(cl=>{
                    if(cl === null){
                        server.close(()=>{
                            console.log(`VoicePort에서 PORT: ${infoData.VIDEO_PORT} 서버 종료`)
                        })
                    }else{
                        Info.deleteMany({VOICE_PORT:infoData.VOICE_PORT,VIDEO_PORT:infoData.VIDEO_PORT})
                            .then(res=>{
                                const deviceGet = {log: `disConnect::${infoData.VIDEO_PORT}::${openDate}::${infoData.MAC}::DisConnect`}
                                new socketLogs(deviceGet).save()
                                    .then(r => console.log('[Success] VIDEO_PORT DisConnect Message...'))
                                    .catch(e => console.log('[Fail] VIDEO_PORT DisConnect Message...', e))
                                server.close(()=>{
                                    console.log(`${infoData.VIDEO_PORT} 서버 종료`)
                                    const wsModule = require('ws')
                                    const wss = new wsModule(`${WS_URL}:${infoData.VOICE_PORT}`);
                                    wss.onopen = () => {
                                        wss.close();
                                    }
                                })
                            })
                    }
                })
                .catch(e=>{
                    server.close(()=>{
                        console.log(`PORT: ${infoData.VIDEO_PORT} 서버 종료`)
                    })
                })
        })

    })

}

module.exports=WsVideoService
