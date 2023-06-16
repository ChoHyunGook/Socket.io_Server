const semiDate = require("../../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const WsVoiceSocket = require("../router/wsVoiceSocket");
const WsVideoSocket = require("../router/wsVideoSocket");

const Admin_Find = require('../service/Admin_Find')
var Client = require('mongodb').MongoClient;


const apiLogs = db.logs
const Info = db.Info
const History = db.history


let Voice_Port = []
let Video_Port = []
let count;


const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const { WS_URL,MONGO_URI,ADMIN_DB_NAME } = applyDotenv(dotenv)



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
            let saveData
            if(typeof data.fileName === 'undefined'){
                saveData = {
                    title:data.title,
                    body:data.body,
                    uuid:data.uuid,
                    device_id:"",
                    fileName:"",
                    date:logOpenDay
                }
            }else{
                saveData = {
                    title:data.title,
                    body:data.body,
                    uuid:"",
                    device_id:data.device_id,
                    fileName:data.fileName,
                    date:logOpenDay
                }
            }
            new History(saveData).save()
                .then(r=>console.log('History Save Success'))
                .catch(err=>console.log('History Save Fail',err))

        },

        // startDate와 endDate는 년도-월-일자 필수
        // 디바이스 기준 data = { device_id: x, startDate: 2023-06-12, endDate: 2023-06-16 }
        // 폰 기준 data = { uuid: x, startDate: 2023-06-12, endDate: 2023-06-16 }

        getHistory(req,res){
            const data = req.body

            if(typeof data.uuid === 'undefined'){
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
                History.find({uuid:data.uuid})
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


        checkPortService(req,res){
            Info.find({})
                .then(data=>{
                    //const DevicePortData = data.map(e=>e.DEVICE_PORT)
                    const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
                    const connectDate = Date.connectDate()


                    let InfoData ={
                        PORT: data.map(e=>{
                            let dd = {
                                VIDEO_PORT: e.VIDEO_PORT,
                                VOICE_PORT: e.VOICE_PORT
                            }

                            return dd
                        }),
                        WsAddress: data.map(e=>{
                            let ad ={
                                Voice_WSAddr:e.Voice_WSAddr,
                                Video_WSAddr:e.Video_WSAddr
                            }
                            return ad
                        })

                    }


                    const logDb = { log: `API::GET::/checkPort::${connectDate}::${ip}::${logOpenDay}::/CheckPort` }

                    new apiLogs(logDb).save()
                        .then(r => console.log('Log data Save...'))
                        .catch(err => console.log('Log Save Error',err))

                    res.status(200).send(InfoData)
                    })
                .catch(e=>{
                    res.status(400).send(e)
                })

        },

        serverUpdate(req,res){
            if(count === 1){
                res.status(400).send('업데이트가 이미 완료되었습니다.')
            }else{
                const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
                Info.find({})
                    .then(info=>{

                        const today = semiDate.today()

                        const logDb = {log: `ServerUpdate::UpDateDay:${today}::UpdateIp:${ip}::/SocketServerUpdate`}

                        new apiLogs(logDb).save()
                            .then(r => console.log('Update Server Log data Save...'))
                            .catch(err => console.log('Log Save Error',err))

                        info.map(port=>{
                            const infoData = {
                                company:port.company,
                                contract_num: port.contract_num,
                                ip: ip,
                                id: port.id,
                                name: port.name,
                                MAC: port.MAC,
                                VOICE_PORT: port.VOICE_PORT,
                                VIDEO_PORT: port.VIDEO_PORT,
                                Voice_WSAddr:port.Voice_WSAddr,
                                Video_WSAddr:port.Video_WSAddr,
                                connectDate: port.connectDate
                            }
                            const Restart = {
                                reStart:'restart'
                            }

                            WsVoiceSocket(infoData,Restart)
                            WsVideoSocket(infoData,Restart)

                            Voice_Port.push(`${WS_URL}:${infoData.VOICE_PORT}`)
                            Video_Port.push(`${WS_URL}:${infoData.VIDEO_PORT}`)
                        })
                        console.log('Socket Server Update & Restart Server Completed')
                        res.status(200).json({Message:'Restart SocketServer List', Voice_Addr:Voice_Port, Video_Addr:Video_Port})
                        count=1;
                        Voice_Port=[];
                        Video_Port=[];
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }
        },



        deletePort(req,res){
            const data = req.body.PORT
            const wsModule = require('ws')

            Info.find({$or:[{VOICE_PORT:data.map(e=>e)},{VIDEO_PORT:data.map(e=>e)}]})
                .then(dataBase=>{
                    if(dataBase.length !== 0){
                        dataBase.map(item=>{
                            const wss = new wsModule(`${WS_URL}:${item.VOICE_PORT}`)
                            wss.onopen = () => {
                                wss.close()
                            }
                        })
                        res.status(200).json({wsClose:`Success`, DeleteDataBase:"Success"})
                    }else{
                        res.status(400).send('해당하는 포트번호가 없습니다.')
                    }

                })
                .catch(e=>{
                    res.status(400).send(e)
                })


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


        postService(req, res) {
            // api = '/socket', Data={ userId:xxxx, tel:xxxx }
            const data = req.body

            Admin_Find(Info,data,WS_URL,apiLogs,req,res,logOpenDay)


            //api = '/socket', Data={ MAC:xxxx, PORT:xxxxxxx }
            // try {
            //     console.log('Post...SocketServerCreate...')
            //     const data = req.body
            //
            //     if (typeof data.PORT !== "number" || typeof  data.MAC !== "string") {
            //         res.status(400).send(`소켓서버 생성 실패...
            //
            //         오류내용 : PORT 값은 Number(Int)값이며 MAC 값은 String입니다. 다시 한번 확인해주세요.
            //
            //         기입하신 타입 =>
            //         {
            //         PORT : ${typeof data.PORT},
            //         MAC : ${typeof data.MAC}
            //         }
            //
            //         올바른 예시 =>
            //         {
            //          PORT : 3000,
            //          MAC : "맥주소"
            //          }`
            //         )
            //     } else {
            //         if (data.PORT < 3000 || data.PORT > 4999) {
            //             res.status(400).send(`PORT 값은 3000~4999까지 입니다. 기입하신 PORT : ${data.PORT}`)
            //         }
            //         else {
            //                 Info.findOne({VOICE_PORT: req.body.PORT})
            //                     .then((mb) => {
            //                         if (mb === null) {
            //                             const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            //                             const connectDate = Date.connectDate()
            //
            //                             const infoData = {
            //                                 ip: ip,
            //                                 MAC: data.MAC,
            //                                 VOICE_PORT: data.PORT,
            //                                 VIDEO_PORT: data.PORT+2000,
            //                                 Voice_WSAddr:`${WS_URL}:${data.PORT}`,
            //                                 Video_WSAddr:`${WS_URL}:${data.PORT+2000}`,
            //                                 connectDate: connectDate
            //                             }
            //
            //                             const Restart = {
            //                                 reStart:'None'
            //                             }
            //
            //
            //                             const logDb = {log: `API::POST::${connectDate}::voice:${infoData.PORT}::device:${infoData.PORT}::${ip}::${logOpenDay}::/SocketServerCreate`}
            //
            //
            //                             new apiLogs(logDb).save()
            //                                 .then(r => {
            //                                     console.log('API Log data Save...')
            //                                     new Info(infoData).save()
            //                                         .then(rdata => {
            //                                             console.log('Info Data Save...')
            //
            //                                         })
            //                                         .catch(error => {
            //                                             console.log('Info Save Error', error)
            //
            //                                         })
            //                                 })
            //                                 .catch(err => {
            //                                         console.log('Log Save Error', err)
            //                                     }
            //                                 )
            //
            //
            //                             WsVoiceSocket(infoData,Restart)
            //                             WsVideoSocket(infoData,Restart)
            //
            //
            //                             console.log('Socket Server Creation Completed')
            //
            //                             res.status(200).json({voiceAddr:infoData.Voice_WSAddr, videoAddr:infoData.Video_WSAddr});
            //
            //
            //                         } else {
            //                             console.log('Socket Server Creation Fail...(Port Duplication)')
            //                             res.status(400).send('사용중인 Port 주소입니다.')
            //                         }
            //                     })
            //                     .catch(err => {
            //                         res.status(400).json(err)
            //                     })
            //
            //         }
            //
            //     }
            //
            //
            // } catch (err) {
            //     res.status(400).json(err)
            // }
        },


    }
}

module.exports = api