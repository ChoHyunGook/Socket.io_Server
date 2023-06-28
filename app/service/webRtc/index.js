const express = require("express")
const http = require("http");
const {initMeetingServer} = require("./meeting-server");


const WebRtc = function (){
    const app = express()

    const server = http.createServer(app);

    initMeetingServer(server);

    app.use(express.json());
    app.use("/api", require("./routes/app.routes"));

    server.listen(7000, function (){
        console.log('***************** ***************** *****************')
        console.log('********** WebRTC SERVER 가 정상적으로 실행되고 있습니다 **********')
        console.log('******************* WebRTC SERVER *******************')
        console.log('***************** ***************** *****************')
    });

}
module.exports = WebRtc