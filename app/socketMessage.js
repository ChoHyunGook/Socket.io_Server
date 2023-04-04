let devicePostData=[];
let appPostData=[];

const socketMessage = function (){

    return{
        devicePostSocketMessage(message,APP_PORT){
            let data = {
                APP_PORT: APP_PORT,
                msg: message.msg
            }
            devicePostData.push(data)
        },
        appGetSocketMessage(APP_PORT){
            return (devicePostData || []).filter(e=>e.APP_PORT === APP_PORT)
        },

        devicePostDataInitialization(APP_PORT){
            devicePostData = devicePostData.filter(e=>e.APP_PORT !== APP_PORT)
        },

        appPostSocketMessage(message,DEVICE_PORT){
            let data = {
                DEVICE_PORT: DEVICE_PORT,
                msg: message.msg
            }
            appPostData.push(data)
        },

        deviceGetSocketMessage(DEVICE_PORT){
            return (appPostData || []).filter(e=>e.DEVICE_PORT === DEVICE_PORT)
        },

        appPostDataInitialization(DEVICE_PORT){
            appPostData = appPostData.filter(e=>e.DEVICE_PORT !== DEVICE_PORT)
        }
    }
}

module.exports = socketMessage


