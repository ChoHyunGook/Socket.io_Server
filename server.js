const express =require('express')
const http =require('http')
const jwt = require('jsonwebtoken')
const socketio = require('socket.io')
const moment = require('moment-timezone')




const app = express();
const server = http.createServer(app);
const io = socketio(server)
require('dotenv').config()

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


app.get('/',(req,res)=>{
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
    res.send(`@@@@@ 서버오픈(재오픈) ${today1} @@@@@ ${today} 서버 켜져있음... @@@@@ 오픈 후 서버 접근 횟수 ${count}번 @@@@@ `)

})



server.listen(PORT, ()=>{
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


