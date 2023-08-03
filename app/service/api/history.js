const db = require("../../DataBase");

const History = db.history

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


        getHistory(req, res) {
            const data = req.body
            // 아무것도 안보냈을때 전체조회
            if (Object.keys(data).length === 0) {
                History.find({}).sort({"date": -1})
                    .then(findData => {
                        res.status(200).send(findData)
                    })
            } else {
                // 시간들만 보냇을때
                if (typeof data.device_id === 'undefined' && typeof data.upKey === 'undefined') {
                    //엔드데이트만 있을때
                    if (typeof data.startDate === 'undefined') {
                        if (data.endDate.indexOf('-') === -1) {
                            res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                        } else {
                            let pushData = []
                            History.find({}).sort({"date": -1})
                                .then(findData => {
                                    const filter = data.endDate.split('-')
                                    if (Number(filter[2]) <= 9) {
                                        filter[2] = '0' + filter[2]
                                    }
                                    findData.map(e => {
                                        let end = filter.join("")
                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                        if (end >= findDate) {
                                            pushData.push(e)
                                        }
                                    })
                                    res.status(200).send(pushData)
                                })
                        }

                    } else {
                        //스타트 데이트만 있을때
                        if(typeof data.endDate === 'undefined'){
                            if (data.startDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                            } else {
                                let pushData = []
                                History.find({}).sort({"date": -1})
                                    .then(findData => {
                                        const filter = data.startDate.split('-')
                                        if (Number(filter[2]) <= 9) {
                                            filter[2] = '0' + filter[2]
                                        }
                                        findData.map(e => {
                                            let start = filter.join("")
                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                            if (start <= findDate) {
                                                pushData.push(e)
                                            }
                                        })
                                        res.status(200).send(pushData)
                                    })
                            }
                        } else{
                            //스타트, 엔드 두개만 있을때
                            if (data.startDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                            }else if (data.endDate.indexOf('-') === -1) {
                                res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                            }else{
                                let pushData = []
                                History.find({}).sort({"date": -1})
                                    .then(findData => {
                                        const startFilter = data.startDate.split('-')
                                        const endFilter = data.endDate.split('-')
                                        if (Number(startFilter[2]) <= 9) {
                                            startFilter[2] = '0' + startFilter[2]
                                        }
                                        if (Number(endFilter[2]) <= 9) {
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
                                    })
                            }
                        }
                    }
                } else {
                    // 업키 디바이스아이디 두개 다 있으면
                    if(typeof data.upKey !== 'undefined' && typeof data.device_id !== 'undefined'){
                        History.find({upKey: data.upKey}).sort({"date":-1})
                            .then(upKeyData=>{
                                History.find({device_id:data.device_id}).sort({"date":-1})
                                    .then(deviceData=>{
                                        let listData = {upKeyData:[], deviceIdData:[]}
                                        //업키,디바이스아이디 두개는 있고 스타트날짜, 엔드날짜 둘다 없을때
                                        if(typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined'){
                                            upKeyData.map(up=>{
                                                listData.upKeyData.push(up)
                                            })
                                            deviceData.map(device=>{
                                                listData.deviceIdData.push(device)
                                            })
                                            res.status(200).send(listData)
                                        }else{
                                            //업키,디바이스아이디 두개는 있고 엔드데이트까지 있을때
                                            if(typeof data.startDate === 'undefined'){
                                                if (data.endDate.indexOf('-') === -1) {
                                                    res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                }else{
                                                    const filter = data.endDate.split('-')

                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    upKeyData.map(up=>{
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            listData.upKeyData.push(up)
                                                        }
                                                    })
                                                    deviceData.map(device=>{
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            listData.deviceIdData.push(device)
                                                        }
                                                    })
                                                    res.status(200).send(listData)
                                                }
                                            }else{
                                                //업키,디바이스아이디 두개는 있고 스타트데이트만 있을때
                                                if(typeof data.endDate === 'undefined'){
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    }else{
                                                        const filter = data.startDate.split('-')

                                                        if (Number(filter[2]) <= 9) {
                                                            filter[2] = '0' + filter[2]
                                                        }
                                                        upKeyData.map(up=>{
                                                            let start = filter.join("")
                                                            let findDate = up.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                listData.upKeyData.push(up)
                                                            }
                                                        })
                                                        deviceData.map(device=>{
                                                            let start = filter.join("")
                                                            let findDate = device.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                listData.deviceIdData.push(device)
                                                            }
                                                        })
                                                        res.status(200).send(listData)
                                                    }
                                                }else{
                                                    //업키,디바이스아이디 두개 다 있고 스타트,엔드데이트 다 있을때
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    }else if (data.endDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                    }else{
                                                        const startFilter = data.startDate.split('-')
                                                        const endFilter = data.endDate.split('-')
                                                        if (Number(startFilter[2]) <= 9) {
                                                            startFilter[2] = '0' + startFilter[2]
                                                        }
                                                        if (Number(endFilter[2]) <= 9) {
                                                            endFilter[2] = '0' + endFilter[2]
                                                        }

                                                        upKeyData.map(up=>{
                                                            let start = startFilter.join("")
                                                            let end = endFilter.join("")
                                                            let findDate = up.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate && start <= findDate) {
                                                                listData.upKeyData.push(up)
                                                            }
                                                        })
                                                        deviceData.map(device=>{
                                                            let start = startFilter.join("")
                                                            let end = endFilter.join("")
                                                            let findDate = device.date.split(".")[0].replace(/:/g, '')
                                                            if (end >= findDate && start <= findDate) {
                                                                listData.deviceIdData.push(device)
                                                            }
                                                        })
                                                        res.status(200).send(listData)

                                                    }
                                                }
                                            }
                                        }
                                    })
                            })
                    }else{
                        //업키,디바이스아이디 중 업키가 없을때
                        if (typeof data.upKey === 'undefined') {
                            History.find({device_id: data.device_id}).sort({"date": -1})
                                .then(findData => {
                                    if (findData.length === 0) {
                                        res.status(200).send(`검색하신 데이터가 없습니다. 키와 밸류값을 다시 확인해주세요.
                                     \n 검색한데이터: ${JSON.stringify(data)}`)
                                    } else {
                                        let pushData = []
                                        //업키,디바이스아이디 중 업키가 없고 스타트,엔드데이트가 없을때
                                        if (typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined') {
                                            res.status(200).send(findData)
                                        } else {
                                            //업키,디바이스아이디 중 업키가 없고 엔드데이트만 있을때
                                            if (typeof data.startDate === 'undefined') {
                                                if (data.endDate.indexOf('-') === -1) {
                                                    res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                } else {
                                                    const filter = data.endDate.split('-')
                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    findData.map(e => {
                                                        let end = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (end >= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                }

                                            } else {
                                                //업키,디바이스아이디 중 업키가 없고 스타트데이트만 있을때
                                                if (typeof data.endDate === 'undefined') {
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    } else {
                                                        const filter = data.startDate.split('-')
                                                        if (Number(filter[2]) <= 9) {
                                                            filter[2] = '0' + filter[2]
                                                        }
                                                        findData.map(e => {
                                                            let start = filter.join("")
                                                            let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                            if (start <= findDate) {
                                                                pushData.push(e)
                                                            }
                                                        })
                                                        res.status(200).send(pushData)
                                                    }

                                                } else {
                                                    //업키,디바이스아이디 중 업키가 없고 스타트,엔드데이트가 다있을때
                                                    if (data.startDate.indexOf('-') === -1) {
                                                        res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.startDate}`)
                                                    } else {
                                                        if (data.endDate.indexOf('-') === -1) {
                                                            res.status(200).send(`날짜를 정확하게 기입해 주세요 \n 기입하신 날짜: ${data.endDate}`)
                                                        } else {
                                                            const startFilter = data.startDate.split('-')
                                                            const endFilter = data.endDate.split('-')
                                                            if (Number(startFilter[2]) <= 9) {
                                                                startFilter[2] = '0' + startFilter[2]
                                                            }
                                                            if (Number(endFilter[2]) <= 9) {
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

                                                }
                                            }
                                        }
                                    }

                                })
                                .catch(err => {
                                    res.status(400).send('검색하려는 device_id로 저장된 히스토리가 없습니다.', err)
                                })
                        } else {
                            //업키,디바이스아이디 중 업키가 있을때
                            History.find({upKey: data.upKey}).sort({"date": -1})
                                .then(findData => {
                                    if (findData.length === 0) {
                                        res.status(200).send(`검색하신 데이터가 없습니다. 키와 밸류값을 다시 확인해주세요.
                                     \n 검색한데이터: ${JSON.stringify(data)}`)
                                    } else {
                                        //업키,디바이스아이디 중 업키가 있을때 스타트,엔드데이트 없을때
                                        let pushData = []
                                        if (typeof data.startDate === 'undefined' && typeof data.endDate === 'undefined') {
                                            res.status(200).send(findData)
                                        } else {
                                            if (typeof data.startDate === 'undefined') {
                                                const filter = data.endDate.split('-')
                                                if (Number(filter[2]) <= 9) {
                                                    filter[2] = '0' + filter[2]
                                                }
                                                findData.map(e => {
                                                    let end = filter.join("")
                                                    let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                    if (end >= findDate) {
                                                        pushData.push(e)
                                                    }
                                                })
                                                res.status(200).send(pushData)
                                            } else {
                                                //업키,디바이스아이디 중 업키가 있을때 스타트데이트만 있을때
                                                if (typeof data.endDate === 'undefined') {

                                                    const filter = data.startDate.split('-')
                                                    if (Number(filter[2]) <= 9) {
                                                        filter[2] = '0' + filter[2]
                                                    }
                                                    findData.map(e => {
                                                        let start = filter.join("")
                                                        let findDate = e.date.split(".")[0].replace(/:/g, '')
                                                        if (start <= findDate) {
                                                            pushData.push(e)
                                                        }
                                                    })
                                                    res.status(200).send(pushData)
                                                } else {
                                                    //업키,디바이스아이디 중 업키가 있을때 스타트,엔드데이트가 다 있을때
                                                    const startFilter = data.startDate.split('-')
                                                    const endFilter = data.endDate.split('-')
                                                    if (Number(startFilter[2]) <= 9) {
                                                        startFilter[2] = '0' + startFilter[2]
                                                    }
                                                    if (Number(endFilter[2]) <= 9) {
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
                                        }
                                    }
                                })
                                .catch(err => {
                                    res.status(400).send('검색하려는 uuid로 저장된 히스토리가 없습니다.', err)
                                })
                        }

                    }

                }

            }

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