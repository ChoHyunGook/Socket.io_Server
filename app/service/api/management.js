const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../../DataBase");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, DEV_DEVICE_ADMIN, DEV_APP_ADMIN,
    DEV_SEVER_ADMIN, DEV_CEO_ADMIN
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
        async departVersionDownload(req, res) {
            const bodyData = req.body
            if(bodyData.allCheck === '=== 선택 ===' || bodyData.devSelect === '=== 선택 ===' || bodyData.versionSelect === '=== 선택 ==='){
                res.status(200).send(`선택사항을 모두 선택해 주세요. 선택 : ${bodyData.allCheck}, 개발 선택 : ${bodyData.devSelect}, 버전 선택 : ${bodyData.versionSelect} `)
            }else{
                const devVersion = bodyData.allCheck === 'Server' ? 'server' : bodyData.allCheck === 'App' ? 'app' : 'device'
                const params = {
                    Bucket: Bucket_name,
                    Key: devVersion+'/'+bodyData.devSelect+'/'+bodyData.versionSelect
                }
                s3.getObject(params, function (err, data) {
                    if (err) {
                        console.log(err)
                    } else {
                        if(devVersion === 'device'){
                            res.writeHead(200,
                                {
                                    'Content-Type': `application/octet-stream`,
                                    'Content-Length': data.ContentLength,
                                    'Content-Disposition': `filename="${bodyData.versionSelect}";`
                                },
                            )
                            res.end(Buffer.from(data.Body, 'base64'))
                        }else{
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

        async fileManagement(req, res) {
            const devAdmin = req.query.dev
            const ClientId = AWS_SECRET
            const ClientSecret = AWS_ACCESS
            const Bucket_name = AWS_BUCKET_NAME

            const s3 = new AWS.S3({
                accessKeyId: ClientId,
                secretAccessKey: ClientSecret,
                region: AWS_REGION
            });

            if (devAdmin !== DEV_CEO_ADMIN && devAdmin !== DEV_SEVER_ADMIN && devAdmin !== DEV_APP_ADMIN &&
                devAdmin !== DEV_DEVICE_ADMIN) {
                res.status(200).send('접근 불가 관리자 전용 페이지입니다.')
            } else {
                const date = moment().tz('Asia/Seoul')

                let data = {
                    access_id: devAdmin.split('.')[4] + '.' + devAdmin.split('.')[5] + '.' + devAdmin.split('.')[6],
                    access_name: devAdmin.split('.')[3] === 'ChoHG' ? '조현국' : devAdmin.split('.')[3] === 'NamDH' ? '남대현' : devAdmin.split('.')[3] === 'JungJC' ? '정지창' : '김의선',
                    department: devAdmin.split('.')[1],
                    contents: 'devLogin',
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
                        contents.map(e => {
                            if(e.Key.split('/')[0]==='server'){
                                let keyData = {
                                    key:e.Key
                                }
                                serverData.push(keyData)
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
                        res.render('index', {
                            data: data,
                            deviceData:deviceData.reverse(),
                            appData:appData.reverse(),
                            serverData:serverData.reverse()
                        })


                    })


            }
        },


        deviceS3Upload(req, res) {
            const file = req.file
            const loginData = JSON.parse(req.body.data)
            const filter = file.originalname.split('.')
            if(filter[1].length !== 13){
                res.status(200).send(`올바른 파일명(날짜_시간)을 작성 후 첨부해주세요. 올바른 예시 : 20230901_1301, 작성하신 파일명(날짜시간) : ${filter[filter.length -2]} `)
            }else if(filter[2] !== 'bin' && filter[2] !== 'zip'){
                res.status(200).send(`올바른 파일확장자(device : bin, server,app : zip)을 첨부해주세요. 첨부된 확장자 : ${filter[filter.length -1]}`)
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
                        contents: `DeviceUploadData.bldb.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `DeviceUploadData.bldc.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `DeviceUploadData.blwc.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `DeviceUploadData.blvc.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `DeviceUploadData.blsi.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.apiServer.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.doorbellAdmin.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.doorbellGo.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.lambda.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.sleepcore.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `ServerUploadData.fastStroke.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `AppUploadData.doorbellApp.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `AppUploadData.sleepcoreApp.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
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
                        contents: `AppUploadData.fastStrokeApp.${file.originalname}`,
                        date: date.format('YYYY-MM-DD HH:mm:ss')
                    }
                    new Version(versionData).save()
                        .then(r => console.log('Version Update History Save Success'))
                        .catch(err => console.log('Version Update History Save Fail', err))
                    res.render('update',{data:versionData})
                })
            }else{
                res.status(200).send(`약속된 파일명을 기입해주세요. (파일명 확인 요망) 첨부된파일명 : ${file.originalname}`)
            }

        },
    }
}

module.exports = management

