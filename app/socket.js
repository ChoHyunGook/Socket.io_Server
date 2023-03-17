const express =require('express')
const http =require('http')
const SocketIo = require('socket.io')
const applyDotenv = require("../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../DataBase");
const Date = require("../Data/date");



const socket = function (){
    const app = express();
    const server = http.createServer(app)

    const { MESSAGE_NAME } = applyDotenv(dotenv)

    const socketLogs = db.logs

    return {
        socketService(turnData){

            const ServerName = turnData.SERVERNAME

            const io = SocketIo(server, { path: ServerName })

            server.listen(8000,()=>{
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
                console.log(`********** 소켓서버 On **********`)
                console.log(`********** path: ${ServerName}  **********`)
                console.log('******************* 서버오픈일자 *******************')
                console.log(`********* ${Date.today()} *********`)
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
            });

            console.log(turnData.ip)

            io.on('connection', (socket)=>{
                //서버 내에서 커넥된지 로그확인
                console.log(`Socket Connected Success`);
                const connectDate = Date.connectDate()
                const logDb = {log:`socket.io::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${turnData.IP}::ConnectSuccess`}
                new socketLogs(logDb).save()
                    .then(r => console.log('Socket Log data Save...'))
                    .catch(err => console.log('Socket Log Save Error',err))

                // 앱, 디바이스로 커넥됫다고 메세지송신
                io.emit('Connected Success')

                socket.on(MESSAGE_NAME, function (data){
                    console.log('Server Received Data');
                    console.log(data)

                    const msgLog = {log:`socket.io::msg::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${data}::${turnData.IP}::MessageSockets`}
                    new socketLogs(msgLog).save()
                        .then(r => console.log('Socket.msg Log data Save...'))
                        .catch(err => console.log('Socket.msg Log Save Error',err))

                    io.broadcast.emit(data)
                })

                socket.on('disconnect',()=>{
                    console.log('User Disconnected')
                })

            });
        }
    }
}
module.exports = socket

