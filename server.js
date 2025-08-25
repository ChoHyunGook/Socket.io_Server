const express =require('express')
const dotenv = require('dotenv')
const morgan = require('morgan')
const ejs = require('ejs')

const ResponseService = require('./lambdas/response')
const applyDotenv = require('./lambdas/applyDotenv')
const db = require('./app/DataBase/index')
const Date = require('./app/service/Data/date')
const WebRtc = require('./app/service/webRtc/index')

const Socket = require('./app/router/socket/socket')

const Api = require('./app/router/api/api')
const Myrucell = require('./app/router/myrucell/index')
const Doorbell = require('./app/router/Doorbell/index')
const Groups = require('./app/router/groups/index')

const cookieParser = require('cookie-parser');
const cors = require('cors')



async function startServer(){
    const app = express();
    dotenv.config()
    const { MONGO_URI, DB_NAME, PORT, ADMIN_DB_NAME } = applyDotenv(dotenv)

    //post 방식 일경우 begin
    //post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식

    app.use(express.static("views"));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅
    app.set('view engine', 'ejs')
    app.set('views','./views')


    db.mongoose.set('strictQuery', false);
    db
        .mongoose
        .connect(MONGO_URI, {dbName:DB_NAME})
        .then(() => {
            console.log(' ### 몽고DB 연결 성공 ### ')
        })
        .catch(err => {
            console.log(' 몽고DB와 연결 실패', err)
            process.exit();
        });

    app.use(morgan('dev'))

    WebRtc()

    //메세지(히스토리), 비디오(레코드 테이블), 영상(s3) 3일마다 삭제 - 한국시간 00:01 기준

    app.use('/socketServer', Socket)
    app.use('/myrucell', Myrucell)
    app.use('/doorbell', Doorbell)
    app.use('/group', Groups)
    app.use('/', Api)


    app.set('trust proxy', true);

    const responseService = new ResponseService()
    app.use((err, _req, res) => {
        if(err.name == "UnauthorizedError"){
            return responseService.unauthorizedResponse(res, err.message);
        }
    });


    app.listen(PORT, '0.0.0.0', ()=>{
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
        console.log('********** 서버가 정상적으로 실행되고 있습니다 **********')
        console.log('******************* 서버오픈일자 *******************')
        console.log(`********* ${Date.today()} *********`)
        console.log('***************** ***************** *****************')
        console.log('***************** ***************** *****************')
    })



}
startServer()

const { cachedClients } = require('./app/service/ConnectMongo'); // ConnectMongo 있는 경로
process.on('SIGINT', async () => {
    const uris = Object.keys(cachedClients);
    for (const uri of uris) {
        await cachedClients[uri].close();
        console.log(`🔒 MongoClient closed for URI: ${uri}`);
    }
    process.exit(0);
});





