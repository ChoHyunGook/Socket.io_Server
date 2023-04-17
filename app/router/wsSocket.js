const express =require('express')
const wsModule = require('ws')
const Date = require("../../Data/date");
const WsService = require("../service/wsService");
const db = require("../../DataBase");


const WsSocket = function (infoData,Restart){

    const app = express()

    const PORT = infoData.PORT;

    const socketLogs = db.logs

    const openDate = Date.today()

    let server

    if(Restart.reStart === 'None'){
        server = app.listen(PORT,()=>{
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** 소켓서버(port :${PORT}) On **********`)
            console.log(`********* 서버오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`SocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.MAC}::SocketServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] SocketServer:${PORT} Open Log data Save...`))
            .catch(err => console.log(`[Fail] SocketServer:${PORT} Open Log Save Error`,err))

        const webSocketServer = new wsModule.WebSocketServer({
            server:server
        });

        let broadcast = webSocketServer.broadcast = (message) => {
            webSocketServer.clients.forEach((client)=>{
                client.send(message)
            })
        }

        WsService(webSocketServer,broadcast)
    }else {

        server = app.listen(PORT,()=>{
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** 소켓서버(port :${PORT}) On **********`)
            console.log(`********* 서버 재오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`RestartSocketServer::${infoData.ip}::${openDate}::${PORT}::${infoData.MAC}::RestartServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] RestartSocketServer:${PORT} Open Log data Save...`))
            .catch(err => console.log(`[Fail] RestartSocketServer:${PORT} Open Log Save Error`,err))

        const webSocketServer = new wsModule.WebSocketServer({
            server:server
        });

        let broadcast = webSocketServer.broadcast = (message) => {
            webSocketServer.clients.forEach((client)=>{
                client.send(message)
            })
        }

        WsService(webSocketServer,broadcast,PORT,server,openDate,socketLogs)
    }







}


module.exports = WsSocket