const express =require('express')
const SocketIo = require('socket.io')
const applyDotenv = require("../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')



const socket = function (){

    return {
        socketService(turnData){

            const app = express();
            app.use(logger('dev'))


            const { MESSAGE_NAME } = applyDotenv(dotenv)

            const socketLogs = db.logs

            const server = app.listen(8000,()=>{
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
                console.log(`********** 소켓서버 On **********`)
                console.log(`********** path: ${ServerName}  **********`)
                console.log('******************* 서버오픈일자 *******************')
                console.log(`********* ${Date.today()} *********`)
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
            })


            const ServerName = turnData.SERVERNAME

            const io = SocketIo(server, {
                    path: ServerName,
                cors: {
                    origin: "*",
                    methods: ["GET", "POST"]
                }
            })

            const openDate = Date.today()

            const logDb = {log:`socket.io::${turnData.ip}::${openDate}::${turnData.SERVERNAME}::${turnData.IP}::ServerOpen`}

            new socketLogs(logDb).save()
                .then(r => console.log('SocketServer Open Log data Save...'))
                .catch(err => console.log('SocketServer Open Log Save Error',err))


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

                socket.on('error',(error)=>{
                    console.log(error)
                    const errorMessage = {log:`socket.io::error::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${error}::${turnData.IP}::error`}
                    new socketLogs(errorMessage).save()
                        .then(r => console.log('Socket.msg Log data Save...'))
                        .catch(err => console.log('Socket.msg Log Save Error',err))
                    socket.emit(error)
                })

                socket.on('disconnect',()=>{
                    console.log('User Disconnected')
                    console.log('***************** ***************** *****************')
                    console.log(`********** 소켓서버 Off **********`)
                    console.log(`********** path: ${ServerName}  **********`)
                    console.log('******************* 서버off일자 *******************')
                    console.log(`********* ${Date.today()} *********`)
                    console.log('***************** ***************** *****************')
                    const closeDate = Date.today()

                    const logDb = {log:`socket.io::${turnData.ip}::${closeDate}::${turnData.SERVERNAME}::${turnData.IP}::ServerClose`}

                    new socketLogs(logDb).save()
                        .then(r => console.log('SocketServer Close Log data Save...'))
                        .catch(err => console.log('SocketServer Close Log Save Error',err))

                    console.log(turnData.ip)

                })

            });
        }
    }
}
module.exports = socket

