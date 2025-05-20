const semiDate = require("../Data/date");
const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const history = require('./history')
const dotenv = require("dotenv");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const qs = require('qs')
const jwt = require("jsonwebtoken")
const bcrypt = require('bcrypt')
const fs = require("fs")
const AWS = require("aws-sdk")
const nodemailer = require("nodemailer");
const { MongoClient } = require('mongodb');



const moment = require("moment-timezone");
const axios = require("axios");
const CryptoJS = require('crypto-js')
const {query} = require("express");
const AWSAPI = require("../../router/AWS");
var Client = require('mongodb').MongoClient;


const apiLogs = db.logs
const Info = db.Info
const History = db.history
const Face = db.face
const AwsLogin = db.AWSLogin
const AuthNumDB = db.authNum


let count = 0;
let awsLogsData = [];


const openDay = semiDate.today()
const logOpenDay = semiDate.logOpenDay()


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, DEV_DEVICE_ADMIN, DEV_APP_ADMIN, DEV_SEVER_ADMIN, DEV_CEO_ADMIN,AWS_LAMBDA_SIGNUP,
    AWS_TOKEN,NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_SERVICE, NODEMAILER_HOST,SUNIL_MONGO_URI,
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS

let database;

AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();



const api = function () {
    return {
    // {
    //     "device_id":{type:String, required:true},
    //     "name":{type:String,required:true},
    //     "contract_service":{type:String,required:true} => 주계약자, 부계약자,
    //     "userId":{type:String,required:true,unique:true} => 유니크 값,
    //     "addr":{type:String,required:true},
    //     "tel":{type:String,required:true},
    //     "communication":{type:Boolean,required:true},
    //     "service_name":{type:String,required:true} => A-Type,B-Type(Single),B-Type(Multi) ,
    //     "service_start":{type:String,required:true},
    //     "service_end":{type:String,required:true},
    //     "start_up":false
    // }

        // contract_num:{type:String,required:true,unique:true},
        // device_id:{type:String, required:true},
        // company:{type:String,required:true},
        // name:{type:String,required:true},
        // contract_service:{type:String,required:true},
        // id:{type:String,required:true,unique:true},
        // addr:{type:String,required:true},
        // tel:{type:String,required:true},
        // communication: {type:String,required:true},
        // service_name:{type:String,required:true},
        // service_start: {type:String,required:true},
        // service_end: {type:String,required:true},
        // start_up:{type:String,required:true},


        async checkPairing(req, res) {
            const deviceId = req.query.device_id.toLowerCase()

            try {
                const getDeviceTableParams = {
                    TableName: "DEVICE_TABLE",
                    KeyConditionExpression: 'device_id = :device_id',
                    ExpressionAttributeValues: {
                        ':device_id': deviceId// 파티션 키
                    }
                }
                const deviceResult = await dynamoDB.query(getDeviceTableParams).promise();
                if(deviceResult.Items.length > 0) {
                    res.status(200).send('Pairing')
                    console.log(deviceResult.Items)
                }else{
                    res.status(404).send('Not found')
                    console.log(deviceResult.Items)
                }
            } catch (err) {
                res.status(400).send(err)
            }
        },


        async awsFindData(req, res) {
            const data = req.body;
            const deviceId = data.device_id.toLowerCase(); // 소문자로 변환

            try {
                // DEVICE_TABLE에서 device_id에 따른 모든 user_key 조회
                const getDeviceTableParams = {
                    TableName: "DEVICE_TABLE",
                    KeyConditionExpression: 'device_id = :device_id',
                    ExpressionAttributeValues: {
                        ':device_id': deviceId // 파티션 키
                    }
                };

                const deviceResult = await dynamoDB.query(getDeviceTableParams).promise();

                // user_key가 있는지 확인
                const userKey = deviceResult.Items.length > 0 ? deviceResult.Items[0].user_key : null;

                if (!userKey) {
                    return res.status(404).json({ message: 'User key not found' });
                }

                const getAllDeviceDataParams = {
                    TableName: "DEVICE_TABLE",
                    KeyConditionExpression: 'device_id = :device_id and user_key = :user_key',
                    ExpressionAttributeValues: {
                        ':device_id': deviceId,
                        ':user_key': userKey // user_key는 정렬 키로 필요
                    }
                };

                const allDeviceDataResult = await dynamoDB.query(getAllDeviceDataParams).promise();


                // RECORD_TABLE에서 device_id에 따른 모든 file_location 조회
                const getFileLocationsParams = {
                    TableName: "RECORD_TABLE",
                    KeyConditionExpression: 'device_id = :device_id',
                    ExpressionAttributeValues: {
                        ':device_id': deviceId
                    }
                };

                // RECORD_TABLE에서 file_location들 조회
                const fileLocationResult = await dynamoDB.query(getFileLocationsParams).promise();

                // 각 file_location에 대해 데이터 조회
                const allRecordData = [];
                for (const item of fileLocationResult.Items) {
                    const fileLocation = item.file_location; // file_location 가져오기

                    const getRecordDataParams = {
                        TableName: "RECORD_TABLE",
                        KeyConditionExpression: 'device_id = :device_id and file_location = :file_location',
                        ExpressionAttributeValues: {
                            ':device_id': deviceId,
                            ':file_location': fileLocation // file_location은 정렬 키로 필요
                        }
                    };

                    const recordDataResult = await dynamoDB.query(getRecordDataParams).promise();
                    allRecordData.push(...recordDataResult.Items);
                }
                // date 기준으로 최신 순으로 정렬
                allRecordData.sort((a, b) => new Date(b.date) - new Date(a.date));

                // S3에서 객체 목록 조회
                const s3ObjectPrefix = deviceId.split(':').join('_') + '/'; // "aa:bb:cc:dd:ff:ee" -> "aa_bb_cc_dd_ff_ee/"
                const getS3Params = {
                    Bucket: 'doorbell-video',
                    Prefix: s3ObjectPrefix
                };

                let s3Data;
                try {
                    // S3에서 객체 목록 조회
                    const listedObjects = await s3.listObjectsV2(getS3Params).promise();
                    s3Data = listedObjects.Contents.length > 0 ? listedObjects.Contents : "데이터없음"; // 데이터가 없을 경우 메시지
                    // S3 데이터도 최신 저장 시간 기준으로 정렬
                    if (Array.isArray(s3Data)) {
                        s3Data.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
                    }
                } catch (error) {
                    // S3 조회 중 오류 발생 시 "데이터없음"으로 설정
                    s3Data = [];
                }

                // 결과를 클라이언트에 전송
                res.status(200).json({
                    recordLength:allRecordData.length,
                    s3Length:s3Data.length,
                    deviceData: allDeviceDataResult.Items[0] || [],
                    recordData: allRecordData || [],
                    s3Data: s3Data // S3 데이터
                });

            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).json({ message: 'Error fetching data', error: error.message });
            }

        },



        readDoorbell(req, res) {
            let adminClient;  // 👉 Admin DB Client
            let sunilClient;  // 👉 Sunil DB Client

            Client.connect(MONGO_URI)
                .then(client => {
                    adminClient = client;  // 👉 저장
                    const adminDb = client.db(ADMIN_DB_NAME).collection("tables");

                    return adminDb.find().toArray()
                        .then(findAdmin => {
                            // company가 "Sunil"인 데이터만 필터링
                            const filteredAdmins = findAdmin.filter(admin => admin.company === "Sunil");

                            // ✅ 첫 번째 DB 연결 종료 (여기서 닫아야 함)
                            console.log("✅ Admin DB connection closed.");
                            adminClient.close();

                            return Client.connect(SUNIL_MONGO_URI)
                                .then(client => {
                                    sunilClient = client;  // 👉 저장
                                    const sunilDb = client.db("Sunil-Doorbell").collection("users");

                                    return sunilDb.find().toArray()
                                        .then(findSunil => {
                                            const sunilIds = findSunil.map(user => user.id);

                                            const filteredAdminsWithoutSunilIds = filteredAdmins.filter(admin => !sunilIds.includes(admin.id));

                                            let saveData = [];
                                            const saveTime = moment().tz('Asia/Seoul');

                                            filteredAdminsWithoutSunilIds.map(item => {
                                                const pushData = {
                                                    overseas: true,
                                                    id: item.id,
                                                    addr: {
                                                        location: {},
                                                        address: "overseas",
                                                        road_address: "overseas",
                                                        zone_code: "overseas",
                                                        detail: "overseas",
                                                        full_address: "overseas"
                                                    },
                                                    email: item.email,
                                                    name: item.name,
                                                    open: "O",
                                                    serviceDate: saveTime.format('YYYY-MM-DD kk:mm:ss'),
                                                    items: item.device_id !== undefined ? [
                                                        {
                                                            classification: "overseas",
                                                            name: "overseas",
                                                            koType: {
                                                                category: "overseas",
                                                                detail: "overseas",
                                                                name: "overseas"
                                                            },
                                                            serial: "overseas",
                                                            device_id: item.device_id,
                                                            price: "overseas",
                                                            orderNum: "overseas",
                                                            orderDate: "overseas",
                                                            saleNote: "overseas",
                                                            discountType: "overseas",
                                                            discountPrice: "overseas"
                                                        }
                                                    ] : [],
                                                    discount: {
                                                        point: 0,
                                                        coupon: []
                                                    },
                                                    bookmark: [],
                                                    user_key: item.user_key !== undefined ? item.user_key : null,
                                                };
                                                saveData.push(pushData);
                                            });

                                            if (saveData.length > 0) {
                                                return sunilDb.insertMany(saveData)
                                                    .then(result => {
                                                        console.log(`${result.insertedCount} documents were inserted.`);
                                                        res.status(200).json(result);
                                                    })
                                                    .finally(() => {
                                                        // ✅ 두 번째 DB 연결 종료
                                                        console.log("✅ Sunil DB connection closed.");
                                                        sunilClient.close();
                                                    });
                                            } else {
                                                // ✅ 두 번째 DB 연결 종료
                                                console.log("✅ Sunil DB connection closed.");
                                                sunilClient.close();
                                                console.log("No data to save.");
                                            }
                                            console.log(saveData);
                                        });
                                });
                        });
                })
                .catch(error => {
                    console.error('Error connecting to MongoDB:', error);
                    res.status(500).json({ error: 'Database connection error' });
                    if (adminClient) adminClient.close();
                    if (sunilClient) sunilClient.close();
                });
        },


        checkDeivceId(req,res){
          const data = req.body
            Client.connect(MONGO_URI)
                .then(tableFind=>{
                    tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
                        .then(contracts=>{
                            // 각 계약의 device_id 필드에서 MAC 주소를 확인
                            const exists = contracts.some(contract => {
                                // device_id가 null일 경우 빈 배열로 처리
                                const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
                                return deviceIds.includes(data.device_id.toLowerCase());
                            });
                            res.status(200).send(exists)
                            tableFind.close()
                        })
                })
        },
        async allDeleteRecord(req, res) {
            try {
                const recordName = "RECORD_TABLE";
                // 모든 항목 조회
                const params = {
                    TableName: recordName,
                    Limit: 100 // 한 번에 조회할 최대 수
                };

                let items;
                do {
                    const data = await dynamoDB.scan(params).promise();
                    items = data.Items;

                    // 각 항목 삭제
                    for (const item of items) {
                        const deleteParams = {
                            TableName: recordName,
                            Key: {
                                // 항목의 기본 키를 여기에 설정해야 합니다.
                                // 예: id: item.id
                                device_id: item.device_id,
                                file_location: item.file_location
                            }
                        };
                        // 삭제 로그 출력
                        console.log(`Deleting item with device_id: ${item.device_id}`);
                        await dynamoDB.delete(deleteParams).promise();
                    }
                    // 다음 페이지가 있으면 계속 반복
                    params.ExclusiveStartKey = data.LastEvaluatedKey;
                } while (typeof params.ExclusiveStartKey !== "undefined");

                console.log("모든 항목이 성공적으로 삭제되었습니다.");
                return res.status(200).send('success'); // 성공 응답
            } catch (error) {
                console.error("항목 삭제 중 오류 발생:", error);
                return res.status(500).send('Error deleting items',error); // 오류 응답 추가
            }

        },

        record(req,res){
            const data = req.body
            const lowerDeviceId = data.device_id.toLowerCase()
            const recordName = "RECORD_TABLE"

            const recordParams = {
                TableName:recordName,
                KeyConditionExpression: `device_id = :pk`,
                ExpressionAttributeValues: {
                    ':pk': lowerDeviceId,
                },
            }
            dynamoDB.query(recordParams, (err, data) => {
                if (err) {
                    console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                } else {
                    console.log("Query succeeded:", JSON.stringify(data.Items, null, 2));

                    // 정렬 키 추출
                    const sortKeys = data.Items.map(item => item); // 정렬 키 이름에 맞게 수정


                    res.status(200).send(sortKeys)
                    console.log("Sorted Keys:", sortKeys);
                }
            });

        },


        async cutToken(req, res) {
            const user_keys = "51ffedad-9aa5-4cd6-8e01-7f4d1a8c0336"

            const params = {
                TableName: "USER_TABLE",
                Key: {
                    user_key: user_keys // 파티션 키
                },
            }
            try {
                // DynamoDB에서 데이터 조회
                const start = await dynamoDB.get(params).promise();

                // 결과 처리
                if (start.Item) {
                    console.log('조회된 사용자 데이터:', start.Item);
                    res.status(200).send(start.Item);
                } else {
                    console.log(`USER_TABLE: 해당 user_key에 대한 데이터가 없습니다: ${user_keys}`);
                }
            } catch (error) {
                console.error(`USER_TABLE: 조회 실패`, error);
            }


        },

        allDeleteDevices(req,res){
            const data = req.body
            const lowerDeviceId = data.device_id.toLowerCase()

            Client.connect(MONGO_URI)
                .then(async tableFind => {
                    try {
                        const result = {
                            Mongo: { admin: "", history: "" },
                            Dynamo: { Device_Table: "", Record_Table: "" },
                            S3: ""
                        };

                        // MongoDB에서 device_id로 문서 찾기
                        const findKey = await tableFind.db(ADMIN_DB_NAME).collection("tables")
                            .findOne({ device_id: { $regex: lowerDeviceId, $options: 'i' } });

                        if (!findKey) {
                            result.Mongo.admin = "삭제할 데이터 없음"; // MongoDB에서 삭제할 데이터 없음
                        } else {
                            // MongoDB 데이터 업데이트
                            const deviceIds = findKey.device_id ? findKey.device_id.split(',') : [];
                            const updatedDeviceIds = deviceIds.filter(id => id.trim() !== lowerDeviceId);
                            const newDeviceId = updatedDeviceIds.length > 0 ? updatedDeviceIds.join(',') : null;

                            // 업데이트 수행
                            await tableFind.db(ADMIN_DB_NAME).collection("tables").updateOne(
                                { _id: findKey._id },
                                { $set: { device_id: newDeviceId } }
                            );

                            result.Mongo.admin = "삭제 성공"; // MongoDB 데이터 삭제 성공
                        }

                        // History에서 기록 삭제
                        const historyResult = await History.deleteMany({ device_id: lowerDeviceId });
                        result.Mongo.history = historyResult.deletedCount > 0 ? "삭제 성공" : "삭제할 데이터 없음"; // History 삭제 결과

                        // DEVICE_TABLE에서 user_key 가져오기
                        const deviceKeyResult = await dynamoDB.query({
                            TableName: "DEVICE_TABLE",
                            KeyConditionExpression: "device_id = :device_id",
                            ExpressionAttributeValues: {
                                ":device_id": lowerDeviceId
                            }
                        }).promise();

                        if (deviceKeyResult.Items && deviceKeyResult.Items.length > 0) {
                            const user_key = deviceKeyResult.Items[0].user_key; // 첫 번째 문서에서 user_key 가져오기

                            // DEVICE_TABLE에서 데이터 삭제
                            const deviceDeleteParams = {
                                TableName: "DEVICE_TABLE",
                                Key: {
                                    "device_id": lowerDeviceId,
                                    "user_key": user_key
                                }
                            };

                            await dynamoDB.delete(deviceDeleteParams).promise();
                            result.Dynamo.Device_Table = "삭제 성공"; // 삭제 성공
                        } else {
                            result.Dynamo.Device_Table = "삭제할 데이터 없음"; // DEVICE_TABLE에서 삭제할 데이터 없음
                        }

                        // RECORD_TABLE에서 데이터 삭제
                        const recordDeleteResult = await deleteFromRecordTable(lowerDeviceId);
                        result.Dynamo.Record_Table = recordDeleteResult ? "삭제 성공" : "삭제할 데이터 없음";

                        // S3에서 객체 삭제
                        const s3DeleteResult = await deleteFromS3(lowerDeviceId);
                        result.S3 = s3DeleteResult ? "삭제 성공" : "삭제할 데이터 없음";

                        // 최종 응답
                        res.status(200).json(result);
                    } catch (error) {
                        console.error('Error during deletion process:', error);
                        res.status(500).json({ error: 'Internal Server Error' });
                    } finally {
                        tableFind.close();
                    }
                })
                .catch(error => {
                    console.error('Error connecting to MongoDB:', error);
                    res.status(500).json({ error: 'Internal Server Error' });
                });

            // RECORD_TABLE에서 데이터 삭제 함수
            async function deleteFromRecordTable(lowerDeviceId) {
                const queryParams = {
                    TableName: "RECORD_TABLE",
                    KeyConditionExpression: "device_id = :device_id",
                    ExpressionAttributeValues: {
                        ":device_id": lowerDeviceId
                    }
                };

                try {
                    const result = await dynamoDB.query(queryParams).promise();
                    if (result.Items && result.Items.length > 0) {
                        for (const record of result.Items) {
                            const deleteParams = {
                                TableName: "RECORD_TABLE",
                                Key: {
                                    "device_id": record.device_id,
                                    "file_location": record.file_location
                                }
                            };
                            await dynamoDB.delete(deleteParams).promise();
                            console.log(`Deleted item from RECORD_TABLE with device_id: ${lowerDeviceId}, file_location: ${record.file_location}`);
                        }
                        return true; // 삭제 성공
                    } else {
                        console.log(`No items found in RECORD_TABLE for device_id: ${lowerDeviceId}`);
                        return false; // 삭제할 데이터 없음
                    }
                } catch (error) {
                    console.error(`Failed to delete items from RECORD_TABLE:`, error);
                    return false; // 삭제 실패
                }
            }

            // S3에서 객체 삭제 함수
            async function deleteFromS3(lowerDeviceId) {
                const s3 = new AWS.S3();
                const bucketName = "doorbell-video"
                const directoryKey = lowerDeviceId.replace(/:/g, '_')+"/";
                console.log(directoryKey);

                // 디렉토리 내 객체 목록 가져오기
                const listParams = {
                    Bucket: bucketName,
                    Prefix: directoryKey // 삭제할 디렉토리의 Prefix
                };

                try {
                    const listData = await s3.listObjectsV2(listParams).promise();

                    // 삭제할 객체가 있는지 확인
                    if (listData.Contents.length === 0) {
                        console.log(`No objects found in directory: ${directoryKey}`);
                        return; // 삭제할 객체가 없음
                    }

                    // 객체 삭제
                    const deleteParams = {
                        Bucket: bucketName,
                        Delete: {
                            Objects: listData.Contents.map(obj => ({ Key: obj.Key }))
                        }
                    };

                    await s3.deleteObjects(deleteParams).promise();
                    console.log(`Deleted all objects in directory: ${directoryKey}`);

                } catch (error) {
                    console.error(`Failed to delete objects from S3:`, error);
                }
            }


        },

        deleteTarget: async (req, res) => {
            const data = req.body
            const DEVICE_TABLE = 'DEVICE_TABLE'; // 실제 테이블 이름으로 변경
            const RECORD_TABLE = 'RECORD_TABLE'; // 실제 테이블 이름으로 변경
            const USER_TABLE = 'USER_TABLE'; // 사용자 정보 테이블 이름
            const BUCKET_NAME = 'doorbell-video'; // S3 버킷 이름
            // 메시지 저장
            const responseMsg = {
                DEVICE_TABLE: {},
                RECORD_TABLE: {},
                USER_TABLE: {},
                S3: {},
                MongoAdmin:{},
                MongoHistory:{}
            };
            const lowerDeviceId = data.device_id.toLowerCase();
            const client = await Client.connect(MONGO_URI);
            const collection = client.db(ADMIN_DB_NAME).collection("tables");
            const findUsers = await collection.findOne({ user_key: data.user_key });
            responseMsg.MongoHistory.complete = findUsers.device_id
            let updatedDeviceIds = findUsers.device_id !== null ? findUsers.device_id.split(',').filter(id => id !== lowerDeviceId).join(','):null;
            if (updatedDeviceIds === '') {
                updatedDeviceIds = null;
            }
            // MongoDB 어드민 서버 테이블 업데이트
            await collection.updateOne({ _id: findUsers._id }, { $set: { device_id: updatedDeviceIds } });

            // MongoDB 소켓 서버 히스토리 삭제
            const delHistory = await History.deleteMany({ device_id: lowerDeviceId });
            responseMsg.MongoHistory.complete = delHistory.deletedCount

            // 비동기 작업을 병렬로 실행
            await Promise.all([
                AWSAPI().delDynamoUserFcm(USER_TABLE, data.user_key, responseMsg),
                AWSAPI().delDynamoDeviceTable(DEVICE_TABLE, lowerDeviceId, data.user_key, responseMsg),
                AWSAPI().delDynamoRecord(RECORD_TABLE, lowerDeviceId, responseMsg),
                AWSAPI().delS3(BUCKET_NAME, lowerDeviceId, responseMsg)
            ]);
            const lastData = await collection.findOne({ user_key: data.user_key });

            res.status(200).json({
                msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: id:${lastData.id} - name:${lastData.name}`,
                responseMsg: responseMsg
            });
        },

        testAPI(req,res){
            const data = req.body
            const token = jwt.sign({user_key:data.user_key},AWS_TOKEN)
            axios.post("https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push/others",{
                user_key: data.user_key,
                fcm_token: data.fcm_token,
                title:data.title,
                message:data.message,
            },{
                headers: {
                    'x-access-token': token // x-access-token 헤더 추가
                }
            }
            ).then(resp=>{
                console.log(resp)
                res.status(200).json(resp.data)
            })
        },

        async renewalDeleteDeviceId(req, res) {
            const data = req.body;
            console.log(data)
            const lowerDeviceId = data.device_id.toLowerCase();
            const token = req.headers['token'];
            const DEVICE_TABLE = 'DEVICE_TABLE'; // 실제 테이블 이름으로 변경
            const RECORD_TABLE = 'RECORD_TABLE'; // 실제 테이블 이름으로 변경
            const USER_TABLE = 'USER_TABLE'; // 사용자 정보 테이블 이름
            const BUCKET_NAME = 'doorbell-video'; // S3 버킷 이름

            // if (data.device_id === undefined && data.fcm_token === undefined) {
            //     return res.status(400).json({ error: 'There are no device_id and fcm_token inside the body.' });
            // }
            if (data.fcm_token === undefined) {
                console.log('There is no fcm_token inside the body.')
                return res.status(400).json({ error: 'There is no fcm_token inside the body.' });
            }
            if (data.device_id === undefined) {
                console.log('There is no device_id inside the body.')
                return res.status(400).json({ error: 'There is no device_id inside the body.' });
            }
            if (token === undefined) {
                console.log('Token not found.')
                return res.status(400).send('Token not found.');
            }


            const verify = jwt.verify(token, process.env.AWS_TOKEN);

            const sendFcmMessage = await axios.post(
                "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push/others",
                {
                    user_key: verify.user_key,
                    fcm_token: data.fcm_token,
                    title:"[Re-login Request] Change User Information",
                    message:"Your user information has been changed. Please log in again.",
                },{
                    headers: {
                        'x-access-token': token // x-access-token 헤더 추가
                    }
                }
            )
            if(sendFcmMessage.data.resultcode !== "00"){
                console.log('sendFcmMessage failed')
                return res.status(400).send('sendFcmMessage failed');
            }
            console.log(sendFcmMessage.data)

            const client = await Client.connect(MONGO_URI);
            const collection = client.db(ADMIN_DB_NAME).collection("tables");
            const findUsers = await collection.findOne({ user_key: verify.user_key });

            let updatedDeviceIds = findUsers.device_id !== null ? findUsers.device_id.split(',').filter(id => id !== lowerDeviceId).join(','):null;
            if (updatedDeviceIds === '') {
                updatedDeviceIds = null;
            }

            // MongoDB 어드민 서버 테이블 업데이트
            await collection.updateOne({ _id: findUsers._id }, { $set: { device_id: updatedDeviceIds } });

            // MongoDB 소켓 서버 히스토리 삭제
            await History.deleteMany({ device_id: lowerDeviceId });

            // 메시지 저장
            const responseMsg = {
                DEVICE_TABLE: {},
                RECORD_TABLE: {},
                USER_TABLE: {},
                S3: {}
            };

            // 비동기 작업을 병렬로 실행
            await Promise.all([
                AWSAPI().delDynamoUserFcm(USER_TABLE, verify.user_key, responseMsg),
                AWSAPI().delDynamoDeviceTable(DEVICE_TABLE, lowerDeviceId, verify.user_key, responseMsg),
                AWSAPI().delDynamoRecord(RECORD_TABLE, lowerDeviceId, responseMsg),
                AWSAPI().delS3(BUCKET_NAME, lowerDeviceId, responseMsg)
            ]);

            console.log(responseMsg);

            const lastData = await collection.findOne({ user_key: verify.user_key });

            res.status(200).json({
                msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                changeData: lastData
            });
        },


        signOut(req,res){
          const data = req.body
          Client.connect(MONGO_URI)
              .then(tableFind=>{
                  tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key:data.user_key})
                      .then(async findData => {
                          const s3 = new AWS.S3();
                          const DEVICE_TABLE = 'DEVICE_TABLE';
                          const RECORD_TABLE = "RECORD_TABLE"
                          const BUCKET_NAME = 'doorbell-video';

                          const deviceIds = findData.device_id ? findData.device_id.split(",") : [];
                          let deviceTableResults = [];
                          let recordTableResults = [];
                          let s3Results = [];

                          for (const deviceId of deviceIds) {
                              const trimmedDeviceId = deviceId.trim();

                              // 1. DEVICE_TABLE에서 삭제
                              const deviceDeleteParams = {
                                  TableName: DEVICE_TABLE,
                                  Key: {
                                      device_id: trimmedDeviceId,
                                      user_key: findData.user_key
                                  }
                              };

                              try {
                                  const deviceScanParams = {
                                      TableName: DEVICE_TABLE,
                                      KeyConditionExpression: 'device_id = :device_id and user_key = :user_key',
                                      ExpressionAttributeValues: {
                                          ':device_id': trimmedDeviceId,
                                          ':user_key': findData.user_key
                                      }
                                  };

                                  const deviceScanResult = await dynamoDB.query(deviceScanParams).promise();

                                  if (deviceScanResult.Items.length > 0) {
                                      await dynamoDB.delete(deviceDeleteParams).promise();
                                      deviceTableResults.push(`DEVICE_TABLE: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
                                  } else {
                                      deviceTableResults.push(`DEVICE_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                                  }
                              } catch (error) {
                                  console.error(`Error deleting from DEVICE_TABLE:`, error);
                                  deviceTableResults.push(`DEVICE_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
                              }

                              // 2. RECORD_TABLE에서 삭제
                              const scanParams = {
                                  TableName: RECORD_TABLE,
                                  FilterExpression: 'device_id = :device_id',
                                  ExpressionAttributeValues: {
                                      ':device_id': trimmedDeviceId
                                  }
                              };

                              try {
                                  const scanResult = await dynamoDB.scan(scanParams).promise();

                                  if (scanResult.Items.length > 0) {
                                      const deletePromises = scanResult.Items.map(record => {
                                          const deleteParams = {
                                              TableName: RECORD_TABLE,
                                              Key: {
                                                  device_id: record.device_id,
                                                  file_location: record.file_location // 정렬 키
                                              }
                                          };
                                          return dynamoDB.delete(deleteParams).promise().then(() => {
                                              recordTableResults.push(`RECORD_TABLE: 삭제성공 삭제된 deviceId: ${record.device_id}`);
                                          });
                                      });

                                      await Promise.all(deletePromises);
                                  } else {
                                      recordTableResults.push(`RECORD_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                                  }
                              } catch (error) {
                                  console.error(`Error deleting from RECORD_TABLE:`, error);
                                  recordTableResults.push(`RECORD_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
                              }

                              // 3. S3에서 객체 삭제
                              const s3ObjectPrefix = trimmedDeviceId.split(':').join('_') + '/';
                              try {
                                  const listParams = {
                                      Bucket: BUCKET_NAME,
                                      Prefix: s3ObjectPrefix
                                  };

                                  const listedObjects = await s3.listObjectsV2(listParams).promise();

                                  if (listedObjects.Contents.length > 0) {
                                      const deleteParams = {
                                          Bucket: BUCKET_NAME,
                                          Delete: {
                                              Objects: listedObjects.Contents.map(object => ({ Key: object.Key })),
                                          },
                                      };

                                      await s3.deleteObjects(deleteParams).promise();
                                      s3Results.push(`S3: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
                                  } else {
                                      s3Results.push(`S3: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                                  }
                              } catch (error) {
                                  console.error(`Error deleting objects from S3:`, error);
                                  s3Results.push(`S3: 삭제 실패 deviceId: ${trimmedDeviceId}`);
                              }
                          }
                          try {
                              const suc = await tableFind.db(ADMIN_DB_NAME).collection('tables').deleteMany({ id: findData.id });

                              // deviceIds => 디바이스 아이디들
                              const result = await History.deleteMany({ device_id: { $in: deviceIds } });

                              const sunilClient = await MongoClient.connect(SUNIL_MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
                              const sunilDb = sunilClient.db("Sunil-Doorbell");
                              const users = sunilDb.collection("users");

                              const sucSunil = await users.deleteMany({ id: findData.id });

                              // 최종 결과 출력
                              deviceTableResults.forEach(result => console.log(result));
                              recordTableResults.forEach(result => console.log(result));
                              s3Results.forEach(result => console.log(result));

                              console.log(`Deleted ${sucSunil.deletedCount} documents from users.`);
                              console.log(`Deleted ${suc.deletedCount} documents from MongoDB for user_key=${findData.user_key}`);
                              console.log(`History Deleted Count = ${result.deletedCount}`);
                              console.log(`${findData.id}-${findData.name} 회원탈퇴 성공`);

                              res.status(200).send(`${findData.id}-${findData.name} 회원탈퇴 성공`);
                          } catch (err) {
                              console.error(err);
                              res.status(500).send("회원탈퇴 처리 중 오류가 발생했습니다.");
                          } finally {
                              // tableFind 연결 종료
                              tableFind.close();
                          }
                      })
                      .catch(err=>{
                          console.log(err)
                          tableFind.close()
                      })

              })
        },



        findOverseasUser(req, res) {
            const data = req.body;

            // 검색 조건 설정
            let params = { email: data.user_email };

            if (data.user_id !== undefined) {
                params['id'] = data.user_id;
            }

            let client;  // 👉 클라이언트 객체를 외부에 저장

            Client.connect(MONGO_URI)
                .then(tableFind => {
                    client = tableFind;
                    const collection = tableFind.db(ADMIN_DB_NAME).collection('tables');

                    return collection.findOne(params);
                })
                .then(findData => {
                    if (findData) {
                        if (data.user_id !== undefined) {
                            res.status(200).send('ok');
                        } else {
                            res.status(200).send(findData.id);
                        }
                    } else {
                        res.status(404).send('User not found');
                    }
                })
                .catch(err => {
                    console.error('Error fetching user:', err);
                    res.status(500).send('Database error');
                })
                .finally(() => {
                    if (client) {
                        console.log("✅ DB Connection closed.");
                        client.close(); // ✅ 항상 종료
                    }
                });
        },


        updateOverseasUser(req, res) {
            const data = req.body;
            let client; // 👉 클라이언트 객체를 외부에 저장

            Client.connect(MONGO_URI)
                .then(tableFind => {
                    client = tableFind;
                    return tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({
                        id: data.user_id,
                        email: data.user_email
                    });
                })
                .then(findData => {
                    if (findData) {
                        const tableName = 'USER_TABLE';
                        const scanParams = {
                            TableName: tableName,
                            FilterExpression: 'user_id = :user_id',
                            ExpressionAttributeValues: {
                                ':user_id': data.user_id
                            }
                        };

                        dynamoDB.scan(scanParams, (err, scanResult) => {
                            if (err) {
                                console.error('Error scanning table:', err);
                                res.status(500).json({ error: 'Could not scan table' });
                                return;
                            }

                            if (scanResult.Items.length === 0) {
                                res.status(404).json({ error: 'User not found' });
                                return;
                            }

                            const encryptedPassword = bcrypt.hashSync(data.user_pw, 5);
                            const userKey = scanResult.Items[0].user_key;

                            const updateParams = {
                                TableName: tableName,
                                Key: {
                                    user_key: userKey
                                },
                                UpdateExpression: 'set user_pw = :user_pw',
                                ExpressionAttributeValues: {
                                    ':user_pw': encryptedPassword
                                },
                                ReturnValues: 'ALL_NEW'
                            };

                            dynamoDB.update(updateParams, (err, result) => {
                                if (err) {
                                    console.error('Error updating password:', err);
                                    res.status(500).json({ error: 'Could not update password' });
                                } else {
                                    res.status(200).send('Password updated successfully');
                                }
                            });
                        });
                    } else {
                        res.status(404).send('User not found');
                    }
                })
                .catch(error => {
                    console.error('Error connecting to MongoDB:', error);
                    res.status(500).send('Database connection error');
                })
                .finally(() => {
                    if (client) {
                        console.log("✅ DB Connection closed.");
                        client.close(); // ✅ 무조건 종료
                    }
                });
        },

        eaglesSafesOverseasSave(target, data) {
            const saveTime = moment().tz('Asia/Seoul');

            if (target === "signUp") {
                const saveData = {
                    overseas: true,
                    id: data.id,
                    addr: {
                        location: {},
                        address: "overseas",
                        road_address: "overseas",
                        zone_code: "overseas",
                        detail: "overseas",
                        full_address: "overseas"
                    },
                    email: data.email,
                    name: data.name,
                    open: "O",
                    serviceDate: saveTime.format('YYYY-MM-DD kk:mm:ss'),
                    items: [],
                    discount: {
                        point: 0,
                        coupon: []
                    },
                    bookmark: []
                };

                let client;  // 👉 클라이언트 객체를 외부에 저장

                Client.connect(SUNIL_MONGO_URI)
                    .then(tableFind => {
                        client = tableFind;
                        tableFind.db("Sunil-Doorbell").collection('users').insertOne(saveData)
                            .then(suc => {
                                tableFind.db("Sunil-Doorbell").collection('users').findOne({ id: data.id })
                                    .then(findData => {
                                        console.log(suc);
                                        console.log(findData);
                                    })
                                    .catch(err => {
                                        console.log(err);
                                    });
                            })
                            .catch(err => {
                                console.log(err);
                            })
                            .finally(() => {
                                if (client) {
                                    console.log("✅ Sunil-Doorbell DB Connection closed.");
                                    client.close(); // ✅ 무조건 종료
                                }
                            });
                    })
                    .catch(err => {
                        console.log(err);
                    });
            }

            if (target === "saveUserKey") {
                let client;  // 👉 클라이언트 객체를 외부에 저장

                Client.connect(SUNIL_MONGO_URI)
                    .then(tableFind => {
                        client = tableFind;
                        tableFind.db("Sunil-Doorbell").collection('users').findOneAndUpdate(
                            { id: data.id },
                            { $set: { user_key: data.user_key } }
                        )
                            .then(suc => {
                                console.log(suc);
                            })
                            .catch(err => {
                                console.log(err);
                            })
                            .finally(() => {
                                if (client) {
                                    console.log("✅ Sunil-Doorbell DB Connection closed.");
                                    client.close(); // ✅ 무조건 종료
                                }
                            });
                    })
                    .catch(err => {
                        console.log(err);
                    });
            }
        },
        // eaglesSafesOverseasSave(target,data){
        //     const saveTime = moment().tz('Asia/Seoul')
        //     if(target === "signUp"){
        //         const saveData = {
        //             overseas:true,
        //             id:data.id,
        //             addr:{
        //                 location:{},
        //                 address:"overseas",
        //                 road_address:"overseas",
        //                 zone_code:"overseas",
        //                 detail:"overseas",
        //                 full_address:"overseas"
        //             },
        //             email:data.email,
        //             name:data.name,
        //             open:"O",
        //             serviceDate:saveTime.format('YYYY-MM-DD kk:mm:ss'),
        //             items:[],
        //             discount:{
        //                 point:0,
        //                 coupon:[]
        //             },
        //             bookmark:[]
        //         }
        //
        //         Client.connect(SUNIL_MONGO_URI)
        //             .then(tableFind=>{
        //                 tableFind.db("Sunil-Doorbell").collection('users').insertOne(saveData)
        //                     .then(suc=>{
        //                         tableFind.db("Sunil-Doorbell").collection('users').findOne({id:data.id})
        //                             .then(findData=>{
        //                                 console.log(suc)
        //                                 console.log(findData)
        //                             })
        //                             .catch(err=>{
        //                                 console.log(err)
        //                             })
        //                     })
        //                     .catch(err=>{
        //                         console.log(err)
        //                     })
        //             })
        //             .catch(err=>{
        //                 console.log(err)
        //             })
        //     }
        //
        //     if(target === "saveUserKey"){
        //         Client.connect(SUNIL_MONGO_URI)
        //             .then(tableFind => {
        //                 tableFind.db("Sunil-Doorbell").collection('users').findOneAndUpdate({id:data.id},
        //                     {$set:{
        //                             user_key:data.user_key
        //                         }})
        //                     .then(suc => {
        //                         console.log(suc)
        //                     })
        //                     .catch(err => {
        //                         console.log(err)
        //                     })
        //             })
        //             .catch(err => {
        //                 console.log(err)
        //             })
        //     }
        //
        // },


        overseasSignup(req,res){
            const data = req.body;
            const saveTime = moment().tz('Asia/Seoul');
            console.log(data);

            Client.connect(MONGO_URI)
                .then(tableFind => {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').find({ company: "Sunil" }).toArray()
                        .then(allData => {
                            let maxContractNumObj = allData
                                .filter(item => item.contract_num && item.contract_num.startsWith('Sunil-overseas-')) // contract_num이 존재하는지 확인
                                .reduce((max, item) => {
                                    const num = parseInt(item.contract_num.split('Sunil-overseas-')[1], 10);
                                    return (num > parseInt(max.contract_num.split('Sunil-overseas-')[1], 10)) ? item : max;
                                });

                            // maxContractNumObj가 존재하는지 확인
                            const maxContractNum = maxContractNumObj ? parseInt(maxContractNumObj.contract_num.split('Sunil-overseas-')[1], 10) : 0;

                            // user_id, user_pw, name, tel, addr(국가), company(회사)
                            let key = data.user_id;
                            let tel = "00000000000";
                            let addr = "sunilOverseas";
                            let saveAwsData = {
                                user_id: key,
                                user_pw: data.user_pw,
                                name: key,
                                tel: tel,
                                addr: addr,
                                company: "Sunil",
                            };

                            let mongoData = {
                                name: key,
                                tel: tel,
                                addr: addr,
                                email: data.user_email,
                                contract_num: `Sunil-overseas-${Number(maxContractNum) + 1}`, // 데이터 조회 후 +1씩 증가
                                device_id: null,
                                company: "Sunil",
                                contract_service: '주계약자',
                                id: data.user_id,
                                communication: 'O',
                                service_name: "SunilService",
                                service_start: saveTime.format('YYYY-MM-DD'),
                                service_end: "9999-12-30",
                                start_up: 'O',
                                user_key: null,
                            };

                            tableFind.db(ADMIN_DB_NAME).collection('tables').find({ id: data.user_id }).toArray()
                                .then(findData => {
                                    if (findData.length !== 0) {
                                        console.log('Duplicate UserId');
                                        res.status(400).send('Duplicate UserId');
                                        tableFind.close();
                                    } else {
                                        tableFind.db(ADMIN_DB_NAME).collection('tables').insertOne(mongoData)
                                            .then(suc => {
                                                console.log(suc);
                                                tableFind.db(ADMIN_DB_NAME).collection('tables').find({ id: data.user_id }).toArray()
                                                    .then(sendData => {
                                                        axios.post(AWS_LAMBDA_SIGNUP, saveAwsData)
                                                            .then(awsResponse => {
                                                                console.log('success SignUp');
                                                                this.eaglesSafesOverseasSave("signUp", mongoData);
                                                                res.status(200).json({ msg: 'Success Signup', checkData: sendData[0], awsResponse: awsResponse.data });
                                                                tableFind.close();
                                                            })
                                                            .catch(err => {
                                                                console.log(err);
                                                                res.status(400).send(err);
                                                                tableFind.close();
                                                            });
                                                    });
                                            })
                                            .catch(err => {
                                                console.log('save Fail');
                                                console.log(err);
                                                tableFind.close();
                                            });
                                    }
                                });
                        })
                        .catch(err => {
                            console.log(err);
                            tableFind.close();
                        });
                })
                .catch(err => {
                    console.log(err);
                });


        },


        async deleteHistory(req, res) {

            const data = req.body;
            console.log(`:::::::::::페어링 시작 ::::::::::::`)
            console.log(data)
            const s3 = new AWS.S3();
            const lowerDeviceId = data.device_id.toLowerCase();
            const trimmedDeviceId = lowerDeviceId.trim();
            let userTableResults = []
            let deviceTableResults = []
            let historyTableResults = []
            let recordTableResults = [];
            let s3Results = [];

            // History 삭제
            try {
                const deleteResult = await History.deleteMany({ device_id: lowerDeviceId });
                if (deleteResult.deletedCount > 0) {
                    historyTableResults.push(`History: 삭제성공 deviceId: ${trimmedDeviceId}`);
                } else {
                    historyTableResults.push(`History: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                }
            } catch (error) {
                console.error(`Error deleting from History:`, error);
                historyTableResults.push(`History: 삭제 실패 deviceId: ${trimmedDeviceId}`);
            }


            //DEVICE_TABLE 삭제
            const deviceGetParams = {
                TableName: "DEVICE_TABLE",
                Key: {
                    device_id: trimmedDeviceId,
                    user_key: data.user_key
                }
            };

            try {
                const deviceItem = await dynamoDB.get(deviceGetParams).promise();

                if (deviceItem.Item) {
                    // 삭제할 데이터가 존재하는 경우
                    await dynamoDB.delete(deviceGetParams).promise();
                    deviceTableResults.push(`DEVICE_TABLE: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
                    console.log(`DEVICE_TABLE: 삭제성공 deviceId: ${trimmedDeviceId} userKey: ${data.user_key}`);
                } else {
                    // 삭제할 데이터가 없는 경우
                    deviceTableResults.push(`DEVICE_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                }
            } catch (error) {
                console.error(`Error deleting from DEVICE_TABLE:`, error);
                deviceTableResults.push(`DEVICE_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
            }



            // DynamoDB에서 레코드 삭제
            const scanParams = {
                TableName: "RECORD_TABLE",
                FilterExpression: 'device_id = :device_id',
                ExpressionAttributeValues: {
                    ':device_id': trimmedDeviceId
                }
            };

            try {
                const scanResult = await dynamoDB.scan(scanParams).promise();

                if (scanResult.Items.length > 0) {
                    const deletePromises = scanResult.Items.map(record => {
                        const deleteParams = {
                            TableName: "RECORD_TABLE",
                            Key: {
                                device_id: record.device_id,
                                file_location: record.file_location // 정렬 키
                            }
                        };
                        return dynamoDB.delete(deleteParams).promise().then(() => {
                            recordTableResults.push(`RECORD_TABLE: 삭제성공 삭제된 deviceId: ${record.device_id}`);
                        });
                    });

                    await Promise.all(deletePromises);
                } else {
                    recordTableResults.push(`RECORD_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                }
            } catch (error) {
                console.error(`Error deleting from RECORD_TABLE:`, error);
                recordTableResults.push(`RECORD_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
            }

            // S3에서 객체 삭제
            const s3ObjectPrefix = trimmedDeviceId.split(':').join('_') + '/';
            try {
                const listParams = {
                    Bucket: "doorbell-video",
                    Prefix: s3ObjectPrefix
                };

                const listedObjects = await s3.listObjectsV2(listParams).promise();

                if (listedObjects.Contents.length > 0) {
                    const deleteParams = {
                        Bucket: "doorbell-video",
                        Delete: {
                            Objects: listedObjects.Contents.map(object => ({ Key: object.Key })),
                        },
                    };

                    await s3.deleteObjects(deleteParams).promise();
                    s3Results.push(`S3: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
                } else {
                    s3Results.push(`S3: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
                }
            } catch (error) {
                console.error(`Error deleting objects from S3:`, error);
                s3Results.push(`S3: 삭제 실패 deviceId: ${trimmedDeviceId}`);
            }


            //User_Table 업데이트
            const saveFcmToken = {
                fcm_token:data.fcm_token,
                upKey:data.upKey
            }
                //data.fcm_token + "+" + data.upKey + "+";
            const userScanParams = {
                TableName: "USER_TABLE",
                Key: {
                    user_key: data.user_key
                }
            };

            try {
                const userScanResult = await dynamoDB.get(userScanParams).promise();

                // userScanResult.Item이 존재하는지 확인
                if (userScanResult.Item) {
                    // fcm_token이 빈 배열일 경우 saveFcmToken을 사용
                    const existingTokens = userScanResult.Item.fcm_token || []; // fcm_token이 없으면 빈 배열로 초기화
                    const basicToken = [...existingTokens, saveFcmToken]; // 기존 토큰에 새 토큰을 추가


                    const UserParams = {
                        TableName: 'USER_TABLE',
                        Key: {
                            user_key: data.user_key // 파티션 키
                        },
                        UpdateExpression: 'set fcm_token = :fcm_token',
                        ExpressionAttributeValues: {
                            ':fcm_token': basicToken
                        },
                        ReturnValues: 'UPDATED_NEW' // 업데이트된 값을 반환
                    };

                    try {
                        const result = await dynamoDB.update(UserParams).promise();
                        console.log('Update succeeded:', result);
                        userTableResults.push(`USER_TABLE: 저장 : ${saveFcmToken}`);
                    } catch (error) {
                        console.error('Unable to update item. Error:', error);
                    }

                    console.log(`USER_TABLE: fcm_token: ${userScanResult.Item.fcm_token}`);
                } else {
                    console.log(`USER_TABLE: 해당 user_key에 대한 데이터가 없습니다: ${data.user_key}`);
                    userTableResults.push(`USER_TABLE: 해당 user_key에 대한 데이터가 없습니다: ${data.user_key}`);
                }
            } catch (error) {
                console.error(`USER_TABLE: 조회 실패`, error);
            }



            console.log({
                mongo_db: historyTableResults,
                dynamo_db: {
                    user:userTableResults,
                    record:recordTableResults,
                    device:deviceTableResults
                },
                s3_bucket: s3Results
            })



            // 결과 응답
            res.status(200).json({
                mongo_db: historyTableResults,
                dynamo_db: {
                    user:userTableResults,
                    record:recordTableResults,
                    device:deviceTableResults
                },
                s3_bucket: s3Results
            });

        },

        addDeviceId(req,res){
            const data  = req.body
            const token = req.headers['token']

            Client.connect(MONGO_URI)
                .then(tableFind => {
                    return tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
                        .then(contracts => {
                            const tokenVerify = jwt.verify(token, AWS_TOKEN);

                            const exists = contracts.some(contract => {
                                const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
                                return deviceIds.includes(data.device_id.toLowerCase());
                            });

                            if (exists) {
                                console.log('Duplicate device_id');
                                res.status(400).send('Duplicate device_id');
                                return; // early return
                            }

                            return tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({ user_key: tokenVerify.user_key })
                                .then(findData => {
                                    if (!findData) {
                                        console.log('No data found for user_key');
                                        res.status(404).send('User data not found');
                                        return; // early return
                                    }

                                    return tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
                                        { user_key: tokenVerify.user_key },
                                        {
                                            $set: {
                                                device_id: findData.device_id ? findData.device_id + "," + data.device_id.toLowerCase() :
                                                    data.device_id.toLowerCase()
                                            }
                                        },
                                        { returnDocument: 'after' } // 업데이트 후의 문서를 반환하도록 설정
                                    ).then(updatedData => {
                                        // 업데이트된 데이터가 없으면 처리
                                        if (!updatedData.value) {
                                            res.status(404).json({ msg: 'Data not found after update' });
                                            return;
                                        }

                                        res.status(200).json({
                                            msg: `Add a device_id saved Success`,
                                            target: {
                                                id: updatedData.value.id, // 업데이트된 데이터에서 id 가져오기
                                                name: updatedData.value.name, // 업데이트된 데이터에서 name 가져오기
                                                device_id: data.device_id.toLowerCase(),
                                            },
                                            checkData: updatedData.value // 업데이트된 데이터를 바로 사용
                                        });
                                    });
                                });
                        })
                        .finally(() => {
                            tableFind.close(); // 모든 작업 완료 후 연결 종료
                        });
                })
                .catch(error => {
                    console.error('Error occurred:', error);
                    res.status(500).send('Internal Server Error');
                });
        },


        saveDeivceId(req, res) {
            const data = req.body;
            Client.connect(MONGO_URI)
                .then(tableFind => {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({
                        user_key: data.user_key
                    })
                        .then(findData => {
                            // findData.device_id가 null인 경우 처리
                            if (!findData.device_id || findData.device_id === "") {
                                // device_id가 null이면 새 device_id를 저장
                                tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
                                    { user_key: data.user_key },
                                    { $set: { device_id: data.device_id.toLowerCase() } }
                                )
                                    .then(suc => {
                                        console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`);
                                        res.status(200).send('success');
                                        tableFind.close();
                                    })
                                    .catch(err => {
                                        console.error('Error updating device_id:', err);
                                        res.status(500).send('Error updating device_id');
                                    });
                            } else {
                                const dataArray = findData.device_id.toLowerCase().split(',');
                                if (dataArray.includes(data.device_id.toLowerCase())) {
                                    res.status(200).send(`device_id:${data.device_id.toLowerCase()} - This is already saved device_id`);
                                } else {
                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
                                        { user_key: data.user_key },
                                        { $set: { device_id: findData.device_id + "," + data.device_id.toLowerCase() } }
                                    )
                                        .then(suc => {
                                            console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`);
                                            res.status(200).send('success');
                                            tableFind.close();
                                        })
                                        .catch(err => {
                                            console.error('Error updating device_id:', err);
                                            res.status(500).send('Error updating device_id');
                                        });
                                }
                            }
                        })
                        .catch(err => {
                            console.error('Error finding data:', err);
                            res.status(500).send('Error finding data');
                        });
                })
                .catch(err => {
                    console.error('Error connecting to MongoDB:', err);
                    res.status(500).send('Error connecting to MongoDB');
                });
        },



        saveUserKey(req,res){
            const data = req.body
            //데이터 유저키,아이디 등등 없을때 에러 저장 로직 추가하기
            const bodyData = data.bodyData
            const userData = data.userData

            new AwsLogin({...bodyData,id:bodyData.user_id,up_key:bodyData.upKey}).save()
                .then(suc=>{
                    console.log(`${bodyData.user_id} - Login-log Save Success`)
                })
                .catch(err=>{
                    console.log(err)
                    console.log(`${bodyData.user_id} - Login-log Save Fail`)
                })

            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({id:bodyData.user_id})
                        .then(findData=>{
                            if(findData.user_key === null){
                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({id:bodyData.user_id},
                                        {$set:{
                                                user_key:userData.user_key
                                            }})
                                        .then(findsData=>{
                                            let eaglesSave= {
                                                id:bodyData.user_id,
                                                user_key:userData.user_key
                                            }

                                            this.eaglesSafesOverseasSave("saveUserKey",eaglesSave)
                                            console.log(`Login-id:${bodyData.user_id}- user_key Save Success`)
                                            res.status(200).send('success')
                                            tableFind.close()
                                        })
                                        .catch(err=>{
                                            console.log(err)
                                            res.status(400).send(err)
                                            tableFind.close()
                                        })
                            }else{
                                    console.log(`Login-id:${bodyData.user_id}- This is already saved user_key`)
                                    res.status(200).send('Saved user_key')
                                tableFind.close()
                            }
                        })
                        .catch(err=>{
                            console.log(err)
                            res.status(400).send(err)
                            tableFind.close()
                        })


                })
                .catch(err=>{
                    res.status(400).send(err)
                })
        },

        testToken(req,res){
          const data = req.body
            console.log(AWS_TOKEN)
          const token = jwt.sign({user_key:data.user_key},AWS_TOKEN)
          res.status(200).send(token)
        },

        //a4:da:22:12:34:57
        userKeyTest(req, res) {
            //let data = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+eg3kjvx9QT2bxJOvakrlZT:APA91bFS8Xa6eyDsGW6qBSdiQS--Wf9rCtfGTCijRK698r3e1YA8B6Oanlo61EvJ0PsgBTQFrJnDVyxuBagSM2A1iVxlrOWoXqPZEOxRz5WxdvgTy_p48wkUxii_okpTwKAtiGHMSFSe+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"


            //let resss = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+fl95091gTVqc1p4x6gKSUx:APA91bH_YPCkvP8acaM74RHvXc060t4-G-o3a5lmnsCeyuLPJO4Ec_oXsoBQ7zIUSzqXdIU6u5BciROxmlR3Mwo_y-dwKrL9kmRh-mzq9b3Zs8YP-MJMWdHxRjnOQ0LCVS5LLNmrntSV+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"
            // uuid가 data에 포함되어 있는지 확인

            let uuid = "PPR1.180610.011"
            let fcm = "fl95091gTVqc1p4x6gKSUx:APA91bH_YPCkvP8acaM74RHvXc060t4-G-o3a5lmnsCeyuLPJO4Ec_oXsoBQ7zIUSzqXdIU6u5BciROxmlR3Mwo_y-dwKrL9kmRh-mzq9b3Zs8YP-MJMWdHxRjnOQ0LCVS5LLNmrntSV";
            const changeData = fcm+`+${uuid}+`
            let dbData = "dmitc1IsSUmM2vBRxG49Ev:APA91bFzGHhczyTlAXxaB7C7p78m5Fut4F2re08KmZP5hhcvgrQJ67GuDptf-SVImWS_8ODB5d-EW_P2t8CSyrKnRUeI-kfpSrvtJ0LYFiyxkwCVlF3LvaYLdJCzDpf2hCZj309VPwCe+QP1A.190711.020+eg3kjvx9QT2bxJOvakrlZT:APA91bFS8Xa6eyDsGW6qBSdiQS--Wf9rCtfGTCijRK698r3e1YA8B6Oanlo61EvJ0PsgBTQFrJnDVyxuBagSM2A1iVxlrOWoXqPZEOxRz5WxdvgTy_p48wkUxii_okpTwKAtiGHMSFSe+PPR1.180610.011+cVg26F6_RbGAuMtOj_6B2o:APA91bH-8hy8hyifq2deB6QOIIWqUWjE481ldAvzY4hHFvOH_3BbZYNpX-UvuCpdPOI00ue6rMLL3tLXWrK7mC3V3qLEUh4O3daAqxRzvM5eTBMgl3cSbYvOtkn2xTEjxaZ2BqUvURhG+TP1A.220624.014+"

            let fcm_token_data;


            if (dbData.includes(`+${uuid}+`)) {
                // '+'를 구분자로 데이터 분리
                let listData = dbData.split("+");
                // uuid를 포함하는 인덱스를 찾고 해당 부분 제거
                for (let i = 1; i < listData.length; i += 2) {
                    if (listData[i] === uuid) {
                        listData.splice(i - 1, 2); // fcm과 uuid 제거
                        break; // 일치하는 첫 번째 항목만 제거
                    }
                }
                // 변경된 데이터를 다시 합치기
                fcm_token_data = listData.join("+") + changeData;
            } else {
                fcm_token_data = dbData + changeData;
            }



            res.status(200).send(fcm_token_data)
        },


        findAWS(req,res){
            const token = req.headers['token']
            let client;  // 👉 클라이언트 객체를 외부에 저장

            if(token !== undefined){
                const tokenVerify = jwt.verify(token,AWS_TOKEN)
                console.log(tokenVerify)
                // // 테이블 스캔 함수
                const scanTable = async (tableName, filterExpression, expressionAttributeValues) => {
                    const params = {
                        TableName: tableName,
                        FilterExpression: filterExpression,
                        ExpressionAttributeValues: expressionAttributeValues
                    };

                    try {
                        const data = await dynamoDB.scan(params).promise();
                        return data.Items;
                    } catch (error) {
                        console.error('Error scanning table:', error);
                        return [];
                    }
                };


                const tableName = 'DEVICE_TABLE'; // 조회하려는 DynamoDB 테이블 이름
                const filterExpression = 'user_key = :user_key'; // 필터 조건 (여러 조건을 추가할 수 있음)
                const expressionAttributeValues = {
                    ':user_key': tokenVerify.user_key // 필터 조건에 해당하는 값
                };

                scanTable(tableName, filterExpression, expressionAttributeValues).then(items => {
                    Client.connect(MONGO_URI)
                        .then(tableFind=> {
                            client = tableFind; // 👉 클라이언트 객체 저장
                            tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key:tokenVerify.user_key})
                                .then(findData=>{
                                    console.log(items)
                                    console.log(findData)
                                    let check = []
                                    items.map(e=>{
                                        check.push(e.device_id)
                                    })
                                    console.log(check)
                                    let excludedDeviceIds = []
                                    if(findData.device_id !== null){
                                        let splitData = findData.device_id.split(',')
                                        excludedDeviceIds = splitData.filter(id => !check.includes(id));
                                    }

                                    res.status(200).json({msg:'Data query successful',
                                        unconnectDeviceId:excludedDeviceIds,
                                        openingData:findData,connectData:items})

                                })
                                .catch(err=>{
                                    console.log(err)
                                    res.status(400).send(err)
                                })
                                .finally(() => {
                                    if (client) {
                                        console.log("✅ MongoDB Connection closed.");
                                        client.close(); // ✅ 종료 확실하게 처리
                                    }
                                });

                        })
                    // if (items.length > 0) {
                    //
                    //
                    // } else {
                    //     res.status(400).json({msg:'The data is not available.',data:undefined})
                    // }
                });
            }else{
                res.status(400).send('Header has no token value, please check again.')
            }

        },


        findLog(req,res){
            apiLogs.find({}).sort({"date":-1})
                .then(findData=>{
                    res.status(200).send(findData)
                })
        },




        // param=create, bodyData = { device_id: "" ,name: "" ,phone: "" }
        // param=del, bodyData = { device_id: "" }
        // param=find, bodyData = { device_id: ""}

        face_register(req,res){
            const params = req.query.contents
            const data = req.body

            if(params === 'create'){
                Face.find({device_id:data.device_id, phone:data.phone})
                    .then(findData=>{
                        const saveTime = moment().tz('Asia/Seoul')
                        let filterData = []
                        if(findData.length >= 10){
                            res.status(400).send(`Saved Data Exceed`)
                        }else{
                            if(findData.length >= 1){
                                let duplicateState = false

                                findData.map(e=>{
                                    if(e.name === data.name){
                                       duplicateState = true
                                    }else{
                                        if(filterData.length === 0){
                                            filterData.push(e)
                                        }else{
                                            filterData.map(fd=>{
                                                if(e.index > fd.index){
                                                    filterData[0] = e
                                                }
                                            })
                                        }
                                    }
                                })

                                if(duplicateState === true){
                                    res.status(400).send('Duplicated Name')
                                }else{
                                    let savedData = {
                                        device_id: data.device_id,
                                        name:data.name,
                                        phone:data.phone,
                                        index:filterData[0].index + 1,
                                        date:saveTime.format('YYYY_MM_DD.kk:mm:ss')
                                    }
                                    new Face(savedData).save()
                                        .then(r=>res.status(200).send('Saved Data Completed'))
                                        .catch(err=>
                                        {
                                            res.status(400).send(err)
                                        })
                                }

                            }else{
                                let saveData = {
                                    device_id: data.device_id,
                                    name:data.name,
                                    phone:data.phone,
                                    index:1,
                                    date:saveTime.format('YYYY_MM_DD.kk:mm:ss')
                                }
                                new Face(saveData).save()
                                    .then(r=>res.status(200).send('Saved Data Completed'))
                                    .catch(err=> res.status(400).send(err))
                            }

                        }
                    })
                    .catch(err=>{
                            res.status(400).send(err)
                    })
            }
            if(params === 'del'){
                Face.find({device_id:data.device_id})
                    .then(findData=>{
                        if(findData.length === 0){
                            res.status(400).send('No data to delete.')
                        }else{
                            Face.deleteMany({device_id:data.device_id})
                                .then(dbs=>{
                                    res.status(200).send(`${data.device_id} deleted`)
                                })
                                .catch(err=>{
                                    res.status(400).send(err)
                                })
                        }
                    })

            }
            if(params === 'find'){
                Face.find({device_id:data.device_id}).sort({"date":-1})
                    .then(findData=>{
                        if(findData.length === 0){
                            res.status(400).send('No data to find')
                        }else{
                            res.status(200).send(findData)
                        }
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }
        },
        //{id:xx, tel:xx}
        start_up(req, res) {
            const data = req.body
            let client; // 👉 클라이언트 객체를 외부에 저장
            Client.connect(MONGO_URI)
                .then(dbs => {
                    client = dbs;  // 👉 클라이언트 저장

                    let database = dbs.db(ADMIN_DB_NAME)
                    database.collection('tables').find({id: data.id, tel: data.tel}).toArray().then(data => {
                        if (data.length === 0) {
                            res.status(400).send('해당하는 가입정보가 없습니다. 개통 완료 후 이용해주세요.')
                        } else {
                            res.status(200).send(data)
                        }
                    })
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                    res.status(500).send('Database error');
                })
                .finally(() => {
                    if (client) {
                        console.log("✅ DB Connection closed.");
                        client.close(); // ✅ 무조건 종료
                    }
                });
        },


        getAWSLogs(req, res) {
            const opens = moment().tz('Asia/Seoul')
            console.log(req.body)
            console.log(opens.format('YYYY-MM-DD_A:hh:mm:ss'))
            if (awsLogsData.length === 10) {
                awsLogsData.pop()
                awsLogsData.unshift(req.body)
            } else {
                awsLogsData.unshift(req.body)
            }
        },

        getAwsLogHistory(req, res) {
            res.status(200).send(awsLogsData)
        },

        getHistory(req, res) {
            history().historiesData(req, res)
        },

        saveHistory(req, res) {
            history().saveHistory(req, res)
        },


        findDeviceInfo(req, res) {
            let device_id = req.query.device_id;
            const getParams = {
                TableName: 'DEVICE_TABLE', // 테이블 이름을 적절히 변경하세요
                Key: {
                    device_id: device_id,
                    user_key: req.headers['token'] !== undefined ? jwt.verify(req.headers['token'],AWS_TOKEN).user_key:req.headers['user_key']
                }
            };
            console.log({
                device_id:device_id,
                user_key: req.headers['token'] !== undefined ? jwt.verify(req.headers['token'],AWS_TOKEN).user_key:req.headers['user_key']
            })
            // 데이터 조회
            dynamoDB.get(getParams, (err, result) => {
                if (err) {
                    console.error('Error getting item:', err);
                    return res.status(500).json({ error: 'Could not get item', data: err });
                }

                if (!result.Item) {
                    return res.status(404).json({ error: 'Item not found' });
                }

                res.status(200).json(result.Item);
            });
        },


        async saveDeviceInfo(req, res) {
            const data = req.body;
            console.log(data);

            // 기본 UpdateExpression 및 ExpressionAttributeValues 설정
            let updateExpression = `set wifi_quality = :wifi_quality, privacy = :privacy, firmware = :firmware`;
            let expressionAttributeValues = {
                ':wifi_quality': data.wifi_quality,
                ':privacy': data.privacy,
                ':firmware': data.firmware,
            };

            // 만약 키가 존재하면 UpdateExpression 및 ExpressionAttributeValues에 추가
            if (data.ac !== undefined) {
                updateExpression += ', ac = :ac';
                expressionAttributeValues[':ac'] = data.ac;
            }
            if (data.pir !== undefined) {
                updateExpression += ', pir = :pir';
                expressionAttributeValues[':pir'] = data.pir === null ? null : Number(data.pir);
            }
            if (data.battery_status !== undefined) {
                updateExpression += ', battery_status = :battery_status';
                expressionAttributeValues[':battery_status'] = data.battery_status === null ? null : Number(data.battery_status);
            }

            const key = {
                device_id: data.device_id,
                user_key: data.user_key
            };

            // 먼저 해당 항목이 존재하는지 확인
            const getParams = {
                TableName: 'DEVICE_TABLE',
                Key: key
            };

            try {
                const getResult = await dynamoDB.get(getParams).promise();

                // 항목이 존재하는 경우에만 업데이트 수행
                if (getResult.Item) {
                    const params = {
                        TableName: 'DEVICE_TABLE',
                        Key: key,
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ReturnValues: 'ALL_NEW'
                    };

                    const result = await dynamoDB.update(params).promise();
                    res.json({
                        message: 'Device data updated successfully',
                        data: result.Attributes
                    });
                } else {
                    // 항목이 존재하지 않을 경우 무시
                    console.log('Device data not found, update ignored.');
                    res.status(404).json({ message: 'Device data not found, update ignored.' });
                }
            } catch (error) {
                console.error('Error updating device data:', error);
                res.status(500).json({ error: 'Could not update device data' });
            }
        },


        getService(req, res) {
            console.log('get...')
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const today = semiDate.today()
            const connectDate = semiDate.connectDate()

            res.send(`@@@@@ ${today} 서버 ON 접속 IP: ${ip} @@@@@ 서버오픈 ${openDay} @@@@@`)
            const logDb = {log: `API::GET::${connectDate}::${ip}::${logOpenDay}::/getSign`,date:semiDate.logDate()}

            new apiLogs(logDb).save()
                .then(r => console.log('Log data Save...'))
                .catch(err => console.log('Log Save Error', err))
        },

        //디바이스 fileName용 Date
        deviceVideoDate(req, res) {
            const opens = moment().tz('Asia/Seoul')
            const date = opens.format('YYYY_MM_DD_HH_mm_ss')
            res.status(200).send(date)
        },

        //device_id로 유저키 찾는 API
        //data = { device_id: device_id값 }
        async dynamoUserKey(req, res) {
            const data = req.body
            const client = new DynamoDB({AWS_REGION})
            const tableData = await client.scan({
                TableName: 'DEVICE_TABLE',
                Key: {'device_id': data.device_id}
            })
            const items = tableData.Items

            let db = [];

            items.map(e => {
                if (e.device_id.S === data.device_id) {
                    db.push(e.user_key.S)
                }
            })

            if (db.length === 0) {
                res.status(400).send('해당 device_id로 일치하는 값이 없습니다.')
            } else {
                res.status(200).send(db)
            }

        },


        async sendFindServiceEmail(req, res) {
            const data = req.body;

            const sendMailPromise = (transporter, mailOptions) => {
                return new Promise((resolve, reject) => {
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Email send error:", error);
                            return reject(error.message);
                        } else {
                            console.log("Email sent:", info.response);
                            return resolve(info.response);
                        }
                    });
                });
            };

            if (!["id", "pw"].includes(data.service)) {
                return res.status(400).send('Invalid service type');
            }

            const client = await Client.connect(MONGO_URI);

            try {
                const db = client.db(ADMIN_DB_NAME);
                const query = data.service === "id" ? { email: data.email } : { id: data.user_id, email: data.email };

                const findData = await db.collection("tables").findOne(query);
                if (!findData) {
                    return res.status(404).send('Not Found Data');
                }

                const findAuth = await AuthNumDB.findOne({ email: data.email });
                if (findAuth) {
                    return res.status(400).send('Email already requested for authentication');
                }

                const transporter = nodemailer.createTransport({
                    service: NODEMAILER_SERVICE,
                    host: NODEMAILER_HOST,
                    port: 587,
                    secure: false,
                    auth: {
                        user: NODEMAILER_USER,
                        pass: NODEMAILER_PASS
                    }
                });

                const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

                const mailOptions = {
                    from: `MyRucell`,
                    to: data.email,
                    subject: `[MyRucell] This is an email authentication number service.`,
                    text: `Hello, please check the authentication number below to complete the authentication of your email address.\nAuthentication number: ${authNum} \nThis authentication number is valid for 3 minutes.`
                };

                // ✅ sendMail이 끝날 때까지 기다림
                await sendMailPromise(transporter, mailOptions);

                // ✅ 인증 정보를 DB에 저장
                await new AuthNumDB({
                    email: data.email,
                    user_id: data.service === "id" ? findData.id : data.user_id,
                    num: authNum,
                    expires: new Date(new Date().getTime() + 3 * 60 * 1000)
                }).save();

                res.send('ok');

            } catch (error) {
                console.error("Error in sendFindServiceEmail:", error);
                res.status(500).send('Internal Server Error');
            } finally {
                // ✅ 모든 처리가 완료된 후에만 DB 연결을 닫음
                await client.close();
            }
        },

        async checkFindAuth(req,res){
            const data = req.body;
            if (!["id", "pw"].includes(data.service)) {
                return res.status(400).send('Invalid service type');
            }
            // ✅ 인증번호 형식 체크 (6자리 숫자)
            if (!/^\d{6}$/.test(data.auth.trim())) {
                return res.status(400).send("Invalid authentication number format");
            }
            try {
                const query = data.service === "id" ? { email: data.email } : { user_id: data.user_id, email: data.email };
                const findAuth = await AuthNumDB.findOne(query);
                if (findAuth) {
                    if(String(data.auth).trim() === findAuth.num){
                        await AuthNumDB.findOneAndDelete(query);
                        return res.status(200).send(data.service === "id" ? findAuth.user_id:true)
                    }else{
                        res.status(400).send("Authentication number mismatch")
                    }
                }else{
                    return res.status(404).send(false);
                }
            }catch(err){
                console.error("Error in checkFindAuth:", err);
                res.status(500).send('Internal Server Error',err);
            }

        },

        async sendEmail(req, res) {
            const data = req.body;
            let client;

            try {
                client = await Client.connect(MONGO_URI);
                const db = client.db(ADMIN_DB_NAME).collection("tables");

                const findUser = await db.findOne({ id: data.user_id });
                if (findUser) {
                    return res.status(400).send('Duplicate user_id');
                }

                const findEmail = await db.findOne({ email: data.email });
                if (findEmail) {
                    return res.status(400).send('Duplicate email address');
                }

                const findEmails = await AuthNumDB.findOne({ email: data.email });
                if (findEmails) {
                    return res.status(400).send('email requested for authentication');
                }

                const findUserIds = await AuthNumDB.findOne({ user_id: data.user_id });
                if (findUserIds) {
                    return res.status(400).send('user_id requested for authentication');
                }

                const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

                const transporter = nodemailer.createTransport({
                    service: NODEMAILER_SERVICE,
                    host: NODEMAILER_HOST,
                    port: 587,
                    secure: false,
                    auth: {
                        user: NODEMAILER_USER,
                        pass: NODEMAILER_PASS
                    }
                });

                const mailOptions = {
                    from: `MyRucell`,
                    to: data.email,
                    subject: `[MyRucell] This is an email authentication number service.`,
                    text: `Hello, please check the authentication number below to complete the authentication of your email address.\nAuthentication number: ${authNum} \nThis authentication number is valid for 3 minutes.`
                };

                transporter.sendMail(mailOptions, async (error, info) => {
                    if (error) {
                        return res.status(400).send(error);
                    }

                    await new AuthNumDB({
                        email: data.email,
                        user_id: data.user_id,
                        num: authNum,
                        expires: new Date(new Date().getTime() + 3 * 60 * 1000)
                    }).save();

                    res.send('ok');
                });

            } catch (error) {
                console.error('Error in sendEmail:', error);
                res.status(500).send('Server Error');
            } finally {
                if (client) {
                    console.log("✅ DB Connection closed.");
                    client.close(); // ✅ 여기서만 닫기
                }
            }
        },
        // async sendEmail(req, res) {
        //     const data = req.body
        //     let client;  // 👉 클라이언트 객체를 외부에 저장
        //     Client.connect(MONGO_URI)
        //         .then(tableFind=> {
        //             client = tableFind;  // 👉 클라이언트 저장
        //             tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({id:data.user_id})
        //                 .then(findData=>{
        //                     if(!findData){
        //                         tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({email:data.email})
        //                             .then(async findEmail => {
        //                                 if (!findEmail) {
        //                                     AuthNumDB.findOne({email:data.email})
        //                                         .then(findEmails=>{
        //                                             if(!findEmails){
        //                                                 AuthNumDB.findOne({user_id:data.user_id})
        //                                                     .then(async findUserIds => {
        //                                                         if (!findUserIds) {
        //                                                             const transporter = nodemailer.createTransport({
        //                                                                 service: NODEMAILER_SERVICE,
        //                                                                 host: NODEMAILER_HOST,
        //                                                                 port: 587,
        //                                                                 secure: false,
        //                                                                 auth: {
        //                                                                     user: NODEMAILER_USER,
        //                                                                     pass: NODEMAILER_PASS
        //                                                                 }
        //                                                             });
        //
        //                                                             const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
        //
        //                                                             const mailOptions = {
        //                                                                 from: `MyRucell`,
        //                                                                 to: data.email,
        //                                                                 subject: `[MyRucell] This is an email authentication number service.`,
        //                                                                 text: `Hello, please check the authentication number below to complete the authentication of your email address.\nAuthentication number: ${authNum} \nThis authentication number is valid for 3 minutes.`
        //                                                             };
        //                                                             transporter.sendMail(mailOptions, function (error,info) {
        //                                                                if(error){
        //                                                                    res.status(400).send(error)
        //                                                                }else{
        //                                                                    new AuthNumDB({
        //                                                                        email: data.email,
        //                                                                        user_id: data.user_id,
        //                                                                        num: authNum,
        //                                                                        expires: new Date(new Date().getTime() + 3 * 60 * 1000)
        //                                                                    }).save()
        //                                                                    res.send('ok');
        //                                                                }
        //                                                             })
        //                                                             transporter.close()
        //                                                         } else {
        //                                                             res.status(400).send('user_id requested for authentication')
        //                                                         }
        //                                                     })
        //                                             }else{
        //                                                 res.status(400).send('email requested for authentication')
        //                                             }
        //                                         })
        //
        //                                 } else {
        //                                     res.status(400).send('Duplicate email address')
        //                                 }
        //                             })
        //
        //                     }else{
        //                         res.status(400).send('Duplicate user_id')
        //                     }
        //                 })
        //         })
        //
        // },

        checkAuthNum(req,res){
            const data = req.body
            AuthNumDB.findOne({user_id:data.user_id.trim(),email:data.email.trim()})
                .then(async findData => {
                    if (findData) {
                        if (String(data.auth).trim() === findData.num) {
                            await AuthNumDB.findOneAndDelete({user_id: data.user_id.trim(), email: data.email.trim()});
                            res.status(200).send(true)
                        } else {
                            res.status(400).send("Authentication number mismatch")
                        }
                    } else {
                        res.status(400).send(false)
                    }
                })

        },


        sendSms(req, res) {
            const phoneNumber = req.body.phone
            const phoneSubject = req.body.subject
            const date = Date.now().toString()

            //환경변수들
            const serviceId = SMS_service_id;
            const secretKey = SMS_secret_key;
            const accessKey = SMS_access_key;
            const smsPhone = SMS_PHONE;

            //그외
            const method = "POST";
            const space = " ";
            const newLine = "\n";
            const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
            const url2 = `/sms/v2/services/${serviceId}/messages`;

            //signature 작성 : crypto-js 모듈을 이용하여 암호화
            const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
            hmac.update(method);
            hmac.update(space);
            hmac.update(url2);
            hmac.update(newLine);
            hmac.update(date);
            hmac.update(newLine);
            hmac.update(accessKey);
            const hash = hmac.finalize();
            const signature = hash.toString(CryptoJS.enc.Base64);

            //인증번호 생성 및 토큰생성
            let authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

            axios({
                method: method,
                json: true,
                url: url,
                headers: {
                    "Contenc-type": "application/json; charset=utf-8",
                    "x-ncp-iam-access-key": accessKey,
                    "x-ncp-apigw-timestamp": date
                    ,
                    "x-ncp-apigw-signature-v2": signature,
                },
                data: {
                    type: "SMS",
                    countryCode: "82",
                    from: smsPhone,
                    content: `[DoorbellSquare]\n [${phoneSubject} 서비스]\n 인증번호는 [${authNum}] 입니다.`,
                    messages: [{to: `${phoneNumber}`}],
                },
            });
            return res.status(200).json({msg: '인증번호가 전송되었습니다. 인증번호 유효시간은 3분입니다.', data: authNum})
        },


        niceApi(req, res) {

            const data = req.body

            const productCode = NICE_PRODUCT_CODE
            const client_token = NICE_ACCESS_TOKEN
            const client_id = NICE_CLIENT_ID
            const client_secret = NICE_CLIENT_SECRET
            const nowTime = new Date().getTime() / 1000


            const encoded = (text) => {
                return Buffer.from(text, "utf8").toString('base64');
            }


            //토큰이 0일때 => api사용
            if (data.token === 0) {
                const auth = `${client_token}:${nowTime}:${client_id}`
                axios({
                    url: 'https://svc.niceapi.co.kr:22001/digital/niceid/api/v1.0/common/crypto/token',
                    data: data,
                    headers: {
                        "Content-Type": 'application/json',
                        "Authorization": "Basic " + encoded(auth),
                        "client_id": client_id,
                        "ProductID": productCode
                    }

                })

            }
            //토큰이 1일때 => 토큰 새로생성
            if (data.token === 1) {
                const auth = `${client_id}:${client_secret}`

                axios.post('https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token',
                    qs.stringify({'grant_type': 'client_credentials', 'scope': 'default'}),
                    {
                        headers: {
                            "Content-Type": 'application/x-www-form-urlencoded;charset=utf-8',
                            "Authorization": "Basic " + encoded(auth)
                        }
                    }
                )
                    .then(resData => {
                        console.log('success')
                        res.status(200).send(resData.data)
                    })
                    .catch(err => {
                        console.log('fail...')
                        console.log(err)
                        res.status(400).send(err)
                    })
            }

            //토큰이 2일때 => 토큰 삭제
            if (data.token === 2) {
                const auth = `${client_token}:${nowTime}:${client_id}`

                axios({
                    method: 'post',
                    url: 'https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token/revokeById',
                    headers: {
                        "Content-Type": 'application/x-www-form-urlencoded;charset=utf-8',
                        "Authorization": "Basic " + encoded(auth)
                    }
                })
                    .then(resData => {
                        res.status(200).send(resData.data)
                    })
                    .catch(err => {
                        res.status(400).send(err)
                    })

            }


        },




    }
}

module.exports = api