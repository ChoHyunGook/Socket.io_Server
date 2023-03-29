const applyDotenv = require("../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../DataBase");
const Date = require("../Data/date");
const logger = require('morgan')
const express =require('express')




const socket = function (){

    return {
        socketService(turnData){
            const ServerName = turnData.SERVERNAME
            const app = express();
            // const server = require('http').createServer(app);

            const PORT = 8000;

            // const { Server } = require("socket.io");

            // const io = new Server(server, {
            //     cors: {
            //         origin: "*",
            //         methods: ["GET", "POST"]
            //     },
            //     path: ServerName,
            // })

            const { MESSAGE_NAME } = applyDotenv(dotenv)

            const socketLogs = db.logs

            app.listen(PORT,()=>{
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
                console.log(`********** 소켓서버(api:${ServerName}) On **********`)
                console.log(`********* 서버오픈일자: ${Date.today()} *********`)
                console.log('***************** ***************** *****************')
                console.log('***************** ***************** *****************')
            })


            const openDate = Date.today()

            const logDb = {log:`SocketServer::${turnData.ip}::${openDate}::${turnData.SERVERNAME}::${turnData.IP}::ServerOpen`}

            new socketLogs(logDb).save()
                .then(r => console.log('SocketServer Open Log data Save...'))
                .catch(err => console.log('SocketServer Open Log Save Error',err))

            app.use(logger('dev'))

            
            let deviceData=null;
            let appData=null;

            app.post(`/device/send/${ServerName}`,(req,res)=>{//디바이스에서 포스트
                try{
                    deviceData = req.body
                    res.status(200).send('Data Transport Success')
                }catch(e){
                    res.status(400).send('Data Transport Fail')
                }
                
                
            })

            app.post(`/app/send/${ServerName}`,(req,res)=>{//앱에서 포스트
                try{
                    appData = req.body
                    res.status(200).send('Data Transport Success')
                }catch(e){
                    res.status(400).send('Data Transport Fail')
                }
            })


            app.get(`/device/${ServerName}`,(req,res)=>{//디바이스쪽에서 계속 get요청
                if(appData !== null){
                    res.status(200).send(appData)
                    appData=null;
                }else{
                    
                }
            })

            app.get(`/app/${ServerName}`,(req,res)=>{//app쪽에서 계속 get요청
                if(deviceData !== null){
                    res.status(200).send(deviceData)
                    deviceData=null;
                }else{
                    
                }
            })



            // io.on('connection', (socket)=>{
            //     //서버 내에서 커넥된지 로그확인
            //     console.log(`Socket Connected Success ${socket.id}`);
            //     const connectDate = Date.connectDate()
            //     const logDb = {log:`socket.io::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${turnData.IP}::ConnectSuccess`}
            //     new socketLogs(logDb).save()
            //         .then(r => console.log('Socket Log data Save...'))
            //         .catch(err => console.log('Socket Log Save Error',err))

            //     // 앱, 디바이스로 커넥됫다고 메세지송신
            //     io.emit('Connected Success')

            //     socket.on(MESSAGE_NAME, function (data){
            //         console.log('Server Received Data');
            //         console.log(data)

            //         const msgLog = {log:`socket.io::msg::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${data}::${turnData.IP}::MessageSockets`}
            //         new socketLogs(msgLog).save()
            //             .then(r => console.log('Socket.msg Log data Save...'))
            //             .catch(err => console.log('Socket.msg Log Save Error',err))

            //         io.broadcast.emit(data)
            //     })

            //     socket.on("connect_error", (err) => {
            //         console.log(`connect_error due to ${err.message}`);
            //     });


            //     socket.on('error',(error)=>{
            //         console.log(error)
            //         const errorMessage = {log:`socket.io::error::${turnData.ip}::${connectDate}::${turnData.SERVERNAME}::${error}::${turnData.IP}::error`}
            //         new socketLogs(errorMessage).save()
            //             .then(r => console.log('Socket.msg Log data Save...'))
            //             .catch(err => console.log('Socket.msg Log Save Error',err))
            //         socket.emit(error)
            //     })

            //     socket.on('disconnect',()=>{
            //         console.log('User Disconnected')
            //         console.log('***************** ***************** *****************')
            //         console.log(`********** 소켓서버 Off **********`)
            //         console.log(`********** path: ${ServerName}  **********`)
            //         console.log('******************* 서버off일자 *******************')
            //         console.log(`********* ${Date.today()} *********`)
            //         console.log('***************** ***************** *****************')
            //         const closeDate = Date.today()

            //         const logDb = {log:`socket.io::${turnData.ip}::${closeDate}::${turnData.SERVERNAME}::${turnData.IP}::ServerClose`}

            //         new socketLogs(logDb).save()
            //             .then(r => console.log('SocketServer Close Log data Save...'))
            //             .catch(err => console.log('SocketServer Close Log Save Error',err))

            //         console.log(turnData.ip)

            //     })

            // });
        }
    }
}
module.exports = socket

