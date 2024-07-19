const db = require("../../DataBase");

const History = db.history

// a4:da:22:11:a0:f1,a4:da:22:11:a8:4b,a4:da:22:11:9b:9c,a4:da:22:11:9c:27,a4:da:22:11:9c:df,a4:da:22:11:9d:88,a4:da:22:11:9d:9d,a4:da:22:11:9e:78

const history = function (){
    return{
        historiesData(req,res){
            const data = req.body
            let pushData = []
            let listData = {upKeyData:[], deviceIdData:[]}

            History.find({}).sort({"date": -1})
                .then(findData => {
                    // 전체조회
                    if(Object.keys(data).length === 0){
                        res.status(200).send(findData)
                    }else{
                        //시간만 조회
                        if(typeof data.device_id === 'undefined' && typeof data.upKey === 'undefined'){
                           // 엔드데이트만
                            if(data.startDate === undefined){
                                const endFilter = data.endDate.split('-')

                                if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                    endFilter[1] = '0' + endFilter[1]
                                }

                                if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                    endFilter[2] = '0' + endFilter[2]
                                }

                                findData.map(e => {
                                    let end = endFilter.join("")
                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                    if (end >= findDate ) {
                                        pushData.push(e)
                                    }
                                })
                                res.status(200).send(pushData)
                            }else{
                                //스타트 데이터만
                                if(data.endDate === undefined){
                                    const startFilter = data.startDate.split('-')

                                    if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                        startFilter[1] = '0' + startFilter[1]
                                    }

                                    if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                        startFilter[2] = '0' + startFilter[2]
                                    }


                                    findData.map(e => {
                                        let start = startFilter.join("")
                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                        if (start <= findDate) {
                                            pushData.push(e)
                                        }
                                    })
                                    res.status(200).send(pushData)

                                }else{
                                    //스타트, 엔드 데이트
                                    const startFilter = data.startDate.split('-')
                                    const endFilter = data.endDate.split('-')

                                    if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                        startFilter[1] = '0' + startFilter[1]
                                    }
                                    if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                        endFilter[1] = '0' + endFilter[1]
                                    }

                                    if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                        startFilter[2] = '0' + startFilter[2]
                                    }
                                    if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                        endFilter[2] = '0' + endFilter[2]
                                    }

                                    findData.map(e => {
                                        let start = startFilter.join("")
                                        let end = endFilter.join("")
                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                        if (end >= findDate && start <= findDate) {
                                            pushData.push(e)
                                        }
                                    })
                                    res.status(200).send(pushData)
                                }
                            }
                        }else{
                            //디바이스, 업키 기준
                            if(data.upKey === undefined){
                                //디바이스아이디
                                History.find({device_id:data.device_id}).sort({"date": -1})
                                    .then(deviceData=>{
                                        // 엔드데이트만
                                        if(data.startDate === undefined){
                                            const endFilter = data.endDate.split('-')

                                            if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                endFilter[1] = '0' + endFilter[1]
                                            }

                                            if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                endFilter[2] = '0' + endFilter[2]
                                            }

                                            deviceData.map(e => {
                                                let end = endFilter.join("")
                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                if (end >= findDate ) {
                                                    pushData.push(e)
                                                }
                                            })
                                            res.status(200).send(pushData)
                                        }else{
                                            //스타트 데이터만
                                            if(data.endDate === undefined){
                                                const startFilter = data.startDate.split('-')

                                                if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                    startFilter[1] = '0' + startFilter[1]
                                                }

                                                if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                    startFilter[2] = '0' + startFilter[2]
                                                }


                                                deviceData.map(e => {
                                                    let start = startFilter.join("")
                                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                    if (start <= findDate) {
                                                        pushData.push(e)
                                                    }
                                                })
                                                res.status(200).send(pushData)

                                            }else{
                                                //스타트, 엔드 데이트
                                                const startFilter = data.startDate.split('-')
                                                const endFilter = data.endDate.split('-')

                                                if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                    startFilter[1] = '0' + startFilter[1]
                                                }
                                                if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                    endFilter[1] = '0' + endFilter[1]
                                                }

                                                if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                    startFilter[2] = '0' + startFilter[2]
                                                }
                                                if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                    endFilter[2] = '0' + endFilter[2]
                                                }

                                                deviceData.map(e => {
                                                    let start = startFilter.join("")
                                                    let end = endFilter.join("")
                                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                    if (end >= findDate && start <= findDate) {
                                                        pushData.push(e)
                                                    }
                                                })
                                                res.status(200).send(pushData)
                                            }
                                        }
                                    })

                            }else{
                                if(data.device_id === undefined){
                                    //업키
                                    History.find({upKey:data.upKey}).sort({"date": -1})
                                        .then(phoneData=>{
                                            // 엔드데이트만
                                            if(data.startDate === undefined){
                                                const endFilter = data.endDate.split('-')

                                                if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                    endFilter[1] = '0' + endFilter[1]
                                                }

                                                if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                    endFilter[2] = '0' + endFilter[2]
                                                }

                                                phoneData.map(e => {
                                                    let end = endFilter.join("")
                                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                    if (end >= findDate ) {
                                                        pushData.push(e)
                                                    }
                                                })
                                                res.status(200).send(pushData)
                                            }else{
                                                //스타트 데이터만
                                                if(data.endDate === undefined){
                                                    const startFilter = data.startDate.split('-')

                                                    if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                        startFilter[1] = '0' + startFilter[1]
                                                    }

                                                    if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                        startFilter[2] = '0' + startFilter[2]
                                                    }


                                                    phoneData.map(e => {
                                                        let start = startFilter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (start <= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)

                                                }else{
                                                    //스타트, 엔드 데이트
                                                    const startFilter = data.startDate.split('-')
                                                    const endFilter = data.endDate.split('-')

                                                    if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                        startFilter[1] = '0' + startFilter[1]
                                                    }
                                                    if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                        endFilter[1] = '0' + endFilter[1]
                                                    }

                                                    if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                        startFilter[2] = '0' + startFilter[2]
                                                    }
                                                    if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                        endFilter[2] = '0' + endFilter[2]
                                                    }

                                                    phoneData.map(e => {
                                                        let start = startFilter.join("")
                                                        let end = endFilter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate && start <= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                }
                                            }
                                        })

                                }else{
                                    //디바이스, 업키 둘다

                                    History.find({upKey:data.upKey}).sort({"date": -1})
                                        .then(phoneData=>{
                                            History.find({device_id:data.device_id}).sort({"date": -1})
                                                .then(deviceData=>{
                                                    // 엔드데이트만
                                                    if(data.startDate === undefined){
                                                        const endFilter = data.endDate.split('-')

                                                        if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                            endFilter[1] = '0' + endFilter[1]
                                                        }

                                                        if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                            endFilter[2] = '0' + endFilter[2]
                                                        }
                                                        deviceData.map(e => {
                                                            let end = endFilter.join("")
                                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate ) {
                                                                listData.deviceIdData.push(e)
                                                            }
                                                        })

                                                        phoneData.map(e => {
                                                            let end = endFilter.join("")
                                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate ) {
                                                                listData.upKeyData.push(e)
                                                            }
                                                        })
                                                        res.status(200).send(listData)
                                                    }else{
                                                        //스타트 데이터만
                                                        if(data.endDate === undefined){
                                                            const startFilter = data.startDate.split('-')

                                                            if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                                startFilter[1] = '0' + startFilter[1]
                                                            }

                                                            if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                                startFilter[2] = '0' + startFilter[2]
                                                            }

                                                            deviceData.map(e => {
                                                                let start = startFilter.join("")
                                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                                if (start <= findDate) {
                                                                    listData.deviceIdData.push(e)
                                                                }
                                                            })


                                                            phoneData.map(e => {
                                                                let start = startFilter.join("")
                                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                                if (start <= findDate) {
                                                                    listData.upKeyData.push(e)
                                                                }
                                                            })
                                                            res.status(200).send(listData)

                                                        }else{
                                                            //스타트, 엔드 데이트
                                                            const startFilter = data.startDate.split('-')
                                                            const endFilter = data.endDate.split('-')

                                                            if (startFilter[1].length !== 2 && Number(startFilter[1]) <= 9) {
                                                                startFilter[1] = '0' + startFilter[1]
                                                            }
                                                            if (endFilter[1].length !== 2 && Number(endFilter[1]) <= 9) {
                                                                endFilter[1] = '0' + endFilter[1]
                                                            }

                                                            if (startFilter[2].length !== 2 && Number(startFilter[2]) <= 9) {
                                                                startFilter[2] = '0' + startFilter[2]
                                                            }
                                                            if (endFilter[2].length !== 2 && Number(endFilter[2]) <= 9) {
                                                                endFilter[2] = '0' + endFilter[2]
                                                            }

                                                            deviceData.map(e => {
                                                                let start = startFilter.join("")
                                                                let end = endFilter.join("")
                                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                                if (end >= findDate && start <= findDate) {
                                                                    listData.deviceIdData.push(e)
                                                                }
                                                            })

                                                            phoneData.map(e => {
                                                                let start = startFilter.join("")
                                                                let end = endFilter.join("")
                                                                let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                                if (end >= findDate && start <= findDate) {
                                                                    listData.upKeyData.push(e)
                                                                }
                                                            })
                                                            res.status(200).send(listData)
                                                        }
                                                    }
                                            })
                                        })

                                }
                            }
                        }
                    }
                })


        },


        saveHistory(req,res){
            const data = req.body

            const opens = moment().tz('Asia/Seoul')

            const dbDate = new Date()
            dbDate.setUTCHours(0,0,0,0)
            const dtVar = new Date(Date.now()+7*24*3600*1000)
            dtVar.setUTCHours(0,0,0,0)

            let saveData
            data.map(item=>{
                if(typeof item.fileName === 'undefined'){
                    saveData = {
                        title:item.title,
                        body:item.message,
                        upKey:item.upKey,
                        device_id:"",
                        fileName:"",
                        date:opens.format('YYYY:MM:DD.HH:mm:ss'),
                        createAt:dbDate,
                        expiredAt:dtVar
                    }
                }else{
                    saveData = {
                        title:item.title,
                        body:item.message,
                        upKey:"",
                        device_id:item.MacAddr,
                        fileName:item.fileName,
                        date:opens.format('YYYY:MM:DD.HH:mm:ss'),
                        createAt:dbDate,
                        expiredAt:dtVar
                    }
                }
            })

            new History(saveData).save()
                .then(r=>console.log('History Save Success'))
                .catch(err=>console.log('History Save Fail',err))

        },
    }

}

module.exports = history