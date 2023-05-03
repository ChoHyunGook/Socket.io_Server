const Date = require("../../Data/date");
const WsVoiceSocket = require("../router/wsVoiceSocket");
const WsVideoSocket = require("../router/wsVideoSocket");


const CreateWsSocketServer = function (Info,data,WS_URL,apiLogs,req,res,logOpenDay,userData){
    Info.find({})
        .then(mb=>{
            let i;
            let randomIndexArray=mb.map(e=>e.VOICE_PORT)
            for (i=0; i<1; i++) {
                let randomNum;
                randomNum = Math.floor(Math.random() * 1999 +3000)
                if (randomIndexArray.indexOf(randomNum) === -1) {
                    randomIndexArray.push(randomNum)
                } else {
                    i--
                }
            }

            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const connectDate = Date.connectDate()
            let voice = randomIndexArray[randomIndexArray.length -1]

            const infoData = {
                company:userData[0].company,
                contract_num:userData[0].contract_num,
                ip: ip,
                id: userData[0].id,
                name:userData[0].name,
                MAC: userData[0].device_id,
                VOICE_PORT: voice,
                VIDEO_PORT: voice+2000,
                Voice_WSAddr:`${WS_URL}:${voice}`,
                Video_WSAddr:`${WS_URL}:${voice+2000}`,
                connectDate: connectDate
            }

            const Restart = {
                reStart:'None'
            }


            const logDb = {log: `API::POST::${connectDate}::VOICE_PORT:${infoData.VOICE_PORT}::VIDEO_PORT:${infoData.VIDEO_PORT}::${ip}::${logOpenDay}::/SocketServerCreate`}


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


            WsVoiceSocket(infoData,Restart)
            WsVideoSocket(infoData,Restart)


            console.log('Socket Server Creation Completed')

            res.status(200).json({voiceAddr:infoData.Voice_WSAddr, videoAddr:infoData.Video_WSAddr});

        })
        .catch(e=>{
            console.log(e)
            res.status(400).send(e)
        })
}

module.exports = CreateWsSocketServer