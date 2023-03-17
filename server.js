const express =require('express')
const dotenv = require('dotenv')
const morgan = require('morgan')

const ResponseService = require('./lambdas/response')
const applyDotenv = require('./lambdas/applyDotenv')
const db = require('./DataBase/index')
const Service = require('./app/service')
const Date = require('./Data/date')




async function startServer(){
    const app = express();
    dotenv.config()
    const { MONGO_URI, DB_NAME, PORT } = applyDotenv(dotenv)

//post 방식 일경우 begin
//post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
    app.use(express.static('public'));
    app.use(express.urlencoded({extended: true})); // post 방식 세팅
    app.use(express.json()); // json 사용 하는 경우의 세팅



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

    app.get('/', (req,res)=>{
        Service().getService(req,res)
    })


    app.post('/socket', (req,res)=>{
        Service().postService(req,res)
    })


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





