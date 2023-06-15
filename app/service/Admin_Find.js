const applyDotenv = require("../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const CreateSocketServer = require("./createWsSocketServer")
var Client = require('mongodb').MongoClient;

let dataBase;
const Admin_Find = function (Info,data,WS_URL,apiLogs,req,res,logOpenDay){

    const { MONGO_URI, ADMIN_DB_NAME } = applyDotenv(dotenv)

    Client.connect(MONGO_URI)
        .then(dbs=>{
            dataBase = dbs.db(ADMIN_DB_NAME)
            dataBase.collection('tables').find({}).toArray().then(datas=>{
                const userData = datas.filter(el=>el.id === data.userId).filter(el=>el.tel === data.tel)
                if(userData.length === 0){
                    res.status(400).send('개통되어 있는 아이디 또는 전화번호가 없습니다. 다시 한번 확인해주세요')
                }else{
                    CreateSocketServer(Info,data,WS_URL,apiLogs,req,res,logOpenDay,userData)
                }


                // const checkId = datas.some(x1=>data.userId == x1.id)
                // const checkPhone = datas.some(x1=>data.tel == x1.tel)
                // if(checkId === true){
                //     if(checkPhone === true){
                //
                //
                //     }else{
                //         res.status(400).send('전화번호가 일치')
                //     }
                // }else {
                //     res.status(400).send('개통되어 있는 아이디가 없습니다.')
                // }

            })
        })












}

module.exports = Admin_Find