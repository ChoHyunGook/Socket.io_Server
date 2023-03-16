const express =require('express')
const dotenv = require('dotenv')
const db = require('./DataBase/index')
const Service = require('./app/service')
const Date = require('./Data/date')
const applyDotenv = require('./lambdas/applyDotenv')

const app = express();
dotenv.config()
const { MONGO_URI, DB_NAME, PORT } = applyDotenv(dotenv)

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
app.listen(PORT, '0.0.0.0', ()=>{
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


app.post('/socket',(req,res)=>{
    Service().postService(req,res)
})




