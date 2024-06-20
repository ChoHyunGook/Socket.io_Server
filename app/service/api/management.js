const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../../DataBase");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, DEV_DEVICE_ADMIN, DEV_APP_ADMIN,
    DEV_SEVER_ADMIN, DEV_CEO_ADMIN,DEV_FRONT_ADMIN
} = applyDotenv(dotenv)

const Version = db.version

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS
const Bucket_name = AWS_BUCKET_NAME

const s3 = new AWS.S3({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});



const management = function () {
    return{
        async fileManagement(req, res) {
            const devAdmin = req.query.dev
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const ClientId = AWS_SECRET
            const ClientSecret = AWS_ACCESS
            const Bucket_name = AWS_BUCKET_NAME

            const s3 = new AWS.S3({
                accessKeyId: ClientId,
                secretAccessKey: ClientSecret,
                region: AWS_REGION
            });

            if (devAdmin !== DEV_CEO_ADMIN && devAdmin !== DEV_SEVER_ADMIN && devAdmin !== DEV_APP_ADMIN &&
                devAdmin !== DEV_DEVICE_ADMIN && devAdmin !== DEV_FRONT_ADMIN) {
                const date = moment().tz('Asia/Seoul')
                let data = {
                    access_id:'Disconnect',
                    access_name:'Unknown',
                    department:'Check the Ip Address',
                    ip:ip,
                    contents:`Someone unknown tried to approach.`,
                    date:date.format('YYYY-MM-DD HH:mm:ss')
                }
                new Version(data).save()
                    .then(r => console.log('Version Login Fail History Save Success'))
                    .catch(err => console.log('Version Login Fail History Save Fail', err))

                res.render('dangerous')
            } else {
                const date = moment().tz('Asia/Seoul')
                const name = devAdmin.split('.')[3] === 'ChoHG' ? '조현국' : devAdmin.split('.')[3] === 'NamDH' ? '남대현' :
                    devAdmin.split('.')[3] === 'KimSY' ? '김수영' : devAdmin.split('.')[3] === 'SeoSM' ? '서성민':'김의선'

                let data = {
                    access_id: devAdmin.split('.')[4] + '.' + devAdmin.split('.')[5] + '.' + devAdmin.split('.')[6],
                    access_name: name,
                    department: devAdmin.split('.')[1],
                    ip:ip,
                    contents: `Login.${devAdmin.split('.')[1]}.${devAdmin.split('.')[3]}.${devAdmin.split('.')[4].split('@')[0]}`,
                    date: date.format('YYYY-MM-DD HH:mm:ss')
                }
                new Version(data).save()
                    .then(r => console.log('Version Login History Save Success'))
                    .catch(err => console.log('Version Login History Save Fail', err))

                await s3.listObjects({Bucket: Bucket_name}).promise().then((list) => {
                    const contents = list.Contents
                    let deviceData = []
                    let appData = []
                    let serverData = []
                    let documentData = []

                    contents.map(e => {
                        if(e.Key.split('/')[0]==='server'){
                            if(e.Key.split('/')[1] === 'documents'){
                                let keyData = {
                                    key:e.Key
                                }
                                documentData.push(keyData)
                            }else{
                                let keyData = {
                                    key:e.Key
                                }
                                serverData.push(keyData)
                            }
                            //console.log(serverData)
                        }

                        if(e.Key.split('/')[0]==='device'){
                            let keyData = {
                                key:e.Key
                            }
                            deviceData.push(keyData)
                        }
                        if(e.Key.split('/')[0]==='app'){
                            let keyData = {
                                key:e.Key
                            }
                            appData.push(keyData)
                        }
                    })

                    Version.find({}).sort({"date":-1})
                        .then(findData=>{
                            let uploadData = []
                            let count = 0
                            findData.map(e=>{
                                if(e.contents.split('.')[0] === 'Upload'){
                                    uploadData.push(e)
                                }
                            })
                            res.render('index', {
                                data: data,
                                deviceData:deviceData.reverse(),
                                appData:appData.reverse(),
                                serverData:serverData.reverse(),
                                documentData:documentData.reverse(),
                                uploadData:uploadData
                            })
                        })


                })


            }
        },




        searchTable(req,res){
            const bodyData = req.body
            const loginData =JSON.parse(bodyData.data)
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            const department = bodyData.department
            const contents = bodyData.contents
            let sendData=[]
            if(department === 'none' && contents === '===== 선택 ====='){
                Version.find({}).sort({"date":-1})
                    .then(findData=>{
                        res.render('table',{data:loginData,param:param,findData:findData})
                    })
            }
            else if(department === 'none' || contents === '===== 선택 ====='){
                let error = {
                    message:`선택사항을 선택 후 클릭 해주세요. 선택 : ${department}, ${contents}`
                }
                res.render('tableError',{error:error,data:loginData})

            }else{
                if(department === 'Connect'){
                    //접속실패
                    Version.find({department:'Check the Ip Address',access_name:'Unknown',access_id:'Disconnect'}).sort({"date":-1})
                        .then(findData=>{
                            res.render('table',{data:loginData,param:param,findData:findData})
                        })
                }
                else if(department === 'All' && contents === 'All'){
                    Version.find({}).sort({"date":-1})
                        .then(findData=>{
                            res.render('table',{data:loginData,param:param,findData:findData})
                        })
                }
                else if(department === 'All'){
                    Version.find({}).sort({"date":-1})
                        .then(findData=>{
                            findData.map(e=>{
                                if(e.contents.split('.')[0] === contents){
                                    sendData.push(e)
                                }
                            })
                            res.render('table',{data:loginData,param:param,findData:sendData})
                        })
                }else{
                    if(contents === 'All'){
                        Version.find({department:department}).sort({"date":-1})
                            .then(findData=>{
                                res.render('table',{data:loginData, param:param, findData:findData})
                            })
                    }else{
                        Version.find({department:department}).sort({"date":-1})
                            .then(findData=>{
                                findData.map(e=>{
                                    if(e.contents.split('.')[0] === contents){
                                        sendData.push(e)
                                    }
                                })
                                res.render('table',{data:loginData, param:param, findData:sendData})
                            })
                    }

                }
            }
        },
        deleteLog(req,res){
            const bodyData = req.body
            const loginData =JSON.parse(bodyData.data)
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }

            Version.deleteMany({department:bodyData.department,date:bodyData.time})
                .then(data=>{
                    Version.find({}).sort({"date":-1})
                        .then(findCeo=>{
                            res.render('table',{data:loginData,param:param,findData:findCeo})
                        })
                })
                .catch(err=>{
                    let error = {
                        message:`데이터 로그 삭제 에러... 에러내용 : ${err}`
                    }
                    res.render('error',{error:error,param:param,data:loginData})
                })
        },

        documentsDownload(req,res){
            const bodyData =req.body
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const loginData = JSON.parse(bodyData.data)
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            if(bodyData.documents === '문서 선택' || bodyData.documents === 'none' || bodyData.docCheck === 'none'){
                let error = {
                    message:`선택사항을 선택 후 클릭 해주세요. 선택 : ${bodyData.documents}`
                }
                res.render('error',{error:error,param:param,data:loginData})
            }else{
                const params = {
                    Bucket: Bucket_name,
                    Key: 'server/documents/'+bodyData.documents
                }
                s3.getObject(params, function (err, data) {
                    if(err){
                        let error = {
                            message:`데이터 다운로드 전 조회 에러... 에러내용 : ${err}`
                        }
                        res.render('error',{error:error,param:param,data:loginData})
                    }else{
                        const date = moment().tz('Asia/Seoul')
                        let versionData = {
                            access_id: loginData.access_id,
                            access_name: loginData.access_name,
                            department: loginData.department,
                            ip:ip,
                            contents: `Download.${bodyData.documents}`,
                            date: date.format('YYYY-MM-DD HH:mm:ss')
                        }
                        new Version(versionData).save()
                            .then(r => console.log('Version Download History Save Success'))
                            .catch(err => console.log('Version Download History Save Fail', err))

                        if(bodyData.documents.split('.')[2] === 'pdf'){
                            res.writeHead(200,
                                {
                                    'Content-Type': `application/pdf`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${bodyData.documents}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))
                        }else{
                            res.writeHead(200,
                                {
                                    'Content-Type': `application/vnd.ms-powerpoint`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${bodyData.documents}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))
                        }

                    }
                })
            }
        },


        versionLogFind(req,res){
            const bodyData = req.body
            const loginData = JSON.parse(bodyData.data)
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            Version.find({}).sort({"date": -1})
                .then(all=>{
                    res.render('table',{data:loginData,param:param,findData:all})
                })
                .catch(err=>{
                    let error = {
                        message:`조회실패 에러내용: ${err}`
                    }
                    res.render('error',{error:error,param:param,data:loginData})
                })

        },

        departmentVersionDelete(req,res){
            const bodyData = req.body
            const loginData = JSON.parse(bodyData.data)
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            if(bodyData.allCheck === '=== 선택 ===' || bodyData.devSelect === '=== 선택 ===' || bodyData.versionSelect === '=== 선택 ===' ||
                bodyData.allCheck === 'none' || bodyData.devSelect === '개발 선택' || bodyData.versionSelect === '버전 선택'){
                let error = {
                    message:`선택사항을 모두 선택해 주세요. 선택 : ${bodyData.allCheck}, 개발 선택 : ${bodyData.devSelect}, 버전 선택 : ${bodyData.versionSelect} `
                }
                res.render('error',{error:error,param:param,data:loginData})
            }else{
                const devVersion = bodyData.allCheck === 'Server' ? 'server' : bodyData.allCheck === 'App' ? 'app' : 'device'
                const params = {
                    Bucket: Bucket_name,
                    Key: devVersion+'/'+bodyData.devSelect+'/'+bodyData.versionSelect
                }
                s3.deleteObject(params,function (err,data){
                    if(err){
                        let error = {
                            message:`데이터 삭제 에러... 에러내용 : ${err}`
                        }
                        res.render('error',{error:error,param:param,data:loginData})
                    }else{
                        const date = moment().tz('Asia/Seoul')
                        let versionData = {
                            access_id: loginData.access_id,
                            access_name: loginData.access_name,
                            department: loginData.department,
                            ip:ip,
                            contents: `Delete.${bodyData.versionSelect}`,
                            date: date.format('YYYY-MM-DD HH:mm:ss')
                        }
                        new Version(versionData).save()
                            .then(r => console.log('Version Delete History Save Success'))
                            .catch(err => console.log('Version Delete History Save Fail', err))
                        res.render('delete',{data:loginData,param:param,fileName:bodyData.versionSelect})
                    }
                })
            }
        },

        async departVersionDownload(req, res) {
            const bodyData = req.body
            const loginData = JSON.parse(bodyData.data)
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            if(bodyData.allCheck === '=== 선택 ===' || bodyData.devSelect === '=== 선택 ===' || bodyData.versionSelect === '=== 선택 ===' ||
                bodyData.allCheck === 'none' || bodyData.devSelect === '개발 선택' || bodyData.versionSelect === '버전 선택'){
                let error = {
                    message:`선택사항을 모두 선택해 주세요. 선택 : ${bodyData.allCheck}, 개발 선택 : ${bodyData.devSelect}, 버전 선택 : ${bodyData.versionSelect} `
                }
                res.render('error',{error:error,param:param,data:loginData})
            }else{
                const devVersion = bodyData.allCheck === 'Server' ? 'server' : bodyData.allCheck === 'Front' ? 'server' : bodyData.allCheck === 'App' ? 'app' : 'device'
                const params = {
                    Bucket: Bucket_name,
                    Key: devVersion+'/'+bodyData.devSelect+'/'+bodyData.versionSelect
                }
                s3.getObject(params, function (err, data) {
                    if (err) {
                        let error = {
                            message:`데이터 다운로드 에러... 에러내용 : ${err}`
                        }
                        res.render('error',{error:error,param:param,data:loginData})
                    } else {
                        if(devVersion === 'device'){
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Download.${bodyData.versionSelect}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Download History Save Success'))
                                .catch(err => console.log('Version Download History Save Fail', err))

                            res.writeHead(200,
                                {
                                    'Content-Type': `application/octet-stream`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${bodyData.versionSelect}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))
                        }else{
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Download.${bodyData.versionSelect}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Download History Save Success'))
                                .catch(err => console.log('Version Download History Save Fail', err))

                            res.writeHead(200,
                                {
                                    'Content-Type': `application/zip`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${bodyData.versionSelect}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))
                        }


                    }
                })

            }
        },

        async deviceVersionDownload(req, res) {
            const models = req.query.version

            await s3.listObjects({Bucket: Bucket_name}).promise().then((list) => {
                const contents = list.Contents
                let sendData = []
                contents.map(e => {
                    if (e.Key.split('/')[0] === 'device') {
                        if (e.Key.split('/')[1] === models.split('.')[0]) {
                            const date = e.Key.split('/')[2].split('.')[1]
                            if (date !== undefined) {
                                if (sendData.length > 0) {
                                    if (sendData[0].date.split('_').join('') < date.split('_').join('')) {
                                        let data = {
                                            key: e.Key,
                                            date: date
                                        }
                                        sendData[0] = data
                                    }
                                } else {
                                    let data = {
                                        key: e.Key,
                                        date: date
                                    }
                                    sendData.push(data)
                                }
                            }
                        }
                    }
                })

                if (sendData[0].date.split('_').join('') <= models.split('.')[1].split('_').join('')) {
                    res.status(200).send('This is the latest version of the device')
                } else {
                    const params = {
                        Bucket: Bucket_name,
                        Key: sendData[0].key
                    }
                    s3.getObject(params, function (err, data) {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log(sendData[0].key)
                            res.writeHead(200,
                                {
                                    'Content-Type': `application/octet-stream`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${sendData[0].key.split('/')[2]}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))

                        }
                    })
                }

            })

        },




        deviceS3Upload(req, res) {
            const file = req.file
            const loginData = JSON.parse(req.body.data)
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const name = loginData.access_name === '조현국' ? 'ChoHG': loginData.access_name === '김의선' ? 'KimUS':
                loginData.access_name === '남대현' ? 'NamDH': loginData.access_name === '서성민' ? 'SeoSM':'KimSY'
            let param = {
                param:'Blaubit.'+loginData.department+'.Administer.'+name+'.'+loginData.access_id
            }
            if(typeof file === 'undefined'){
                let error = {
                    message:`파일 첨부 후 이용해주세요.`
                }
                res.render('error',{param:param,error:error,data:loginData})
            }else{
                const filter = file.originalname.split('.')
                s3.listObjects({Bucket: Bucket_name}).promise().then((list)=>{
                    const checkList = list.Contents
                    const overlap = file.originalname
                    let overlapCheck = false
                    checkList.map(cl=>{
                        if(cl.Key.split('/')[2] === overlap){
                            overlapCheck = true
                        }
                    })
                    if(overlapCheck === true){
                        let error = {
                            message:`중복된 파일이 있습니다. fileName : ${overlap}`
                        }
                        res.render('error',{param:param,error:error,data:loginData})
                    }
                    else if(filter[2] !== 'bin' && filter[2] !== 'zip' && filter[2] !== 'pptx' && filter[2] !== 'pdf' ){
                        let error = {
                            message:`올바른 파일확장자(device : bin, server : zip, app : apk)을 첨부해주세요. 첨부된 확장자 : ${filter[filter.length -1]}`
                        }
                        res.render('error',{error:error,param:param,data:loginData})
                    }

                    else if(file.originalname.split('.')[0] === 'doc'){
                        const params = {
                            Bucket:Bucket_name+'/server/documents',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }
                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0] === 'bldb'){
                        const params={
                            Bucket:Bucket_name+'/device/bldb',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }
                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    } else if(file.originalname.split('.')[0] === 'bldc'){
                        const params={
                            Bucket:Bucket_name+'/device/bldc',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }

                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    } else if(file.originalname.split('.')[0] === 'blwc'){
                        const params={
                            Bucket:Bucket_name+'/device/blwc',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }else if(file.originalname.split('.')[0] === 'blss'){
                        const params={
                            Bucket:Bucket_name+'/device/blss',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    } else if(file.originalname.split('.')[0] === 'blvc'){
                        const params={
                            Bucket:Bucket_name+'/device/blvc',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    } else if(file.originalname.split('.')[0] === 'blsi'){
                        const params={
                            Bucket:Bucket_name+'/device/blsi',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }else if(file.originalname.split('.')[0]==='apiServer'){
                        const params={
                            Bucket:Bucket_name+'/server/apiServer',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }else if(file.originalname.split('.')[0]==='doorbellAdmin'){
                        const params={
                            Bucket:Bucket_name+'/server/doorbellAdmin',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='doorbellGo'){
                        const params={
                            Bucket:Bucket_name+'/server/doorbellGo',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='lambda'){
                        const params={
                            Bucket:Bucket_name+'/server/lambda',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='sleepcore'){
                        const params={
                            Bucket:Bucket_name+'/server/sleepcore',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='fastStroke'){
                        const params={
                            Bucket:Bucket_name+'/server/fastStroke',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='attendanceManagement'){
                        const params={
                            Bucket:Bucket_name+'/server/attendanceManagement',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='myrucell'){
                        const params={
                            Bucket:Bucket_name+'/server/myrucell',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='doorbellApp'){
                        const params={
                            Bucket:Bucket_name+'/app/doorbellApp',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='doorbellApk'){
                        const params={
                            Bucket:Bucket_name+'/app/doorbellApk',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }

                    else if(file.originalname.split('.')[0]==='sleepcoreApp'){
                        const params={
                            Bucket:Bucket_name+'/app/sleepcoreApp',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }
                    else if(file.originalname.split('.')[0]==='fastStrokeApp'){
                        const params={
                            Bucket:Bucket_name+'/app/fastStrokeApp',
                            Key:file.originalname.trim(),
                            Body:file.buffer
                        }

                        s3.upload(params,function (err,data){
                            if(err) throw err;
                            const date = moment().tz('Asia/Seoul')
                            let versionData = {
                                access_id: loginData.access_id,
                                access_name: loginData.access_name,
                                department: loginData.department,
                                ip:ip,
                                contents: `Upload.${file.originalname}`,
                                date: date.format('YYYY-MM-DD HH:mm:ss')
                            }
                            new Version(versionData).save()
                                .then(r => console.log('Version Update History Save Success'))
                                .catch(err => console.log('Version Update History Save Fail', err))
                            res.render('update',{data:versionData,param:param})
                        })
                    }else{
                        let error = {
                            message:`올바른 파일확장자(device : bin, server,app : zip)을 첨부해주세요. 첨부된 확장자 : ${filter[filter.length -1]}`
                        }
                        res.render('error',{error:error,param:param,data:loginData})
                    }

                })
            }


        },
    }
}

module.exports = management

