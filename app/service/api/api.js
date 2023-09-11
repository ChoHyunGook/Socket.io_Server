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


let count = 0;
let awsLogsData = [];


const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, DEV_DEVICE_ADMIN, DEV_APP_ADMIN, DEV_SEVER_ADMIN, DEV_CEO_ADMIN
} = applyDotenv(dotenv)


const api = function () {
    return {
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
            const logDb = {log: `API::GET::${connectDate}::${ip}::${logOpenDay}::/getSign`}

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