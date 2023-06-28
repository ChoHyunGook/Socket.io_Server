let devicePostData=[];
let appPostData=[];

const socketRouter = function (){

    return{
        devicePostSocketMessage(message,APP_PORT){
            devicePostData.push({
                APP_PORT: APP_PORT,
                msg: message
            })
        },

        appGetSocketMessage(APP_PORT){
            return (devicePostData || []).filter(e=>e.APP_PORT === APP_PORT).map(e => e.msg).join(',')
        },

        devicePostDataInitialization(APP_PORT){
            devicePostData = devicePostData.filter(e=>e.APP_PORT !== APP_PORT)
        },

        appPostSocketMessage(message,DEVICE_PORT){
            appPostData.push({
                DEVICE_PORT: DEVICE_PORT,
                msg: message
            })
        },

        deviceGetSocketMessage(DEVICE_PORT){
            return (appPostData || []).filter(e=>e.DEVICE_PORT === DEVICE_PORT).map(e => e.msg).join(',')
        },

        appPostDataInitialization(DEVICE_PORT){
            appPostData = appPostData.filter(e=>e.DEVICE_PORT !== DEVICE_PORT)
        }
    }
}

module.exports = socketRouter


