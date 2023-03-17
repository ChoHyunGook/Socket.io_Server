const Date = require("../Data/date");
const db = require('../DataBase/index');
const socket = require('./socket')

const apiLogs = db.logs
const Info = db.Info


const openDay = Date.today()
const logOpenDay = Date.logOpenDay()


const service = function (){
    return{

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

        //api = '/socket', Data={ MAC:xxxx, IP:xxxxx, PORT:xxxxxx, MACPORT:xxxxxxx }
        //동일한 MACPORT 있을 때 Error Message = 이미 사용중인 MACPORT 입니다.
        //그외 Error = code 400 => json(err)

        postService(req,res){
            try {
                console.log('Post...SocketServerCreate...')
                const data = req.body
                if(typeof data.MAC === 'string'|| typeof data.PORT === 'string'||
                    typeof data.MACPORT === 'string' || typeof data.IP === 'string'){
                    res.status(400).send('String값 필요')
                }
                Info.findOne({MACPORT:req.body.MACPORT})
                    .then((mb)=>{
                        if(mb === null){
                            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                            const connectDate = Date.connectDate()

                            const socketData = data.MACPORT

                            const ServerName = `/socket.io/${socketData}`
                            const infoData = {
                                SERVERNAME: ServerName,
                                MAC: data.MAC,
                                IP: data.IP,
                                PORT: data.PORT,
                                MACPORT: socketData
                            }
                            const logDb = {log: `API::POST::${connectDate}::${ServerName}::${infoData.MAC}::${ip}::${logOpenDay}::/SocketServerCreate`}

                            const turnData = {
                                ip: ip,
                                SERVERNAME: ServerName,
                                MAC: data.MAC,
                                IP: data.IP,
                                PORT: data.PORT,
                                MACPORT: socketData
                            }

                            new apiLogs(logDb).save()
                                .then(r => console.log('Log data Save...'))
                                .catch(err => console.log('Log Save Error', err))

                            new Info(infoData).save()
                                .then(r => console.log('Info Data Save...'))
                                .catch(err => console.log('Info Save Error', err))


                            //소켓서버생성
                            socket().socketService(turnData)
                            console.log('Socket Server Creation Completed')
                            res.status(200).json(ServerName);

                        }else {
                            console.log('Socket Server Creation Fail...(MACPORT Duplication)')
                            res.status(400).send('사용중인 MACPORT 주소입니다.')
                        }
                    })
                    .catch(err=>{
                        res.status(400).json(err)
                })



            }catch (err){
                res.status(400).json(err)
            }
        },

    }
}

module.exports = service