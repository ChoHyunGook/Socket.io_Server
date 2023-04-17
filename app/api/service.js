const Date = require("../../Data/date");
const db = require('../../DataBase');
const appSocket = require('../service/appSocket');
const deviceSocket = require('../service/deviceSocket')
const applyDotenv = require("../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const WsSocket = require("../router/wsSocket");

const apiLogs = db.logs
const Info = db.Info

let appPort = []
//let devicePort = []
let count;

const openDay = Date.today()
const logOpenDay = Date.logOpenDay()

const { SOCKET_URL,WS_URL } = applyDotenv(dotenv)


const service = function (){
    return{
        checkPortService(req,res){
            Info.find({})
                .then(data=>{
                    //const DevicePortData = data.map(e=>e.DEVICE_PORT)
                    const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
                    const connectDate = Date.connectDate()
                    let InfoData ={
                        USE_PORT: data.map(e=>e.PORT),
                        WSAddress: data.map(e=>e.WSAddr)
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

                        const today = Date.today()

                        const logDb = {log: `ServerUpdate::UpDateDay:${today}::UpdateIp:${ip}::/SocketServerUpdate`}

                        new apiLogs(logDb).save()
                            .then(r => console.log('Update Server Log data Save...'))
                            .catch(err => console.log('Log Save Error',err))

                        info.map(port=>{
                            const infoData = {
                                ip: port.ip,
                                MAC: port.MAC,
                                PORT: port.PORT,
                                WSAddr: `${WS_URL}:${port.PORT}`,
                                connectDate: port.connectDate
                            }
                            const Restart = {
                                reStart:'restart'
                            }
                            // //소켓서버생성(app)
                            // appSocket(infoData,Restart)
                            // //소켓서버생성(device)
                            // deviceSocket(infoData,Restart)
                            WsSocket(infoData,Restart)

                            appPort.push(`${WS_URL}:${infoData.PORT}`)
                        })
                        console.log('Socket Server Update & Restart Server Completed')
                        res.status(200).json({Message:'Restart SocketServer List',PORT:appPort})
                        count=1;
                        appPort=[];
                        //devicePort=[];
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }
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

        //api = '/socket', Data={ MAC:xxxx, PORT:xxxxxxx }
        postService(req, res) {
            try {
                console.log('Post...SocketServerCreate...')
                const data = req.body

                if (typeof data.PORT !== "number" || typeof  data.MAC !== "string") {
                    res.status(400).send(`소켓서버 생성 실패...
        
                    오류내용 : PORT 값은 Number(Int)값이며 MAC 값은 String입니다. 다시 한번 확인해주세요. 
                    
                    기입하신 타입 =>
                    {
                    PORT : ${typeof data.PORT}, 
                    MAC : ${typeof data.MAC}
                    }
                    
                    올바른 예시 =>
                    {
                     PORT : 3000,
                     MAC : "맥주소"
                     }`
                    )
                } else {
                    if (data.PORT < 3000 || data.PORT > 5000) {
                        res.status(400).send(`PORT 값은 3000~5000까지 입니다. 기입하신 PORT : ${data.PORT}`)
                    }
                    else {
                            Info.findOne({PORT: req.body.PORT})
                                .then((mb) => {
                                    if (mb === null) {
                                        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                                        const connectDate = Date.connectDate()
                                        //const devicePort = data.PORT + 2000

                                        const infoData = {
                                            ip: ip,
                                            MAC: data.MAC,
                                            PORT: data.PORT,
                                            WSAddr:`${WS_URL}:${data.PORT}`,
                                            connectDate: connectDate
                                        }
                                        const Restart = {
                                            reStart:'None'
                                        }

                                        const logDb = {log: `API::POST::${connectDate}::app:${infoData.PORT}::device:${infoData.DEVICE_PORT}::${ip}::${logOpenDay}::/SocketServerCreate`}


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


                                        WsSocket(infoData,Restart)
                                        // //소켓서버생성(app)
                                        // appSocket(infoData,Restart)
                                        // //소켓서버생성(device)
                                        // deviceSocket(infoData,Restart)

                                        console.log('Socket Server Creation Completed')
                                        const appInfo = `${WS_URL}:${infoData.PORT}`
                                        //const deviceInfo = `${SOCKET_URL}:${infoData.DEVICE_PORT}`

                                        res.status(200).json({wsAddress:appInfo});


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


            } catch (err) {
                res.status(400).json(err)
            }
        },

    }
}

module.exports = service