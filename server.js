const express =require('express')
const dotenv = require('dotenv')
const http =require('http')
const socketio = require('socket.io')
const db = require('./DataBase/index')
const Service = require('./app/service')
const Date = require('./Data/date')
const applyDotenv = require('./lambdas/applyDotenv')


const app = express();
const server = http.createServer(app);
dotenv.config()
const { MONGO_URI, DB_NAME, PORT, MESSAGE_NAME } = applyDotenv(dotenv)


app.set('trust proxy',true)


db.mongoose.set('strictQuery', false);
db
    .mongoose
    .connect(MONGO_URI,{dbName:DB_NAME})
    .then(() => {
        console.log(' ### 몽고DB 연결 성공 ### ')
    })
    .catch(err => {
        console.log(' 몽고DB와 연결 실패', err)
        process.exit();
    });



app.set('trust proxy', true);
server.listen(PORT, '0.0.0.0', ()=>{
    console.log('***************** ***************** *****************')
    console.log('***************** ***************** *****************')
    console.log('********** 서버가 정상적으로 실행되고 있습니다 **********')
    console.log('******************* 서버오픈일자 *******************')
    console.log(`********* ${Date.today()} *********`)
    console.log('***************** ***************** *****************')
    console.log('***************** ***************** *****************')
})

app.get('/',(req,res)=>{
    Service().getService(req,res)
})

let ServerName;

//데이터 구조 = { MACPORT: XXXXXXX }
app.post('/socket',(req,res)=>{
    const data = req.body.MACPORT
    ServerName = `/socket.io/${data}`
    Service().postService(req,res)
})


const io = socketio(server,{path:ServerName})


io.on('connection', (socket)=>{
    //서버 내에서 커넥된지 로그확인
    console.log(`Socket Connected Success`);
    // 앱, 디바이스로 커넥됫다고 메세지송신
    io.emit('Connected Success')

    socket.on(MESSAGE_NAME, function (data){
        console.log('Server Received Data');
        console.log(data)
        io.broadcast.emit(data)
    })

    socket.on('disconnect',()=>{
        console.log('User Disconnected')
    })

});


