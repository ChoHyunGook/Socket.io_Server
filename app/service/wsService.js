const db = require("../../DataBase");


const WsService = function (webSocketServer,broadcast,PORT,server,openDate,socketLogs){


    webSocketServer.on('connection',(ws,req)=>{

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if(ws.readyState === ws.OPEN){
            ws.send(`접속한 PORT: ${PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)
            broadcast(`접속한 PORT: ${PORT} 클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)
        }

        ws.on('message',(msg)=>{
            broadcast(msg)
            ws.send('sendMessage Success')
            ws.send(`서버msg: ${msg}`)
        })

        ws.on('error',(error)=>{
            ws.send(error)
            broadcast(error)
        })

        ws.on('close',()=>{
            const Info = db.Info
            Info.findOne({PORT:PORT})
                .then(cl=>{
                    if(cl !== null){
                        Info.deleteMany({PORT:PORT})
                            .then(res=>{
                                const deviceGet = {log: `disConnect::${PORT}::${openDate}::DisConnect`}
                                new socketLogs(deviceGet).save()
                                    .then(r => console.log('[Success] AppSocket DisConnect Message...'))
                                    .catch(e => console.log('[Fail] AppSocket DisConnect Message...', e))
                                server.close(()=>{
                                    console.log(`${PORT} 서버 종료`)
                                })
                            })
                    }
                })
        })

    })

}

module.exports=WsService