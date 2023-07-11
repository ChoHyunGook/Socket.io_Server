const semiDate = require("../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")


const moment = require("moment-timezone");
var Client = require('mongodb').MongoClient;


const apiLogs = db.logs
const Info = db.Info
const History = db.history

let count = 0;
let awsLogsData = [];



const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const { AWS_SECRET, AWS_ACCESS, AWS_REGION, MONGO_URI,ADMIN_DB_NAME } = applyDotenv(dotenv)



const api = function (){
    return{
        //{id:xx, tel:xx}
        start_up(req,res){
            const data =req.body
            Client.connect(MONGO_URI)
                .then(dbs=>{
                    let database = dbs.db(ADMIN_DB_NAME)
                    database.collection('tables').find({id:data.id,tel:data.tel}).toArray().then(data=>{
                        if(data.length === 0){
                            res.status(400).send('해당하는 가입정보가 없습니다. 개통 완료 후 이용해주세요.')
                        }else{
                            res.status(200).send(data)
                        }
                    })
                })
        },

        // saveHistory(req,res){
        //     const data = req.body
        //
        //     const opens = moment().tz('Asia/Seoul')
        //
        //     const dbDate = new Date()
        //     dbDate.setUTCHours(0,0,0,0)
        //     const dtVar = new Date(Date.now()+7*24*3600*1000)
        //     dtVar.setUTCHours(0,0,0,0)
        //
        //     let saveData
        //     data.map(item=>{
        //         if(typeof item.fileName === 'undefined'){
        //             saveData = {
        //                 title:item.title,
        //                 body:item.message,
        //                 upKey:item.upKey,
        //                 device_id:"",
        //                 fileName:"",
        //                 date:opens.format('YYYY:MM:DD.HH:mm:ss'),
        //                 createAt:dbDate,
        //                 expiredAt:dtVar
        //             }
        //         }else{
        //             saveData = {
        //                 title:item.title,
        //                 body:item.message,
        //                 upKey:"",
        //                 device_id:item.MacAddr,
        //                 fileName:item.fileName,
        //                 date:opens.format('YYYY:MM:DD.HH:mm:ss'),
        //                 createAt:dbDate,
        //                 expiredAt:dtVar
        //             }
        //         }
        //     })
        //
        //     new History(saveData).save()
        //         .then(r=>console.log('History Save Success'))
        //         .catch(err=>console.log('History Save Fail',err))
        //
        // },

        getAWSLogs(req,res){
            console.log(req.body)
            if(awsLogsData.length === 10){
                awsLogsData.pop()
                awsLogsData.unshift(req.body)
            }else{
                awsLogsData.unshift(req.body)
            }
        },

        getAwsLogHistory(req,res){
            res.status(200).send(awsLogsData)
        },




        // startDate와 endDate는 년도-월-일자 필수
        // 이벤트 data = { startDate: 2023-06-12, endDate: 2023-06-16, event:true }
        // 디바이스 기준 data = { device_id: x, startDate: 2023-06-12, endDate: 2023-06-16, event:false }
        // 폰 기준 data = { upKey: x, startDate: 2023-06-12, endDate: 2023-06-16, event:false }

        getHistory(req, res) {
            const data = req.body
            // 아무것도 안보냈을때 전체조회
            if (Object.keys(data).length === 0) {
                History.find({}).sort({"date": -1})
                    .then(findData => {
                        res.status(200).send(findData)
                    })
            } else {
                // 시간들만 보냇을때
                if (typeof data.device_id === 'undefined' && typeof data.upKey === 'undefined') {
                    //엔드데이트만 있을때
                    if (typeof data.startDate === 'undefined') {
                        if (data.endDate.indexOf('-') === -1) {
                            res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                        } else {
                            let pushData = []
                            History.find({}).sort({"date": -1})
                                .then(findData => {
                                    const filter = data.endDate.split('-')
                                    if (Number(filter[2]) <= 9) {
                                        filter[2] = '0' + filter[2]
                                    }
                                    findData.map(e => {
                                        let end = filter.join("")
                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                        if (end >= findDate) {
                                            pushData.push(e)
                                        }
                                    })
                                    res.status(200).send(pushData)
                                })
                        }

                    } else {
                        //스타트 데이트만 있을때
                        if(typeof data.endDate === 'undefined'){
                            if (data.startDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                            } else {
                                let pushData = []
                                History.find({}).sort({"date": -1})
                                    .then(findData => {
                                        const filter = data.startDate.split('-')
                                        if (Number(filter[2]) <= 9) {
                                            filter[2] = '0' + filter[2]
                                        }
                                        findData.map(e => {
                                            let start = filter.join("")
                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                            if (start <= findDate) {
                                                pushData.push(e)
                                            }
                                        })
                                        res.status(200).send(pushData)
                                    })
                            }
                        } else{
                            //스타트, 엔드 두개만 있을때
                            if (data.startDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                            }else if (data.endDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                            }else{
                                let pushData = []
                                History.find({}).sort({"date": -1})
                                    .then(findData => {
                                        const startFilter = data.startDate.split('-')
                                        const endFilter = data.endDate.split('-')
                                        if (Number(startFilter[2]) <= 9) {
                                            startFilter[2] = '0' + startFilter[2]
                                        }
                                        if (Number(endFilter[2]) <= 9) {
                                            endFilter[2] = '0' + endFilter[2]
                                        }

                                        findData.map(e => {
                                            let start = startFilter.join("")
                                            let end = endFilter.join("")
                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                            if (end >= findDate && start <= findDate) {
                                                pushData.push(e)
                                            }
                                        })
                                        res.status(200).send(pushData)
                                    })
                            }
                        }
                    }
                } else {
                    // 업키 디바이스아이디 두개 다 있으면
                    if(typeof data.upKey !== 'undefined' && typeof data.device_id !== 'undefined'){
                        History.find({upKey: data.upKey}).sort({"date":-1})
                            .then(upKeyData=>{
                                History.find({device_id:data.device_id}).sort({"date":-1})
                                    .then(deviceData=>{
                                        let listData = {upKeyData:[], deviceIdData:[]}
                                        //업키,디바이스아이디 두개는 있고 스타트날짜, 엔드날짜 둘다 없을때
                                        if(typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined'){
                                            upKeyData.map(up=>{
                                                listData.upKeyData.push(up)
                                            })
                                            deviceData.map(device=>{
                                                listData.deviceIdData.push(device)
                                            })
                                            res.status(200).send(listData)
                                        }else{
                                            //업키,디바이스아이디 두개는 있고 엔드데이트까지 있을때
                                            if(typeof data.startDate === 'undefined'){
                                                if (data.endDate.indexOf('-') === -1) {
                                                    res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                }else{
                                                    const filter = data.endDate.split('-')

                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    upKeyData.map(up=>{
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            listData.upKeyData.push(up)
                                                        }
                                                    })
                                                    deviceData.map(device=>{
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            listData.deviceIdData.push(device)
                                                        }
                                                    })
                                                    res.status(200).send(listData)
                                                }
                                            }else{
                                                //업키,디바이스아이디 두개는 있고 스타트데이트만 있을때
                                                if(typeof data.endDate === 'undefined'){
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    }else{
                                                        const filter = data.startDate.split('-')

                                                        if (Number(filter[2]) <= 9) {
                                                            filter[2] = '0' + filter[2]
                                                        }
                                                        upKeyData.map(up=>{
                                                            let start = filter.join("")
                                                            let findDate = up.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                listData.upKeyData.push(up)
                                                            }
                                                        })
                                                        deviceData.map(device=>{
                                                            let start = filter.join("")
                                                            let findDate = device.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                listData.deviceIdData.push(device)
                                                            }
                                                        })
                                                        res.status(200).send(listData)
                                                    }
                                                }else{
                                                    //업키,디바이스아이디 두개 다 있고 스타트,엔드데이트 다 있을때
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    }else if (data.endDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                    }else{
                                                        const startFilter = data.startDate.split('-')
                                                        const endFilter = data.endDate.split('-')
                                                        if (Number(startFilter[2]) <= 9) {
                                                            startFilter[2] = '0' + startFilter[2]
                                                        }
                                                        if (Number(endFilter[2]) <= 9) {
                                                            endFilter[2] = '0' + endFilter[2]
                                                        }

                                                        upKeyData.map(up=>{
                                                            let start = startFilter.join("")
                                                            let end = endFilter.join("")
                                                            let findDate = up.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate && start <= findDate) {
                                                                listData.upKeyData.push(up)
                                                            }
                                                        })
                                                        deviceData.map(device=>{
                                                            let start = startFilter.join("")
                                                            let end = endFilter.join("")
                                                            let findDate = device.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate && start <= findDate) {
                                                                listData.deviceIdData.push(device)
                                                            }
                                                        })
                                                        res.status(200).send(listData)

                                                    }
                                                }
                                            }
                                        }
                                    })
                            })
                    }else{
                        //업키,디바이스아이디 중 업키가 없을때
                        if (typeof data.upKey === 'undefined') {
                            History.find({device_id: data.device_id}).sort({"date": -1})
                                .then(findData => {
                                    if (findData.length === 0) {
                                        res.status(200).send(`검색하신 데이터가 없습니다. 키와 밸류값을 다시 확인해주세요.
                                     \n 검색한데이터: ${JSON.stringify(data)}`)
                                    } else {
                                        let pushData = []
                                        //업키,디바이스아이디 중 업키가 없고 스타트,엔드데이트가 없을때
                                        if (typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined') {
                                            res.status(200).send(findData)
                                        } else {
                                            //업키,디바이스아이디 중 업키가 없고 엔드데이트만 있을때
                                            if (typeof data.startDate === 'undefined') {
                                                if (data.endDate.indexOf('-') === -1) {
                                                    res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                } else {
                                                    const filter = data.endDate.split('-')
                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    findData.map(e => {
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                }

                                            } else {
                                                //업키,디바이스아이디 중 업키가 없고 스타트데이트만 있을때
                                                if (typeof data.endDate === 'undefined') {
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    } else {
                                                        const filter = data.startDate.split('-')
                                                        if (Number(filter[2]) <= 9) {
                                                            filter[2] = '0' + filter[2]
                                                        }
                                                        findData.map(e => {
                                                            let start = filter.join("")
                                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                pushData.push(e)
                                                            }
                                                        })
                                                        res.status(200).send(pushData)
                                                    }

                                                } else {
                                                    //업키,디바이스아이디 중 업키가 없고 스타트,엔드데이트가 다있을때
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    } else {
                                                        if (data.endDate.indexOf('-') === -1) {
                                                            res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                        } else {
                                                            const startFilter = data.startDate.split('-')
                                                            const endFilter = data.endDate.split('-')
                                                            if (Number(startFilter[2]) <= 9) {
                                                                startFilter[2] = '0' + startFilter[2]
                                                            }
                                                            if (Number(endFilter[2]) <= 9) {
                                                                endFilter[2] = '0' + endFilter[2]
                                                            }

                                                            findData.map(e => {
                                                                let start = startFilter.join("")
                                                                let end = endFilter.join("")
                                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                                if (end >= findDate && start <= findDate) {
                                                                    pushData.push(e)
                                                                }
                                                            })
                                                            res.status(200).send(pushData)
                                                        }
                                                    }

                                                }
                                            }
                                        }
                                    }

                                })
                                .catch(err => {
                                    res.status(400).send('검색하려는 device_id로 저장된 히스토리가 없습니다.', err)
                                })
                        } else {
                            //업키,디바이스아이디 중 업키가 있을때
                            History.find({upKey: data.upKey}).sort({"date": -1})
                                .then(findData => {
                                    if (findData.length === 0) {
                                        res.status(200).send(`검색하신 데이터가 없습니다. 키와 밸류값을 다시 확인해주세요.
                                     \n 검색한데이터: ${JSON.stringify(data)}`)
                                    } else {
                                        //업키,디바이스아이디 중 업키가 있을때 스타트,엔드데이트 없을때
                                        let pushData = []
                                        if (typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined') {
                                            res.status(200).send(findData)
                                        } else {
                                            if (typeof data.startDate === 'undefined') {
                                                const filter = data.endDate.split('-')
                                                if (Number(filter[2]) <= 9) {
                                                    filter[2] = '0' + filter[2]
                                                }
                                                findData.map(e => {
                                                    let end = filter.join("")
                                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                    if (end >= findDate) {
                                                        pushData.push(e)
                                                    }
                                                })
                                                res.status(200).send(pushData)
                                            } else {
                                                //업키,디바이스아이디 중 업키가 있을때 스타트데이트만 있을때
                                                if (typeof data.endDate === 'undefined') {

                                                    const filter = data.startDate.split('-')
                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    findData.map(e => {
                                                        let start = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (start <= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                } else {
                                                    //업키,디바이스아이디 중 업키가 있을때 스타트,엔드데이트가 다 있을때
                                                    const startFilter = data.startDate.split('-')
                                                    const endFilter = data.endDate.split('-')
                                                    if (Number(startFilter[2]) <= 9) {
                                                        startFilter[2] = '0' + startFilter[2]
                                                    }
                                                    if (Number(endFilter[2]) <= 9) {
                                                        endFilter[2] = '0' + endFilter[2]
                                                    }

                                                    findData.map(e => {
                                                        let start = startFilter.join("")
                                                        let end = endFilter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate && start <= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                }
                                            }
                                        }
                                    }
                                })
                                .catch(err => {
                                    res.status(400).send('검색하려는 uuid로 저장된 히스토리가 없습니다.', err)
                                })
                        }

                    }

                }

            }

        },


        getService(req,res){
            console.log('get...')
            const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
            const today = semiDate.today()
            const connectDate = semiDate.connectDate()

            res.send(`@@@@@ ${today} 서버 ON 접속 IP: ${ip} @@@@@ 서버오픈 ${openDay} @@@@@`)
            const logDb = { log: `API::GET::${connectDate}::${ip}::${logOpenDay}::/getSign` }

            new apiLogs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error',err))
        },

        //디바이스 fileName용 Date
        deviceVideoDate(req,res){
            const opens = moment().tz('Asia/Seoul')
            const date = opens.format('YYYY_MM_DD_HH_mm_ss')
            res.status(200).send(date)
        },

        //device_id로 유저키 찾는 API
        //data = { device_id: device_id값 }
        async dynamoUserKey(req, res) {
            const data = req.body
            const client = new DynamoDB({ AWS_REGION })
            const tableData = await client.scan({
                TableName: 'DEVICE_TABLE',
                Key: {'device_id': data.device_id}
            })
            const items = tableData.Items

            let db=[];

            items.map(e=>{
                if(e.device_id.S === data.device_id){
                    db.push(e.user_key.S)
                }
            })

            if(db.length === 0){
                res.status(400).send('해당 device_id로 일치하는 값이 없습니다.')
            }else{
                res.status(200).send(db)
            }

        },



    }
}

module.exports = api