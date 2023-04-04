const Date = require("../../Data/date");
const db = require('../../DataBase');
const appSocket = require('../service/appSocket');
const deviceSocket = require('../service/deviceSocket')
const applyDotenv = require("../../lambdas/applyDotenv");
const dotenv = require("dotenv");

const apiLogs = db.logs
const Info = db.Info


const openDay = Date.today()
const logOpenDay = Date.logOpenDay()

const { SOCKET_URL } = applyDotenv(dotenv)


const service = function (){
    return{
        checkPortService(req,res){
            Info.find({})
                .then(data=>{
                    const AppPortData= data.map(e=>e.APP_PORT)
                    const DevicePortData = data.map(e=>e.DEVICE_PORT)
                    let InfoData ={
                        APP_PORT: AppPortData,
                        DEVICE_PORT: DevicePortData
                    }
                    res.status(200).send(InfoData)
                    })
                .catch(e=>{
                    res.status(400).send(e)
                })

        },

        getService(req,res){
            console.log('get...')
            const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
            const today = Date.today()
            const connectDate = Date.connectDate()

            res.send(`@@@@@ ${today} 서버 ON 접속 IP: ${ip} @@@@@ 서버오픈 ${openDay} @@@@@`)
            const logDb = { log: `API::GET::${connectDate}::${ip}::${logOpenDay}::/getSign` }

            new apiLogs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error',err))
        },

        //api = '/socket', Data={ MAC:xxxx, IP:xxxxx, PORT:xxxxxx, APP_PORT:xxxxxxx }
        postService(req, res) {
            try {
                console.log('Post...SocketServerCreate...')
                const data = req.body


                if (typeof data.APP_PORT !== "number" || typeof  data.MAC !== "string" || typeof data.IP !== "string" || typeof data.PORT !== "string") {
                    res.status(400).send(`소켓서버 생성 실패...
        
                    오류내용 : APP_PORT 값은 Number(Int)값이며 MAC,IP,PORT의 값은 String입니다. 다시 한번 확인해주세요. 
                    
                    기입하신 타입 =>
                    {
                    APP_PORT : ${typeof data.APP_PORT}, 
                    MAC : ${typeof data.MAC}, 
                    IP : ${typeof data.IP}, 
                    PORT : ${typeof data.PORT} 
                    }
                    
                    올바른 예시 =>
                    {
                     APP_PORT : 3000
                     MAC : "맥주소",
                     IP : "아이피주소",
                     PORT : "포트번호",
                     }`
                    )
                } else {
                    if (data.APP_PORT < 3000) {
                        res.status(400).send(`APP_PORT 앱의 포트 값은 3000~4999까지 입니다. 기입하신 APP_PORT : ${data.APP_PORT}`)
                    } else {
                        if (data.APP_PORT > 4999) {
                            res.status(400).send(`APP_PORT 앱의 포트 값은 3000~4999까지 입니다. 기입하신 APP_PORT : ${data.APP_PORT}`)
                        } else {
                            Info.findOne({APP_PORT: req.body.APP_PORT})
                                .then((mb) => {
                                    if (mb === null) {
                                        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                                        const connectDate = Date.connectDate()
                                        const devicePort = data.APP_PORT + 2000

                                        const infoData = {
                                            ip: ip,
                                            MAC: data.MAC,
                                            IP: data.IP,
                                            PORT: data.PORT,
                                            APP_PORT: data.APP_PORT,
                                            DEVICE_PORT: devicePort,
                                            connectDate: connectDate
                                        }

                                        const logDb = {log: `API::POST::${connectDate}::app:${infoData.APP_PORT}::device:${infoData.DEVICE_PORT}::${ip}::${logOpenDay}::/SocketServerCreate`}


                                        new apiLogs(logDb).save()
                                            .then(r => {
                                                console.log('API Log data Save...')
                                                new Info(infoData).save()
                                                    .then(rdata => {
                                                        console.log('Info Data Save...')

                                                    })
                                                    .catch(error => {
                                                        console.log('Info Save Error', error)

                                                    })
                                            })
                                            .catch(err => {
                                                    console.log('Log Save Error', err)
                                                }
                                            )

                                        //소켓서버생성(app)
                                        appSocket(infoData)
                                        //소켓서버생성(device)
                                        deviceSocket(infoData)

                                        console.log('Socket Server Creation Completed')
                                        const appInfo = `${SOCKET_URL}:${infoData.APP_PORT}`
                                        const deviceInfo = `${SOCKET_URL}:${infoData.DEVICE_PORT}`

                                        res.status(200).json({app: appInfo, device: deviceInfo});


                                    } else {
                                        console.log('Socket Server Creation Fail...(Port Duplication)')
                                        res.status(400).send('사용중인 Port 주소입니다.')
                                    }
                                })
                                .catch(err => {
                                    res.status(400).json(err)
                                })
                        }
                    }


                }


            } catch (err) {
                res.status(400).json(err)
            }
        },

    }
}

module.exports = service