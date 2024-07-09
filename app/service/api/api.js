const semiDate = require("../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const history = require('./history')
const dotenv = require("dotenv");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const qs = require('qs')
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



let count = 0;
let awsLogsData = [];


const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, DEV_DEVICE_ADMIN, DEV_APP_ADMIN, DEV_SEVER_ADMIN, DEV_CEO_ADMIN,AWS_LAMBDA_SIGNUP
} = applyDotenv(dotenv)

let database;


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
                                device_id: data.device_id,
                                company: "Sunil",
                                contract_service: '주계약자',
                                id:data.user_id,
                                communication: 'O',
                                service_name:"SunilService",
                                service_start: saveTime.format('YYYY-MM-DD'),
                                service_end: "9999-12-30",
                                start_up: 'O',
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


              //데이터를 람다로 쏘면됨.


        },

        findItems(req,res){
            const data = req.body
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                            tableFind.db(ADMIN_DB_NAME).collection('tables').find({id:data.id,company:"Sunil"}).toArray()
                                .then(findData=>{

                                    res.status(200).send(findData)
                                    tableFind.close()
                                })
                                .catch(err=>{
                                    res.status(400).send(err)
                                    tableFind.close()
                                })

                })
                .catch(err=>{
                    res.status(400).send(err)
                })
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