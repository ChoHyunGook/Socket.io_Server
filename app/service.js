const Date = require("../Data/date");
const db = require('../DataBase/index');

const logs = db.Logs

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
            const logDb = { log: `GET::${connectDate}::${ip}::${logOpenDay}::/getSign` }

            new logs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error',err))
        },

        postService(req,res){
            console.log('Post...SocketServerCreate...')

            const socketData = req.body.MACPORT

            const ServerName = `/socket.io/${socketData}`

            res.status(200).send(ServerName);

            const ip = req.headers['x-forwarded-for'] ||  req.connection.remoteAddress;
            const connectDate = Date.connectDate()
            const logDb = { log: `POST::${connectDate}::${ip}::${logOpenDay}::/SocketServerCreate` }

            new logs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error',err))
        },

    }
}

module.exports = service