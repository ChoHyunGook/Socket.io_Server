const express =require('express')
const http =require('http')
const jwt = require('jsonwebtoken')
const socketio = require('socket.io')
const moment = require('moment-timezone')
const requestIp = require('request-ip')
const mongoose = require('mongoose')
const { Schema } = require("mongoose");


const app = express();
const server = http.createServer(app);
const io = socketio(server)
require('dotenv').config()



const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.DB_NAME
mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URI,{dbName:DB_NAME})
    .then(() => {
        console.log(' ### 몽고DB 연결 성공 ### ')
    })
    .catch(err => {
        console.log(' 몽고DB와 연결 실패', err)
        process.exit();
    });

const logSchema = new Schema({
    log: {type:String, expires:15552000}//6달(180일)
},{ versionKey : false })

const logs = mongoose.model('Logs',logSchema)

const PORT = process.env.PORT
const SECRET_KEY = process.env.SECRET_KEY
const ROOM_NAME = process.env.ROOM_NAME
const MESSAGE_NAME = process.env.MESSAGE_NAME
const STREAMING_NAME = process.env.STREAMING_NAME
const EXPIRES_TIME =process.env.EXPIRES

let count = 0;

const opens = moment().tz('Asia/Seoul')
const days1 = opens.format('dddd')
const hours1 = opens.format('HH')
let kodays1;
let ampm1;
let hour1;

switch (days1){
    case 'Sunday':
        kodays1='일요일'
        break;
    case 'Monday':
        kodays1='월요일'
        break;
    case 'Tuesday':
        kodays1='화요일'
        break;
    case 'Wednesday':
        kodays1='수요일'
        break;
    case 'Thursday':
        kodays1='목요일'
        break;
    case 'Friday':
        kodays1='금요일'
        break;
    case 'Saturday':
        kodays1='토요일'
        break;
}

if(hours1<=12){
    ampm1 = '오전'
    hour1 = hours1
}else{
    ampm1 = '오후'
    hour1 = hours1-12
}

const today1 = opens.format(`YYYY년 MM월 DD일 ${kodays1} ${ampm1} ${hour1}:mm:ss`)
const logToday1 = opens.format('YYYY:MM:DD.HH:mm:ss')
app.set('trust proxy',true)
app.get('/',(req,res)=>{
    const AccessIp = requestIp.getClientIp(req)
    const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
    count++;
    const fileName = './picture/spinner.gif'
    const m = moment().tz('Asia/Seoul')
    const days = m.format('dddd')
    const hours = m.format('HH')
    let kodays;
    let ampm;
    let hour;

    switch (days){
        case 'Sunday':
            kodays='일요일'
            break;
        case 'Monday':
            kodays='월요일'
            break;
        case 'Tuesday':
            kodays='화요일'
            break;
        case 'Wednesday':
            kodays='수요일'
            break;
        case 'Thursday':
            kodays='목요일'
            break;
        case 'Friday':
            kodays='금요일'
            break;
        case 'Saturday':
            kodays='토요일'
            break;
    }

    if(hours<=12){
        ampm = '오전'
        hour = hours
    }else{
        ampm = '오후'
        hour = hours-12
    }


    const today = m.format(`YYYY년 MM월 DD일 ${kodays} ${ampm} ${hour}:mm:ss`)
    res.send(`@@@@@ ${today} 서버 ON  @@@@@ 서버오픈일자(재오픈) ${today1} @@@@@ 오픈 후 서버 접근 횟수 ${count}번 @@@@@`)
    const logToday = m.format(`YYYY:MM:DD:dddd:HH:mm:ss::${ip}::count:${count}::${logToday1}`)
    const logDb = { log: logToday }
    new logs(logDb).save()
        .then(r => console.log('LogData Save Success',r))
        .catch(err => console.log(err))
})

app.set('trust proxy', true);

server.listen(PORT, '0.0.0.0', ()=>{
    console.log('***************** ***************** *****************')
    console.log('***************** ***************** *****************')
    console.log('********** 서버가 정상적으로 실행되고 있습니다 **********')
    console.log('***************** ***************** *****************')
    console.log('***************** ***************** *****************')
})


let authToken;

io.on('connection',(socket)=>{
    console.log('Connected Success');

    socket.on(ROOM_NAME,function (data){
        console.log(data)
        socket.join(data.roomName);
        authToken = jwt.sign({roomName:data.roomName},SECRET_KEY,{expiresIn:EXPIRES_TIME})
    })


    socket.on(MESSAGE_NAME, function (data){
        console.log('Server Received Data');
        const tokenData = jwt.verify(authToken,SECRET_KEY)
        console.log(data)
        const MAC = data.MacAddress
        io.sockets.in(tokenData.roomName).to(MAC).emit(data)
    })

    socket.on(STREAMING_NAME,function (data){
        const tokenData = jwt.verify(authToken,SECRET_KEY)
        io.sockets.in(tokenData.roomName).emit(data)
    })


    socket.on('disconnect',()=>{
        console.log('User Disconnected')
    })

});


