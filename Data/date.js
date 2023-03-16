const moment = require('moment-timezone')

const opens = moment().tz('Asia/Seoul')
const days1 = opens.format('dddd')
const hours1 = opens.format('HH')
let kodays1;
let ampm1;
let hour1;

switch (days1){
    case 'Sunday':
        kodays1='일요일'
        break;
    case 'Monday':
        kodays1='월요일'
        break;
    case 'Tuesday':
        kodays1='화요일'
        break;
    case 'Wednesday':
        kodays1='수요일'
        break;
    case 'Thursday':
        kodays1='목요일'
        break;
    case 'Friday':
        kodays1='금요일'
        break;
    case 'Saturday':
        kodays1='토요일'
        break;
}

if(hours1<=12){
    ampm1 = '오전'
    hour1 = hours1
}else{
    ampm1 = '오후'
    hour1 = hours1-12
}

const Date = function (){
    return opens.format(`YYYY년 MM월 DD일 ${kodays1} ${ampm1} ${hour1}:mm:ss`)
}

const Date2 = function (){
    return opens.format('YYYY:MM:DD.HH:mm:ss')
}
const Date3 = function (){
    return opens.format('YYYY:MM:DD:dddd:HH:mm:ss')
}


module.exports.today = Date
module.exports.logOpenDay = Date2
module.exports.connectDate = Date3
