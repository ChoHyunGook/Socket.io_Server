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

if(hours1<12){
    ampm1 = '오전'
    hour1 = hours1
}else {
    ampm1 = '오후'
    if(hours1 === '12'){
        hour1 = hours1
    }else if(hours1 === '13'){
        hour1 = '01'
    }else if(hours1 === '14'){
        hour1 = '02'
    }else if(hours1 === '15'){
        hour1 = '03'
    }
    else if(hours1 === '16'){
        hour1 = '04'
    }
    else if(hours1 === '17'){
        hour1 = '05'
    }
    else if(hours1 === '18'){
        hour1 = '06'
    }
    else if(hours1 === '19'){
        hour1 = '07'
    }
    else if(hours1 === '20'){
        hour1 = '08'
    }
    else if(hours1 === '21'){
        hour1 = '09'
    }
    else if(hours1 === '22'){
        hour1 = '10'
    }else if(hours1 === '23'){
        hour1 = '11'
    }
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

const Date4 = function (){
    return opens.format('YYYY:MM:DD.HH:mm')
}
const logDate = function (){
    return opens.format('YYYY-MM-DD kk:mm:ss')
}



module.exports.today = Date
module.exports.logOpenDay = Date2
module.exports.connectDate = Date3
module.exports.historyDate = Date4
module.exports.logDate = logDate
