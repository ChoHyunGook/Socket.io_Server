const db = require("../../../DataBase");
const applyDotenv = require("../../../../lambdas/applyDotenv");
const dotenv = require("dotenv");


const WsVoiceService = function (webSocketServer, broadcast, infoData, server, openDate, socketLogs){

    const { WS_URL } = applyDotenv(dotenv)

    webSocketServer.on('connection',(ws,req)=>{

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if(ws.readyState === ws.OPEN){
            ws.send(`접속한 PORT(Voice): ${infoData.VOICE_PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer(Voice)`)
            broadcast(`접속한 PORT(Voice): ${infoData.VOICE_PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)

            const logDb = {log:`SocketServer::Connect::${ip}::${openDate}::${infoData.VOICE_PORT}::${infoData.MAC}::ServerConnect`}

            new socketLogs(logDb).save()
                .then(r => console.log(`[Success] SocketServer:${infoData.VOICE_PORT} Connected Log data Save...`))
                .catch(err => console.log(`[Fail] SocketServer:${infoData.VOICE_PORT} Connected Log Save Error`,err))
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
                    if(cl !== null){
                        Info.deleteMany({VOICE_PORT:infoData.VOICE_PORT,VIDEO_PORT:infoData.VIDEO_PORT})
                            .then(res=>{
                                const deviceGet = {log: `disConnect::${infoData.VOICE_PORT}::${openDate}::${infoData.MAC}::DisConnect`}
                                new socketLogs(deviceGet).save()
                                    .then(r => console.log('[Success] VOICE_PORT DisConnect Message...'))
                                    .catch(e => console.log('[Fail] VOICE_PORT DisConnect Message...', e))
                                server.close(()=>{
                                    console.log(`${infoData.VOICE_PORT} 서버 종료`)
                                    const wsModule = require('ws')
                                    const wss = new wsModule(`${WS_URL}:${infoData.VIDEO_PORT}`);
                                    wss.onopen = () => {
                                        wss.close();
                                    }
                                })
                            })
                    }else{
                        server.close(()=>{
                            console.log(`VideoPort에서 PORT: ${infoData.VOICE_PORT} 서버 종료`)
                        })
                    }
                })
                .catch(e=>{
                    server.close(()=>{
                        console.log(`PORT: ${infoData.VOICE_PORT} 서버 종료`)
                    })
                })
        })

    })

}

module.exports=WsVoiceService
