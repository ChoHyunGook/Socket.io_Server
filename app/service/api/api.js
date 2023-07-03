const semiDate = require("../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const aws = require('aws-sdk')


const moment = require("moment-timezone");
var Client = require('mongodb').MongoClient;


const apiLogs = db.logs
const Info = db.Info
const History = db.history



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

        saveHistory(req,res){
            const data = req.body

            console.log(data)

            const opens = moment().tz('Asia/Seoul')

            const dbDate = new Date()
            dbDate.setUTCHours(0,0,0,0)
            const dtVar = new Date(Date.now()+7*24*3600*1000)
            dtVar.setUTCHours(0,0,0,0)

            let saveData
            data.map(item=>{
                if(typeof item.fileName === 'undefined'){
                    saveData = {
                        title:item.title,
                        body:item.message,
                        upKey:item.upKey,
                        device_id:"",
                        fileName:"",
                        date:opens.format('YYYY:MM:DD.HH:mm:ss'),
                        createAt:dbDate,
                        expiredAt:dtVar
                    }
                }else{
                    saveData = {
                        title:item.title,
                        body:item.message,
                        upKey:"",
                        device_id:item.MacAddr,
                        fileName:item.fileName,
                        date:opens.format('YYYY:MM:DD.HH:mm:ss'),
                        createAt:dbDate,
                        expiredAt:dtVar
                    }
                }
            })

            new History(saveData).save()
                .then(r=>console.log('History Save Success'))
                .catch(err=>console.log('History Save Fail',err))

        },

        // startDate와 endDate는 년도-월-일자 필수
        // 이벤트 data = { startDate: 2023-06-12, endDate: 2023-06-16, event:true }
        // 디바이스 기준 data = { device_id: x, startDate: 2023-06-12, endDate: 2023-06-16, event:false }
        // 폰 기준 data = { upKey: x, startDate: 2023-06-12, endDate: 2023-06-16, event:false }

        getHistory(req,res){
            const data = req.body

                if(typeof data.upKey === 'undefined'){
                    History.find({device_id:data.device_id})
                        .then(findData=>{
                            let pushData = []
                            findData.map(e=>{
                                let start = data.startDate.split("-").join("")
                                let end = data.endDate.split("-").join("")
                                let findDate = e.date.split(".")[0].replace(/:/g,'')
                                if(end >= findDate && start <= findDate){
                                    pushData.push(e)
                                }
                            })
                            if(pushData.length === 0){
                                res.status(400).send('해당하는 날짜 구간에 저장되어있는 히스토리가 없습니다. 다시 한번 확인해주세요.')
                            }else{
                                res.status(200).send(pushData)
                            }
                        })
                        .catch(err=>{
                            res.status(400).send('검색하려는 device_id로 저장된 히스토리가 없습니다.',err)
                        })
                }else{
                    History.find({upKey:data.upKey})
                        .then(findData=>{
                            let pushData = []
                            findData.map(e=>{
                                let start = data.startDate.split("-").join("")
                                let end = data.endDate.split("-").join("")
                                let findDate = e.date.split(".")[0].replace(/:/g,'')
                                if(end >= findDate && start <= findDate){
                                    pushData.push(e)
                                }
                            })
                            if(pushData.length === 0){
                                res.status(400).send('해당하는 날짜 구간에 저장되어있는 히스토리가 없습니다. 다시 한번 확인해주세요.')
                            }else{
                                res.status(200).send(pushData)
                            }
                        })
                        .catch(err=>{
                            res.status(400).send('검색하려는 uuid로 저장된 히스토리가 없습니다.',err)
                        })
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
            const client = new DynamoDB('ap-northeast-2')
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



        quitTime(req,res){
            const time = moment().tz('Asia/Seoul')
            let h1 = Number(time.format('HH'))
            let m1 = Number(time.format('mm'))
            let s1 = Number(time.format('ss'))

            let quitTime = '19:0:0'
            let ft = '18:59:60'

            let h = Number(ft.split(':')[0])
            let m = Number(ft.split(':')[1])
            let s = Number(ft.split(':')[2])
            let qs = Number(quitTime.split(':')[2])

            let filterData

            if(s-s1 !== 0){
                if(m-m1 !== 0){
                    //0분 False, 0초 False
                    filterData = `퇴근시간: 19:00:00 \n 현재시간: ${h1}:${m1}:${s1} \n 남은시간: ${h-h1}:${m-m1}:${s-s1}`
                }else{
                    //0분 True, 0초 False
                    filterData = `퇴근시간: 19:00:00 \n 현재시간: ${h1}:${m1}:${s1} \n 남은시간: ${h-h1}:${m}:${s-s1}`
                }
            }else {
                if(m-m1 !== 0){
                    //0분 False, 0초 True
                    filterData = `퇴근시간: 19:00:00 \n 현재시간: ${h1}:${m1}:${s1} \n 남은시간: ${h-h1}:${m-m1}:${qs}`
                }else{
                    //0분 True, 0초 True
                    filterData = `퇴근시간: 19:00:00 \n 현재시간: ${h1}:${m1}:${s1} \n 남은시간: ${h-h1}:${m}:${qs}`
                }
            }

            res.status(200).send(filterData)
        },

        freeQuit(req,res){
            //+9시간
            const param = req.params.quit
            let qt = param.split(':')
            let h = Number(qt[0])+9
            let m = Number(qt[1])
            let s

            if(qt[2] === undefined){
                s=0
            }else{
                s=Number(qt[2])
            }

            const time = moment().tz('Asia/Seoul')
            let h1 = Number(time.format('HH'))
            let m1 = Number(time.format('mm'))
            let s1 = Number(time.format('ss'))

            let nh = h - 1 - h1
            let nm = m - 1 +60 - m1
            let ns = s + 60 -s1

            if(ns >= 60){
                ns = ns-60
                nm = nm+1
                if(nm>=60){
                    nm = nm-60
                    nh = nh +1
                }
            }
            if(nm>=60){
                nm = nm-60+1
                nh = nh +1
            }else{
                nm = nm+1
            }

            const startTime = `출근 시간: ${param}:${s}\n`
            const quitTime = `퇴근 시간: ${h}:${m}:${s}`
            const nowTime = `현재 시간: ${h1}:${m1}:${s1}`
            const filterTime = `퇴근 남은 시간: ${nh}:${nm}:${ns}`


            res.render('quit',{
                startTime:startTime,
                quitTime:quitTime,
                nowTime:nowTime,
                filterTime:filterTime
            })


        },



    }
}

module.exports = api