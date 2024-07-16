const semiDate = require("../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const history = require('./history')
const dotenv = require("dotenv");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const qs = require('qs')
const jwt = require("jsonwebtoken")
const fs = require("fs")
const AWS = require("aws-sdk")



const moment = require("moment-timezone");
const axios = require("axios");
const CryptoJS = require('crypto-js')
var Client = require('mongodb').MongoClient;


const apiLogs = db.logs
const Info = db.Info
const History = db.history
const Face = db.face
const AwsLogin = db.AWSLogin





let count = 0;
let awsLogsData = [];


const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, DEV_DEVICE_ADMIN, DEV_APP_ADMIN, DEV_SEVER_ADMIN, DEV_CEO_ADMIN,AWS_LAMBDA_SIGNUP,
    AWS_TOKEN
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS

let database;

AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();


const api = function () {
    return {
    // {
    //     "device_id":{type:String, required:true},
    //     "name":{type:String,required:true},
    //     "contract_service":{type:String,required:true} => 주계약자, 부계약자,
    //     "userId":{type:String,required:true,unique:true} => 유니크 값,
    //     "addr":{type:String,required:true},
    //     "tel":{type:String,required:true},
    //     "communication":{type:Boolean,required:true},
    //     "service_name":{type:String,required:true} => A-Type,B-Type(Single),B-Type(Multi) ,
    //     "service_start":{type:String,required:true},
    //     "service_end":{type:String,required:true},
    //     "start_up":false
    // }

        // contract_num:{type:String,required:true,unique:true},
        // device_id:{type:String, required:true},
        // company:{type:String,required:true},
        // name:{type:String,required:true},
        // contract_service:{type:String,required:true},
        // id:{type:String,required:true,unique:true},
        // addr:{type:String,required:true},
        // tel:{type:String,required:true},
        // communication: {type:String,required:true},
        // service_name:{type:String,required:true},
        // service_start: {type:String,required:true},
        // service_end: {type:String,required:true},
        // start_up:{type:String,required:true},




        overseasSignup(req,res){
          const data = req.body
            const saveTime = moment().tz('Asia/Seoul')
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    database = tableFind.db(ADMIN_DB_NAME)
                    tableFind.db(ADMIN_DB_NAME).collection('tables').find({company:"Sunil"}).toArray()
                        .then(allData=>{
                            //console.log(allData)
                            let maxContractNumObj = allData
                                .filter(item => item.contract_num.startsWith('Sunil-overseas-'))
                                .reduce((max, item) => {
                                    const num = parseInt(item.contract_num.split('Sunil-overseas-')[1], 10);
                                    return (num > parseInt(max.contract_num.split('Sunil-overseas-')[1], 10)) ? item : max;
                                });
                            const maxContractNum = parseInt(maxContractNumObj.contract_num.split('Sunil-overseas-')[1], 10);
                            //user_id,user_pw,name,tel,addr(국가),company(회사)
                            let saveAwsData = {
                                user_id:data.user_id,
                                user_pw:data.user_pw,
                                name:data.name,
                                tel:data.tel,
                                addr:data.addr,
                                company: "Sunil",
                            }
                            let mongoData = {
                                name:data.name,
                                tel:data.tel,
                                addr:data.addr,
                                contract_num: `Sunil-overseas-${Number(maxContractNum)+1}`,//데이터 조회 후 +1씩증가
                                device_id: data.device_id.trim().toLowerCase(),
                                company: "Sunil",
                                contract_service: '주계약자',
                                id:data.user_id,
                                communication: 'O',
                                service_name:"SunilService",
                                service_start: saveTime.format('YYYY-MM-DD'),
                                service_end: "9999-12-30",
                                start_up: 'O',
                                user_key:null,
                            }
                            tableFind.db(ADMIN_DB_NAME).collection('tables').find({id:data.user_id}).toArray()
                                .then(findData=>{
                                    if(findData.length !== 0){
                                        res.status(400).send('Duplicate UserId')
                                        tableFind.close()
                                    }else{
                                        tableFind.db(ADMIN_DB_NAME).collection('tables').insertOne(mongoData)
                                            .then(suc=>{
                                                tableFind.db(ADMIN_DB_NAME).collection('tables').find({id:data.user_id}).toArray()
                                                    .then(sendData=>{
                                                        axios.post(AWS_LAMBDA_SIGNUP,saveAwsData)
                                                            .then(awsResponse=>{
                                                                res.status(200).json({msg:'Success Signup',checkData:sendData[0],awsResponse:awsResponse.data})
                                                                tableFind.close()
                                                            })
                                                            .catch(err=>{
                                                                res.status(400).send(err)
                                                                tableFind.close()
                                                            })

                                                    })
                                            })
                                    }
                                })


                        })
                })


        },

        saveDeivceId(req,res){
            const data = req.body
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key: data.user_key,
                            company: "Sunil"})
                        .then(findData=>{
                            const dataArray = findData.device_id.split(',')
                            if(dataArray.includes(data.device_id)){
                                res.status(200).send(`device_id:${data.device_id}- This is already saved device_id`)
                            }else{
                                tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({user_key: data.user_key,
                                    company: "Sunil"},{
                                    $set:{
                                        device_id:findData.device_id+","+data.device_id
                                    }
                                })
                                    .then(suc=>{
                                        console.log(`${findData.id}-${findData.name}-${data.device_id} saved`)
                                        res.status(200).send('success')
                                        tableFind.close()
                                    })
                            }

                        })
                })
        },



        saveUserKey(req,res){

            const data = req.body
            //데이터 유저키,아이디 등등 없을때 에러 저장 로직 추가하기
            const bodyData = data.bodyData
            const userData = data.userData

            new AwsLogin({...bodyData,id:bodyData.user_id,up_key:bodyData.upKey}).save()
                .then(suc=>{
                    console.log(suc)
                    console.log(`${bodyData.user_id} - Login-log Save Success`)
                })
                .catch(err=>{
                    console.log(err)
                    console.log(`${bodyData.user_id} - Login-log Save Fail`)
                })

            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({id:bodyData.user_id})
                        .then(findData=>{
                            if(findData.user_key === null){
                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({id:bodyData.user_id,company:"Sunil"},
                                        {$set:{
                                                user_key:userData.user_key
                                            }})
                                        .then(findsData=>{
                                            console.log(`Login-id:${bodyData.user_id}- user_key Save Success`)
                                            res.status(200).send('success')
                                            tableFind.close()
                                        })
                                        .catch(err=>{
                                            console.log(err)
                                            res.status(400).send(err)
                                            tableFind.close()
                                        })
                            }else{
                                    console.log(`Login-id:${bodyData.user_id}- This is already saved user_key`)
                                    res.status(200).send('Saved user_key')
                                tableFind.close()
                            }
                        })
                        .catch(err=>{
                            console.log(err)
                            res.status(400).send(err)
                            tableFind.close()
                        })


                })
                .catch(err=>{
                    res.status(400).send(err)
                })
        },

        testToken(req,res){
          const data = req.body
          const token = jwt.sign({user_key:data.user_key},AWS_TOKEN)
          res.status(200).send(token)
        },

        userKeyTest(req, res) {
            //let data = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+eg3kjvx9QT2bxJOvakrlZT:APA91bFS8Xa6eyDsGW6qBSdiQS--Wf9rCtfGTCijRK698r3e1YA8B6Oanlo61EvJ0PsgBTQFrJnDVyxuBagSM2A1iVxlrOWoXqPZEOxRz5WxdvgTy_p48wkUxii_okpTwKAtiGHMSFSe+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"


            //let resss = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+fl95091gTVqc1p4x6gKSUx:APA91bH_YPCkvP8acaM74RHvXc060t4-G-o3a5lmnsCeyuLPJO4Ec_oXsoBQ7zIUSzqXdIU6u5BciROxmlR3Mwo_y-dwKrL9kmRh-mzq9b3Zs8YP-MJMWdHxRjnOQ0LCVS5LLNmrntSV+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"
            // uuid가 data에 포함되어 있는지 확인

            let uuid = "PPR1.180610.011"
            let fcm = "fl95091gTVqc1p4x6gKSUx:APA91bH_YPCkvP8acaM74RHvXc060t4-G-o3a5lmnsCeyuLPJO4Ec_oXsoBQ7zIUSzqXdIU6u5BciROxmlR3Mwo_y-dwKrL9kmRh-mzq9b3Zs8YP-MJMWdHxRjnOQ0LCVS5LLNmrntSV";
            const changeData = fcm+`+${uuid}+`
            let dbData = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+eg3kjvx9QT2bxJOvakrlZT:APA91bFS8Xa6eyDsGW6qBSdiQS--Wf9rCtfGTCijRK698r3e1YA8B6Oanlo61EvJ0PsgBTQFrJnDVyxuBagSM2A1iVxlrOWoXqPZEOxRz5WxdvgTy_p48wkUxii_okpTwKAtiGHMSFSe+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"

            let fcm_token_data;


            if (dbData.includes(`+${uuid}+`)) {
                // '+'를 구분자로 데이터 분리
                let listData = dbData.split("+");
                // uuid를 포함하는 인덱스를 찾고 해당 부분 제거
                for (let i = 1; i < listData.length; i += 2) {
                    if (listData[i] === uuid) {
                        listData.splice(i - 1, 2); // fcm과 uuid 제거
                        break; // 일치하는 첫 번째 항목만 제거
                    }
                }
                // 변경된 데이터를 다시 합치기
                fcm_token_data = listData.join("+") + changeData;
            } else {
                fcm_token_data = dbData + changeData;
            }




                // uuid를 포함하는 부분을 찾기 위한 정규식
//             let uuidRegex = new RegExp(`([^+]+)${uuid}([^+]+)`, 'g');
//
// // uuid를 포함하는 부분을 찾아서 대체
//             data = data.replace(uuidRegex, `${fcm}+${uuid}$2`);
            // if (data.includes(uuid)) {
            //     data = data.replace(uuid, `${fcm}+${uuid}`);
            // } else {
            //     // uuid가 없으면 data 끝에 fcm+uuid+ 추가
            //     data += `${fcm}+${uuid}+`;
            // }
            res.status(200).send(fcm_token_data)
        },


        findAWS(req,res){
            const token = req.headers['token']

            if(token !== undefined){
                const tokenVerify = jwt.verify(token,AWS_TOKEN)
                // // 테이블 스캔 함수
                const scanTable = async (tableName, filterExpression, expressionAttributeValues) => {
                    const params = {
                        TableName: tableName,
                        FilterExpression: filterExpression,
                        ExpressionAttributeValues: expressionAttributeValues
                    };

                    try {
                        const data = await dynamoDB.scan(params).promise();
                        return data.Items;
                    } catch (error) {
                        console.error('Error scanning table:', error);
                        return [];
                    }
                };


                const tableName = 'DEVICE_TABLE'; // 조회하려는 DynamoDB 테이블 이름
                const filterExpression = 'user_key = :user_key'; // 필터 조건 (여러 조건을 추가할 수 있음)
                const expressionAttributeValues = {
                    ':user_key': tokenVerify.user_key // 필터 조건에 해당하는 값
                };

                scanTable(tableName, filterExpression, expressionAttributeValues).then(items => {
                    Client.connect(MONGO_URI)
                        .then(tableFind=> {
                            tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key:tokenVerify.user_key})
                                .then(findData=>{
                                    let check = []
                                    items.map(e=>{
                                        check.push(e.device_id)
                                    })

                                    let splitData = findData.device_id.split(',')
                                    let excludedDeviceIds = splitData.filter(id => !check.includes(id));

                                    res.status(200).json({msg:'Data query successful',
                                        unconnectDeviceId:excludedDeviceIds,
                                        openingData:findData,connectData:items})

                                })
                                .catch(err=>{
                                    res.status(400).send(err)
                                    tableFind.close()
                                })

                        })
                    // if (items.length > 0) {
                    //
                    //
                    // } else {
                    //     res.status(400).json({msg:'The data is not available.',data:undefined})
                    // }
                });
            }else{
                res.status(400).send('Header has no token value, please check again.')
            }

        },


        findLog(req,res){
            apiLogs.find({}).sort({"date":-1})
                .then(findData=>{
                    res.status(200).send(findData)
                })
        },

        b2cService(req,res){
            const data = req.body
            const params = req.query.contents
            //아이디 중복체크
            if(params === 'duplicate'){
                Client.connect(MONGO_URI)
                    .then(tableFind=> {
                        database = tableFind.db(ADMIN_DB_NAME)
                        tableFind.db(ADMIN_DB_NAME).collection('tables').find({}).toArray()
                            .then(allData=>{
                                let Duplicate = []
                                allData.map(e=>{
                                    if(data.userId === e.id){
                                        Duplicate.push(e)
                                    }
                                })
                                Duplicate.length !== 0 ? res.status(400).send('Duplicate') : res.status(200).send('Available')
                            })
                    })
            }

            //가입
            if(params === 'register'){
                Client.connect(MONGO_URI)
                    .then(tableFind=>{
                        database= tableFind.db(ADMIN_DB_NAME)
                        tableFind.db(ADMIN_DB_NAME).collection('tables').find({company:"Blaubit"}).toArray()
                            .then(userData=>{
                                let filterData=[];
                                let Duplicate;
                                userData.map(e=>{
                                    if(data.userId === e.id) {
                                        Duplicate = true
                                    }
                                    if(filterData.length !== 0){
                                        if(Number(e.contract_num.split('Blau')[1]) > Number(filterData[0].contract_num.split('Blau')[1])){
                                            filterData[0] = e
                                        }
                                    }else{
                                        filterData.push(e)
                                    }
                                })
                                if(Duplicate === true){
                                    return res.status(400).send('Duplicate UserId')
                                }else{
                                    let contract_num = `Blau${Number(filterData[0].contract_num.split('Blau')[1]) + 1}`

                                    //계약번호는 로직으로 Blau 뒤 숫자 +1(유니크값)
                                    //비투씨는 company Blaubit 고정
                                    //서비스 스타트날짜 => 오늘 날짜 자동, 엔드날짜 => 9999-12-30 고정(추후변경가능)
                                    //contract_services => 주계약자로 바로 개통
                                    //개통, 통신 => data.communication === true ? 'O':'X' data.start_up === true ? 'O':'X',

                                    // 계약번호(유니크), 회사명, 계약자구분(주계약,부계약), 통신, 개통, 서비스시작날짜, 서비스해지날짜는 자동세팅
                                    // 디바이스아이디(유니크), 이름, 아이디, 주소, 전화번호, 서비스종류 5개는 유저에게 받아야할 최소 단위

                                    const saveTime = moment().tz('Asia/Seoul')

                                    let saveData = {
                                        contract_num: contract_num,
                                        device_id: data.device_id,
                                        company: "Blaubit",
                                        name:data.name,
                                        contract_service: '주계약자',
                                        id:data.userId,
                                        addr:data.addr,
                                        tel:data.tel,
                                        communication: 'O',
                                        service_name:data.service_name,
                                        service_start: saveTime.format('YYYY-MM-DD'),
                                        service_end: "9999-12-30",
                                        start_up: 'O',
                                    }

                                    database.collection('tables').insertOne(saveData)
                                        .then(ls=>{
                                            console.log('저장완료')
                                            tableFind.close()
                                            res.status(200).send('Save Success')
                                        })
                                        .catch(err=>{
                                            console.log(err)
                                            res.status(400).send(err)
                                        })
                                }

                            })
                            .catch(err=>{
                                res.status(400).send(err)
                            })
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }



        },

        

        // param=create, bodyData = { device_id: "" ,name: "" ,phone: "" }
        // param=del, bodyData = { device_id: "" }
        // param=find, bodyData = { device_id: ""}

        face_register(req,res){
            const params = req.query.contents
            const data = req.body

            if(params === 'create'){
                Face.find({device_id:data.device_id, phone:data.phone})
                    .then(findData=>{
                        const saveTime = moment().tz('Asia/Seoul')
                        let filterData = []
                        if(findData.length >= 10){
                            res.status(400).send(`Saved Data Exceed`)
                        }else{
                            if(findData.length >= 1){
                                let duplicateState = false

                                findData.map(e=>{
                                    if(e.name === data.name){
                                       duplicateState = true
                                    }else{
                                        if(filterData.length === 0){
                                            filterData.push(e)
                                        }else{
                                            filterData.map(fd=>{
                                                if(e.index > fd.index){
                                                    filterData[0] = e
                                                }
                                            })
                                        }
                                    }
                                })

                                if(duplicateState === true){
                                    res.status(400).send('Duplicated Name')
                                }else{
                                    let savedData = {
                                        device_id: data.device_id,
                                        name:data.name,
                                        phone:data.phone,
                                        index:filterData[0].index + 1,
                                        date:saveTime.format('YYYY_MM_DD.kk:mm:ss')
                                    }
                                    new Face(savedData).save()
                                        .then(r=>res.status(200).send('Saved Data Completed'))
                                        .catch(err=>
                                        {
                                            res.status(400).send(err)
                                        })
                                }

                            }else{
                                let saveData = {
                                    device_id: data.device_id,
                                    name:data.name,
                                    phone:data.phone,
                                    index:1,
                                    date:saveTime.format('YYYY_MM_DD.kk:mm:ss')
                                }
                                new Face(saveData).save()
                                    .then(r=>res.status(200).send('Saved Data Completed'))
                                    .catch(err=> res.status(400).send(err))
                            }

                        }
                    })
                    .catch(err=>{
                            res.status(400).send(err)
                    })
            }
            if(params === 'del'){
                Face.find({device_id:data.device_id})
                    .then(findData=>{
                        if(findData.length === 0){
                            res.status(400).send('No data to delete.')
                        }else{
                            Face.deleteMany({device_id:data.device_id})
                                .then(dbs=>{
                                    res.status(200).send(`${data.device_id} deleted`)
                                })
                                .catch(err=>{
                                    res.status(400).send(err)
                                })
                        }
                    })

            }
            if(params === 'find'){
                Face.find({device_id:data.device_id}).sort({"date":-1})
                    .then(findData=>{
                        if(findData.length === 0){
                            res.status(400).send('No data to find')
                        }else{
                            res.status(200).send(findData)
                        }
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }
        },
        //{id:xx, tel:xx}
        start_up(req, res) {
            const data = req.body
            Client.connect(MONGO_URI)
                .then(dbs => {
                    let database = dbs.db(ADMIN_DB_NAME)
                    database.collection('tables').find({id: data.id, tel: data.tel}).toArray().then(data => {
                        if (data.length === 0) {
                            res.status(400).send('해당하는 가입정보가 없습니다. 개통 완료 후 이용해주세요.')
                        } else {
                            res.status(200).send(data)
                        }
                    })
                })
        },


        getAWSLogs(req, res) {
            const opens = moment().tz('Asia/Seoul')
            console.log(req.body)
            console.log(opens.format('YYYY-MM-DD_A:hh:mm:ss'))
            if (awsLogsData.length === 10) {
                awsLogsData.pop()
                awsLogsData.unshift(req.body)
            } else {
                awsLogsData.unshift(req.body)
            }
        },

        getAwsLogHistory(req, res) {
            res.status(200).send(awsLogsData)
        },

        getHistory(req, res) {
            history().historiesData(req, res)
        },

        saveHistory(req, res) {
            history().saveHistory(req, res)
        },


        getService(req, res) {
            console.log('get...')
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const today = semiDate.today()
            const connectDate = semiDate.connectDate()

            res.send(`@@@@@ ${today} 서버 ON 접속 IP: ${ip} @@@@@ 서버오픈 ${openDay} @@@@@`)
            const logDb = {log: `API::GET::${connectDate}::${ip}::${logOpenDay}::/getSign`,date:semiDate.logDate()}

            new apiLogs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error', err))
        },

        //디바이스 fileName용 Date
        deviceVideoDate(req, res) {
            const opens = moment().tz('Asia/Seoul')
            const date = opens.format('YYYY_MM_DD_HH_mm_ss')
            res.status(200).send(date)
        },

        //device_id로 유저키 찾는 API
        //data = { device_id: device_id값 }
        async dynamoUserKey(req, res) {
            const data = req.body
            const client = new DynamoDB({AWS_REGION})
            const tableData = await client.scan({
                TableName: 'DEVICE_TABLE',
                Key: {'device_id': data.device_id}
            })
            const items = tableData.Items

            let db = [];

            items.map(e => {
                if (e.device_id.S === data.device_id) {
                    db.push(e.user_key.S)
                }
            })

            if (db.length === 0) {
                res.status(400).send('해당 device_id로 일치하는 값이 없습니다.')
            } else {
                res.status(200).send(db)
            }

        },

        sendSms(req, res) {
            const phoneNumber = req.body.phone
            const phoneSubject = req.body.subject
            const date = Date.now().toString()

            //환경변수들
            const serviceId = SMS_service_id;
            const secretKey = SMS_secret_key;
            const accessKey = SMS_access_key;
            const smsPhone = SMS_PHONE;

            //그외
            const method = "POST";
            const space = " ";
            const newLine = "\n";
            const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
            const url2 = `/sms/v2/services/${serviceId}/messages`;

            //signature 작성 : crypto-js 모듈을 이용하여 암호화
            const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
            hmac.update(method);
            hmac.update(space);
            hmac.update(url2);
            hmac.update(newLine);
            hmac.update(date);
            hmac.update(newLine);
            hmac.update(accessKey);
            const hash = hmac.finalize();
            const signature = hash.toString(CryptoJS.enc.Base64);

            //인증번호 생성 및 토큰생성
            let authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");


            axios({
                method: method,
                json: true,
                url: url,
                headers: {
                    "Contenc-type": "application/json; charset=utf-8",
                    "x-ncp-iam-access-key": accessKey,
                    "x-ncp-apigw-timestamp": date
                    ,
                    "x-ncp-apigw-signature-v2": signature,
                },
                data: {
                    type: "SMS",
                    countryCode: "82",
                    from: smsPhone,
                    content: `[DoorbellSquare]\n [${phoneSubject} 서비스]\n 인증번호는 [${authNum}] 입니다.`,
                    messages: [{to: `${phoneNumber}`}],
                },
            });
            return res.status(200).json({msg: '인증번호가 전송되었습니다. 인증번호 유효시간은 3분입니다.', data: authNum})
        },


        niceApi(req, res) {

            const data = req.body

            const productCode = NICE_PRODUCT_CODE
            const client_token = NICE_ACCESS_TOKEN
            const client_id = NICE_CLIENT_ID
            const client_secret = NICE_CLIENT_SECRET
            const nowTime = new Date().getTime() / 1000


            const encoded = (text) => {
                return Buffer.from(text, "utf8").toString('base64');
            }


            //토큰이 0일때 => api사용
            if (data.token === 0) {
                const auth = `${client_token}:${nowTime}:${client_id}`
                axios({
                    url: 'https://svc.niceapi.co.kr:22001/digital/niceid/api/v1.0/common/crypto/token',
                    data: data,
                    headers: {
                        "Content-Type": 'application/json',
                        "Authorization": "Basic " + encoded(auth),
                        "client_id": client_id,
                        "ProductID": productCode
                    }

                })

            }
            //토큰이 1일때 => 토큰 새로생성
            if (data.token === 1) {
                const auth = `${client_id}:${client_secret}`

                axios.post('https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token',
                    qs.stringify({'grant_type': 'client_credentials', 'scope': 'default'}),
                    {
                        headers: {
                            "Content-Type": 'application/x-www-form-urlencoded;charset=utf-8',
                            "Authorization": "Basic " + encoded(auth)
                        }
                    }
                )
                    .then(resData => {
                        console.log('success')
                        res.status(200).send(resData.data)
                    })
                    .catch(err => {
                        console.log('fail...')
                        console.log(err)
                        res.status(400).send(err)
                    })
            }

            //토큰이 2일때 => 토큰 삭제
            if (data.token === 2) {
                const auth = `${client_token}:${nowTime}:${client_id}`

                axios({
                    method: 'post',
                    url: 'https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token/revokeById',
                    headers: {
                        "Content-Type": 'application/x-www-form-urlencoded;charset=utf-8',
                        "Authorization": "Basic " + encoded(auth)
                    }
                })
                    .then(resData => {
                        res.status(200).send(resData.data)
                    })
                    .catch(err => {
                        res.status(400).send(err)
                    })

            }


        },




    }
}

module.exports = api