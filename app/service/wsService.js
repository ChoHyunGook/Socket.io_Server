



const WsService = function (webSocketServer,broadcast){

    webSocketServer.on('connection',(ws,req)=>{

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        console.log(`IP: ${ip} 가 접속하였습니다.`)
        broadcast(`IP: ${ip} 가 접속하였습니다.`)

        if(ws.readyState === ws.OPEN){
            ws.send(`클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)
            broadcast(`클라이언트 IP address:${ip} 접속성공 ::WebSocketServer`)
        }

        ws.on('message',(msg)=>{
            broadcast(msg)
        })
    })

}

module.exports=WsService