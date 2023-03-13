const express =require('express')
const http =require('http')
const jwt = require('jsonwebtoken')
const socketio = require('socket.io')



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



app.get('/',(req,res)=>{
    let today = new Date()

    let year = today.getFullYear()
    let month = today.getMonth() +1
    let date = today.getDate();
    let day = today.getDay();
    let hours = today.getHours()
    let minutes = today.getMinutes();
    let seconds = today.getSeconds();

    let stringDay;
    if(day === 0){
        stringDay='일요일'
    }else if(day === 1){
        stringDay='월요일'
    }else if(day === 2){
        stringDay='화요일'
    }else if(day === 3){
        stringDay='수요일'
    }else if(day === 4){
        stringDay='목요일'
    }else if(day === 5){
        stringDay='금요일'
    }else if(day === 6){
        stringDay='토요일'
    }
    const todays = `${year}/${month}/${date} (${stringDay}) ${hours}:${minutes}:${seconds}`
    res.send(`***** ${todays} 서버 켜져있음 *****`)
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


