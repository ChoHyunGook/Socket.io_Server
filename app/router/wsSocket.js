const express =require('express')
const wsModule = require('ws')
const Date = require("../../Data/date");
const WsService = require("../service/wsService");
const db = require("../../DataBase");


const WsSocket = function (infoData,Restart){

    const app = express()

    const APP_PORT = infoData.APP_PORT;

    const socketLogs = db.logs

    const openDate = Date.today()

    let server

    if(Restart.reStart === 'None'){
        server = app.listen(APP_PORT,()=>{
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** 소켓서버(port :${APP_PORT}) On **********`)
            console.log(`********* 서버오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`SocketServer::${infoData.ip}::${openDate}::${APP_PORT}::${infoData.MAC}::SocketServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] SocketServer:${APP_PORT} Open Log data Save...`))
            .catch(err => console.log(`[Fail] SocketServer:${APP_PORT} Open Log Save Error`,err))

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

        server = app.listen(APP_PORT,()=>{
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
            console.log(`********** 소켓서버(port :${APP_PORT}) On **********`)
            console.log(`********* 서버 재오픈일자: ${Date.today()} *********`)
            console.log('***************** ***************** *****************')
            console.log('***************** ***************** *****************')
        })

        const logDb = {log:`RestartSocketServer::${infoData.ip}::${openDate}::${APP_PORT}::${infoData.MAC}::RestartServerOpen`}

        new socketLogs(logDb).save()
            .then(r => console.log(`[Success] RestartSocketServer:${APP_PORT} Open Log data Save...`))
            .catch(err => console.log(`[Fail] RestartSocketServer:${APP_PORT} Open Log Save Error`,err))

        const webSocketServer = new wsModule.WebSocketServer({
            server:server
        });

        let broadcast = webSocketServer.broadcast = (message) => {
            webSocketServer.clients.forEach((client)=>{
                client.send(message)
            })
        }

        WsService(webSocketServer,broadcast)
    }







}


module.exports = WsSocket