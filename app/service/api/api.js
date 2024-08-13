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
    AWS_TOKEN,NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_SERVICE, NODEMAILER_HOST,
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

        deleteRecord(deviceInfo){

        },
        deleteDevice(deviceInfo){
            const DEVICE_TABLE = 'DEVICE_TABLE';
            const params = {
                TableName: DEVICE_TABLE,
                Key: {
                    device_id: deviceInfo.lowerDeviceId,
                    user_key : deviceInfo.user_key,
                }
            };
        },

        cutToken(req,res){
            let basicToken = "faapkBxtRPaV4s-3Uy_mkp:APA91bGg2L7ppqfhCg4qiUGIuuvkz1MJ5wS_7wKprf-UnV8qYV2WUoszUsNAcm4POZ97SqArrCX7U2n_6U3PBUo7-Gj-AS9BDJkD-m1GMPEsmOcBnEDS9oytWSqVA9l8jfLWNO89XDO_+UP1A.231005.007+ekAxG03CSc6j8nz1qe6kRp:APA91bGg2L7ppqfhCg4qiUGIuuvkz1MJ5wS_7wKprf-UnV8qYV2WUoszUsNAcm4POZ97SqArrCX7U2n_6U3PBUo7-Gj-AS9BDJkD-m1GMPEsmOcBnEDS9oytWSqVA9l8jfLWNO89XDO_+TP1A.220624.014+e0OHQkYfS8a8ivFcEh12IU:APA91bFsf7BcwUy-SF2rTStX0y42kkeaUVWD9_FmSX6ZnNyGxyf1r3r11uu80YPW7i7IA0ZQjymW55WrDfRXxIISgpsKXy0cGqxgVTN73qBs33jUgNWXGsAO-p9y-XL2gwdrmyGcR-_3+QP1A.190711.020+";
            let fcm_token = "faapkBxtRPaV4s-3Uy_mkp:APA91bGg2L7ppqfhCg4qiUGIuuvkz1MJ5wS_7wKprf-UnV8qYV2WUoszUsNAcm4POZ97SqArrCX7U2n_6U3PBUo7-Gj-AS9BDJkD-m1GMPEsmOcBnEDS9oytWSqVA9l8jfLWNO89XDO_";

            let check = basicToken.split('+')

            let index = check.indexOf(fcm_token);
            if (index !== -1) {
                // 인덱스가 유효한 경우에만 삭제
                check.splice(index, 1); // fcm_token 삭제
                if (index < check.length) {
                    check.splice(index, 1); // 다음 요소도 삭제
                }
            }

            res.status(200).send(check.join('+'))
        },

        deleteDeviceId(req,res){
            const data = req.body
            const lowerDeviceId = data.device_id.toLowerCase()
            const token = req.headers['token']
            const DEVICE_TABLE = 'DEVICE_TABLE'; // 실제 테이블 이름으로 변경
            const RECORD_TABLE = 'RECORD_TABLE'; // 실제 테이블 이름으로 변경
            const USER_TABLE = 'USER_TABLE'; // 사용자 정보 테이블 이름
            const BUCKET_NAME = 'doorbell-video'; // S3 버킷 이름
            const s3 = new AWS.S3();
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    if(token === undefined){
                        res.status(400).send('Token not found.');
                    }else{
                        const verify = jwt.verify(token, process.env.AWS_TOKEN);
                        tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({user_key:verify.user_key})
                            .then(findUser=>{
                                if(findUser){
                                    let findData = {
                                        user_key:findUser.user_key,
                                        device_id:data.device_id,
                                        fcm_token:data.fcm_token
                                    }
                                    let updatedDeviceIds = findUser.device_id.split(',').filter(id => id !== lowerDeviceId).join(',');

                                    // // device_id가 빈 문자열이면 null로 설정
                                    if (updatedDeviceIds === '') {
                                        updatedDeviceIds = null;
                                    }
                                    tableFind.db(ADMIN_DB_NAME).collection('tables')
                                        .updateOne({ _id: findUser._id },{ $set: { device_id: updatedDeviceIds }})
                                        .then(succ=>{
                                            tableFind.db(ADMIN_DB_NAME).collection('tables')
                                                .findOne({ _id: findUser._id })
                                                .then(lastData=>{
                                                    History.deleteMany({device_id:lowerDeviceId})
                                                        .then(async succe => {
                                                            const { user_key, device_id } = findData;
                                                            const responseMsg = {
                                                                DEVICE_TABLE: {},
                                                                RECORD_TABLE: {},
                                                                USER_TABLE: {},
                                                                S3: {}
                                                            };

                                                            // 1. DEVICE_TABLE에서 삭제
                                                            const deviceDeleteParams = {
                                                                TableName: DEVICE_TABLE,
                                                                Key: {
                                                                    device_id: device_id,
                                                                    user_key: user_key
                                                                }
                                                            };

                                                            try {
                                                                await dynamoDB.delete(deviceDeleteParams).promise();
                                                                responseMsg.DEVICE_TABLE.complete = device_id;
                                                                console.log(`DEVICE_TABLE: 삭제성공 deviceId: ${device_id} userKey: ${user_key}`);
                                                            } catch (error) {
                                                                responseMsg.DEVICE_TABLE.false = device_id;
                                                                responseMsg.DEVICE_TABLE.err = error.message;
                                                                console.error(`DEVICE_TABLE: 삭제 실패`, error);
                                                            }

                                                            // 2. RECORD_TABLE에서 삭제
                                                            const recordScanParams = {
                                                                TableName: RECORD_TABLE,
                                                                KeyConditionExpression: 'device_id = :device_id',
                                                                ExpressionAttributeValues: {
                                                                    ':device_id': device_id
                                                                }
                                                            };

                                                            try {
                                                                const recordScanResult = await dynamoDB.query(recordScanParams).promise();
                                                                if (recordScanResult.Items.length > 0) {
                                                                    const deletePromises = recordScanResult.Items.map(record => {
                                                                        const deleteParams = {
                                                                            TableName: RECORD_TABLE,
                                                                            Key: {
                                                                                device_id: record.device_id,
                                                                                file_location: record.file_location // 정렬 키
                                                                            }
                                                                        };
                                                                        return dynamoDB.delete(deleteParams).promise().then(() => {
                                                                            console.log(`RECORD_TABLE: 삭제성공 deviceId: ${record.device_id} fileLocation: ${record.file_location}`);
                                                                        }).catch(error => {
                                                                            responseMsg.RECORD_TABLE.false = record.device_id;
                                                                            responseMsg.RECORD_TABLE.err = error.message;
                                                                        });
                                                                    });

                                                                    await Promise.all(deletePromises);
                                                                    responseMsg.RECORD_TABLE.complete = device_id;
                                                                } else {
                                                                    responseMsg.RECORD_TABLE.nodata = device_id;
                                                                    console.log(`RECORD_TABLE: 삭제할 데이터 없음 deviceId: ${device_id}`);
                                                                }
                                                            } catch (error) {
                                                                responseMsg.RECORD_TABLE.err = error.message;
                                                                console.error(`RECORD_TABLE: 삭제 실패`, error);
                                                            }

                                                            // 3. USER_TABLE에서 fcm_token 조회
                                                            const userScanParams = {
                                                                TableName: USER_TABLE,
                                                                Key: {
                                                                    user_key: user_key
                                                                }
                                                            };

                                                            try {
                                                                const userScanResult = await dynamoDB.get(userScanParams).promise();
                                                                if (userScanResult.Item) {
                                                                    const basicToken = userScanResult.Item.fcm_token
                                                                    let check = basicToken.split('+')

                                                                    let index = check.indexOf(data.fcm_token);
                                                                    if (index !== -1) {
                                                                        // 인덱스가 유효한 경우에만 삭제
                                                                        check.splice(index, 1); // fcm_token 삭제
                                                                        if (index < check.length) {
                                                                            check.splice(index, 1); // 다음 요소도 삭제
                                                                        }
                                                                    }
                                                                    const updateFcm = check.join('+')
                                                                    const UserParams = {
                                                                        TableName: 'USER_TABLE',
                                                                        Key: {
                                                                            user_key: user_key // 파티션 키
                                                                        },
                                                                        UpdateExpression: 'set fcm_token = :fcm_token',
                                                                        ExpressionAttributeValues: {
                                                                            ':fcm_token': updateFcm
                                                                        },
                                                                        ReturnValues: 'UPDATED_NEW' // 업데이트된 값을 반환
                                                                    };
                                                                    try {
                                                                        const result = await dynamoDB.update(UserParams).promise();
                                                                        console.log('Update succeeded:', result);
                                                                        responseMsg.USER_TABLE.complete = updateFcm;
                                                                    } catch (error) {
                                                                        console.error('Unable to update item. Error:', error);
                                                                    }

                                                                    console.log(`USER_TABLE: fcm_token: ${userScanResult.Item.fcm_token}`);
                                                                } else {
                                                                    console.log(`USER_TABLE: 해당 user_key에 대한 데이터 없음 userKey: ${user_key}`);
                                                                }
                                                            } catch (error) {
                                                                console.error(`USER_TABLE: 조회 실패`, error);
                                                            }

                                                            // 4. S3에서 객체 삭제
                                                            const s3ObjectPrefix = device_id.split(':').join('_') + '/'; // device_id를 변형
                                                            const s3FormattedKey = s3ObjectPrefix.replace(/:/g, '_').replace(/_/g, '_'); // a4_da_22_11_92_9d 형식으로 변형

                                                            try {
                                                                const listParams = {
                                                                    Bucket: BUCKET_NAME,
                                                                    Prefix: s3FormattedKey
                                                                };

                                                                const listedObjects = await s3.listObjectsV2(listParams).promise();

                                                                if (listedObjects.Contents.length > 0) {
                                                                    const deleteParams = {
                                                                        Bucket: BUCKET_NAME,
                                                                        Delete: {
                                                                            Objects: listedObjects.Contents.map(object => ({Key: object.Key})),
                                                                        },
                                                                    };

                                                                    await s3.deleteObjects(deleteParams).promise();
                                                                    responseMsg.S3.complete = device_id;
                                                                    console.log(`S3: 삭제성공 삭제된 deviceId: ${device_id}`);
                                                                } else {
                                                                    responseMsg.S3.nodata = device_id;
                                                                    console.log(`S3: 삭제할 데이터 없음 deviceId: ${device_id}`);
                                                                }
                                                            } catch (error) {
                                                                responseMsg.S3.false = device_id;
                                                                responseMsg.S3.err = error.message;
                                                                console.error(`S3: 삭제 실패`, error);
                                                            }

                                                            res.status(200).json({
                                                                msg: responseMsg,
                                                                changeData: lastData
                                                            });

                                                            // const DEVICE_TABLE = 'DEVICE_TABLE';
                                                            // const deleteParams = {
                                                            //     TableName: DEVICE_TABLE,
                                                            //     Key: {
                                                            //         device_id: lowerDeviceId,
                                                            //         user_key : findUser.user_key,
                                                            //     }
                                                            // };
                                                            // const recordName = "RECORD_TABLE"
                                                            //
                                                            // const recordParams = {
                                                            //     TableName:recordName,
                                                            //     KeyConditionExpression: `device_id = :pk`,
                                                            //     ExpressionAttributeValues: {
                                                            //         ':pk': lowerDeviceId,
                                                            //     },
                                                            // }
                                                            //

                                                            // const BUCKET_NAME = 'doorbell-video';
                                                            // // device_ids 변형
                                                            // const transformedDeviceId = lowerDeviceId.split(':').join('_');
                                                            // //const folderPath = `${BUCKET_NAME}/${transformedDeviceId}`;
                                                            //
                                                            // // 폴더 내의 객체 나열
                                                            // const listObjectsParams = {
                                                            //     Bucket: BUCKET_NAME,
                                                            //     Prefix: `${transformedDeviceId}/`
                                                            // };
                                                            //
                                                            // dynamoDB.delete(deleteParams, (err) => {
                                                            //     if (err) {
                                                            //         console.error('Error deleting DEVICE_TABLE item from DynamoDB:', err);
                                                            //         tableFind.close();
                                                            //         return;
                                                            //     }
                                                            //
                                                            //     // DEVICE_TABLE 삭제 후 RECORD_TABLE에서 아이템 조회
                                                            //     dynamoDB.query(recordParams, (err, data) => {
                                                            //         if (err) {
                                                            //             console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                                                            //             tableFind.close();
                                                            //             return;
                                                            //         }
                                                            //
                                                            //         const sortKeys = data.Items.map(item => item);
                                                            //         const deleteRecordPromises = sortKeys.map(item => {
                                                            //             const deleteRecordParams = {
                                                            //                 TableName: recordName,
                                                            //                 Key: {
                                                            //                     device_id: item.device_id,
                                                            //                     file_location: item.file_location
                                                            //                 }
                                                            //             };
                                                            //             return new Promise((resolve, reject) => {
                                                            //                 dynamoDB.delete(deleteRecordParams, (err) => {
                                                            //                     if (err) {
                                                            //                         console.error('Error deleting RECORD_TABLE item from DynamoDB:', err);
                                                            //                         reject(err);
                                                            //                     } else {
                                                            //                         resolve();
                                                            //                     }
                                                            //                 });
                                                            //             });
                                                            //         });
                                                            //
                                                            //         // 모든 RECORD_TABLE 삭제가 완료된 후 S3 객체 삭제
                                                            //         Promise.all(deleteRecordPromises)
                                                            //             .then(() => {
                                                            //                 return s3.listObjectsV2(listObjectsParams).promise();
                                                            //             })
                                                            //             .then(s3Data => {
                                                            //                 console.log('S3 Data:', s3Data);
                                                            //                 if (s3Data.Contents.length === 0) {
                                                            //                     console.log(`No objects found in folder ${BUCKET_NAME}/${transformedDeviceId}`);
                                                            //                     return Promise.resolve(); // 빈 Promise 반환
                                                            //                 }
                                                            //
                                                            //                 // 객체 삭제 요청
                                                            //                 const deleteParams = {
                                                            //                     Bucket: BUCKET_NAME,
                                                            //                     Delete: { Objects: [] }
                                                            //                 };
                                                            //
                                                            //                 s3Data.Contents.forEach(({ Key }) => {
                                                            //                     deleteParams.Delete.Objects.push({ Key });
                                                            //                 });
                                                            //
                                                            //                 return s3.deleteObjects(deleteParams).promise();
                                                            //             })
                                                            //             .then(deleteResponse => {
                                                            //                 console.log('S3 delete response:', deleteResponse);
                                                            //
                                                            //                 // 최종 응답 처리
                                                            //                 res.status(200).json({
                                                            //                     msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                                                            //                     changeData: lastData
                                                            //                 });
                                                            //                 tableFind.close();
                                                            //             })
                                                            //             .catch(error => {
                                                            //                 console.error('Error during deletion process:', error);
                                                            //                 res.status(400).send(error);
                                                            //                 tableFind.close();
                                                            //             });
                                                            //     });
                                                            // });

                                                            // dynamoDB.delete(deleteParams,(err)=>{
                                                            //     if(err){
                                                            //         console.error('Error deleting DEVICE_TABLE item from DynamoDB:', err);
                                                            //         tableFind.close()
                                                            //         return;
                                                            //     }
                                                            //     dynamoDB.query(recordParams, (err, data) => {
                                                            //         if (err) {
                                                            //             console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                                                            //             tableFind.close()
                                                            //             return;
                                                            //         }
                                                            //         const sortKeys = data.Items.map(item => item);
                                                            //         for (const item of sortKeys) {
                                                            //             const deleteRecordParams = {
                                                            //                 TableName: recordName,
                                                            //                 Key: {
                                                            //                     device_id: item.device_id,
                                                            //                     file_location: item.file_location
                                                            //                 }
                                                            //             };
                                                            //             dynamoDB.delete(deleteRecordParams,(err)=>{
                                                            //                 if(err){
                                                            //                     console.error('Error deleting RECORD_TABLE item from DynamoDB:', err);
                                                            //                     tableFind.close()
                                                            //                     return;
                                                            //                 }
                                                            //             })
                                                            //         }
                                                            //
                                                            //     });
                                                            //
                                                            //     s3.listObjectsV2(listObjectsParams).promise()
                                                            //         .then(s3Data => {
                                                            //             console.log('S3 Data:', s3Data);
                                                            //             if (s3Data.Contents.length === 0) {
                                                            //                 console.log(`No objects found in folder ${BUCKET_NAME}/${transformedDeviceId}`);
                                                            //                 return Promise.resolve(); // 빈 Promise 반환
                                                            //             }
                                                            //             // 객체 삭제 요청
                                                            //             const deleteParams = {
                                                            //                 Bucket: BUCKET_NAME,
                                                            //                 Delete: { Objects: [] }
                                                            //             };
                                                            //
                                                            //             s3Data.Contents.forEach(({ Key }) => {
                                                            //                 deleteParams.Delete.Objects.push({ Key });
                                                            //             });
                                                            //
                                                            //             return s3.deleteObjects(deleteParams).promise();
                                                            //
                                                            //         })
                                                            //         .then(deleteResponse => {
                                                            //             console.log('S3 delete response:', deleteResponse); // 삭제 응답 확인
                                                            //             if (deleteResponse.Deleted.length > 0) {
                                                            //                 console.log(`Successfully deleted objects from ${BUCKET_NAME}/${transformedDeviceId}`);
                                                            //             } else {
                                                            //                 console.log(`No objects were deleted from ${BUCKET_NAME}/${transformedDeviceId}`);
                                                            //             }
                                                            //             console.log(`Deleted device_id: ${lastData.id}-${lastData.name}-${data.device_id}`);
                                                            //             res.status(200).json({
                                                            //                 msg: `Deleted (MongoDB,DynamoDB,S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                                                            //                 changeData: lastData
                                                            //             });
                                                            //             tableFind.close();
                                                            //         })
                                                            //         .catch(error => {
                                                            //             console.error('Error deleting folder:', error);
                                                            //             res.status(400).send(error);
                                                            //             tableFind.close()
                                                            //         });
                                                            // })
                                                        })

                                                })

                                        })
                                        .catch(err=>{
                                            res.status(400).send(err)
                                            tableFind.close()
                                        })
                                }else{
                                    res.status(400).send('User not found.');
                                }
                            })
                    }

                })


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


                          tableFind.db(ADMIN_DB_NAME).collection('tables').deleteMany({user_key: data.user_key})
                              .then(suc => {
                                  // 최종 결과 출력
                                  deviceTableResults.forEach(result => console.log(result));
                                  recordTableResults.forEach(result => console.log(result));
                                  s3Results.forEach(result => console.log(result));
                                  console.log(`Deleted ${suc.deletedCount} documents from MongoDB for user_key=${findData.user_key}`);
                                  console.log(`${findData.id}-${findData.name} 회원탈퇴 성공`)
                                  res.status(200).send(`${findData.id}-${findData.name} 회원탈퇴 성공`)
                                  tableFind.close()
                              })
                              .catch(err => {
                                  console.log(err)
                                  tableFind.close()
                              })
                      })
                      .catch(err=>{
                          console.log(err)
                          tableFind.close()
                      })

              })
        },



        findOverseasUser(req,res){
            const data = req.body

            let params = {email: data.user_email}

            if(data.user_id !== undefined){
                params['id'] = data.user_id
            }

            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne(params)
                        .then(findData=>{
                            if(findData){
                                if(data.user_id !== undefined){
                                    res.status(200).send('ok')
                                }else{
                                    res.status(200).send(findData.id)
                                }
                            }else{
                                res.status(404).send('User not found')
                            }
                        })
                        .catch(err=>{
                            res.status(400).send(err)
                        })
                })
        },

        updateOverseasUser(req,res){
            const data = req.body

            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({id:data.user_id,email:data.user_email})
                        .then(findData=>{
                            if(findData){
                                const tableName = 'USER_TABLE'
                                const scanParams = {
                                    TableName: tableName, // 테이블 이름을 적절히 변경하세요
                                    FilterExpression: 'user_id = :user_id',
                                    ExpressionAttributeValues: {
                                        ':user_id': data.user_id
                                    }
                                };
                                // id를 기반으로 user_key 검색
                                dynamoDB.scan(scanParams, (err, scanResult) => {
                                    if (err) {
                                        console.error('Error scanning table:', err);
                                        return res.status(500).json({ error: 'Could not scan table' });
                                    }

                                    if (scanResult.Items.length === 0) {
                                        return res.status(404).json({ error: 'User not found' });
                                    }
                                    const encryptedPassword = bcrypt.hashSync(data.user_pw, 5);

                                    const userKey = scanResult.Items[0].user_key;

                                    // UpdateExpression 및 ExpressionAttributeValues 설정
                                    const updateParams = {
                                        TableName: tableName, // 테이블 이름을 적절히 변경하세요
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
                                            return res.status(500).json({ error: 'Could not update password' });
                                        }

                                        res.status(200).send('Password updated successfully')
                                        // res.json({
                                        //     message: 'Password updated successfully',
                                        //     data: result.Attributes
                                        // });
                                    });
                                });
                            }else{
                                res.status(404).send('User not found')
                            }
                        })
                })
        },


        overseasSignup(req,res){
          const data = req.body
            const saveTime = moment().tz('Asia/Seoul')
            console.log(data)
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').find({company:"Sunil"}).toArray()
                        .then(allData=>{
                            let maxContractNumObj = allData
                                .filter(item => item.contract_num.startsWith('Sunil-overseas-'))
                                .reduce((max, item) => {
                                    const num = parseInt(item.contract_num.split('Sunil-overseas-')[1], 10);
                                    return (num > parseInt(max.contract_num.split('Sunil-overseas-')[1], 10)) ? item : max;
                                });
                            const maxContractNum = parseInt(maxContractNumObj.contract_num.split('Sunil-overseas-')[1], 10);
                            //user_id,user_pw,name,tel,addr(국가),company(회사)
                            let key = data.user_id
                            let tel = "00000000000"
                            let addr = "sunilOverseas"
                            let saveAwsData = {
                                user_id:key,
                                user_pw:data.user_pw,
                                name:key,
                                tel:tel,
                                addr:addr,
                                company: "Sunil",
                            }
                            let mongoData = {
                                name:key,
                                tel:tel,
                                addr:addr,
                                email:data.user_email,
                                contract_num: `Sunil-overseas-${Number(maxContractNum)+1}`,//데이터 조회 후 +1씩증가
                                device_id: null,
                                company: "Sunil",
                                contract_service: '주계약자',
                                id:data.user_id,
                                communication: 'O',
                                service_name:"SunilService",
                                service_start: saveTime.format('YYYY-MM-DD'),
                                service_end: "9999-12-30",
                                start_up: 'O',
                                user_key:null,
                            }

                            tableFind.db(ADMIN_DB_NAME).collection('tables').find({id:data.user_id}).toArray()
                                .then(findData=>{
                                    if(findData.length !== 0){
                                        console.log('Duplicate UserId')
                                        res.status(400).send('Duplicate UserId')
                                        tableFind.close()
                                    }else{
                                        tableFind.db(ADMIN_DB_NAME).collection('tables').insertOne(mongoData)
                                            .then(suc=>{
                                                console.log(suc)
                                                console.log("saveSuccess")
                                                tableFind.db(ADMIN_DB_NAME).collection('tables').find({id:data.user_id}).toArray()
                                                    .then(sendData=>{
                                                        axios.post(AWS_LAMBDA_SIGNUP,saveAwsData)
                                                            .then(awsResponse=>{
                                                                console.log('success SignUp')
                                                                res.status(200).json({msg:'Success Signup',checkData:sendData[0],awsResponse:awsResponse.data})
                                                                tableFind.close()
                                                            })
                                                            .catch(err=>{
                                                                console.log(err)
                                                                res.status(400).send(err)
                                                                tableFind.close()
                                                            })

                                                    })
                                            })
                                            .catch(err=>{
                                                console.log('save Fail')
                                                console.log(err)
                                                tableFind.close()
                                            })
                                    }
                                })


                            // tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
                            //     .then(contracts=>{
                            //         const exists = contracts.some(contract => {
                            //             // device_id가 null일 경우 빈 배열로 처리
                            //             const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
                            //             return deviceIds.includes(data.device_id.toLowerCase());
                            //         });
                            //         if(exists){
                            //             //디바이스 아이디중복 확인
                            //             console.log('Duplicate device_id')
                            //             res.status(400).send('Duplicate device_id')
                            //         }else{
                            //
                            //         }
                            //     })
                            //     .catch(err=>{
                            //         console.log(err)
                            //         tableFind.close()
                            //     })

                            //console.log(allData)
                        })
                        .catch(err=>{
                            console.log(err)
                            tableFind.close()
                        })
                })
                .catch(err=>{
                    console.log(err)
                })


        },

        addDeviceId(req,res){
          const data  = req.body
            const token = req.headers['token']
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                        tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
                            .then(contracts=>{
                                const tokenVerify = jwt.verify(token,AWS_TOKEN)
                                const exists = contracts.some(contract => {
                                    // device_id가 null일 경우 빈 배열로 처리
                                    const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
                                    return deviceIds.includes(data.device_id.toLowerCase());
                                });
                                if(exists){
                                    console.log('Duplicate device_id')
                                    res.status(400).send('Duplicate device_id')
                                    tableFind.close()
                                }else{
                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key: tokenVerify.user_key,
                                        company: "Sunil"})
                                        .then(findData=>{
                                            console.log(findData)
                                            tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({user_key: tokenVerify.user_key,
                                                company: "Sunil"},{
                                                $set:{
                                                    device_id:findData.device_id !== null ? findData.device_id+","+data.device_id.toLowerCase():
                                                        data.device_id.toLowerCase()
                                                }
                                            })
                                                .then(suc=>{
                                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key: tokenVerify.user_key,
                                                        company: "Sunil"})
                                                        .then(sendData=>{
                                                            console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`)
                                                            res.status(200).json({msg:`Add a device_id saved Success`,
                                                                target:{
                                                                id:findData.id,
                                                                    name:findData.name,
                                                                    device_id:data.device_id.toLowerCase(),
                                                                },
                                                                checkData:sendData})
                                                            tableFind.close()
                                                        })

                                                })

                                        })
                                }
                            })


                })
        },


        saveDeivceId(req,res){
            const data = req.body
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key: data.user_key,
                            company: "Sunil"})
                        .then(findData=>{
                            const dataArray = findData.device_id.toLowerCase().split(',')
                            if(dataArray.includes(data.device_id.toLowerCase())){
                                res.status(200).send(`device_id:${data.device_id.toLowerCase()}- This is already saved device_id`)
                            }else{
                                tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({user_key: data.user_key,
                                    company: "Sunil"},{
                                    $set:{
                                        device_id:findData.device_id+","+data.device_id.toLowerCase()
                                    }
                                })
                                    .then(suc=>{
                                        console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`)
                                        res.status(200).send('success')
                                        tableFind.close()
                                    })
                            }

                        })
                })
        },



        saveUserKey(req,res){

            const data = req.body
            console.log(data)
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
                                    tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({id:bodyData.user_id,company:"Sunil"},
                                        {$set:{
                                                user_key:userData.user_key
                                            }})
                                        .then(findsData=>{
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




                // uuid를 포함하는 부분을 찾기 위한 정규식
//             let uuidRegex = new RegExp(`([^+]+)${uuid}([^+]+)`, 'g');
//
// // uuid를 포함하는 부분을 찾아서 대체
//             data = data.replace(uuidRegex, `${fcm}+${uuid}$2`);
            // if (data.includes(uuid)) {
            //     data = data.replace(uuid, `${fcm}+${uuid}`);
            // } else {
            //     // uuid가 없으면 data 끝에 fcm+uuid+ 추가
            //     data += `${fcm}+${uuid}+`;
            // }
            res.status(200).send(fcm_token_data)
        },


        findAWS(req,res){
            const token = req.headers['token']

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
                                    tableFind.close()
                                })

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

        b2cService(req,res){
            const data = req.body
            const params = req.query.contents
            //아이디 중복체크
            if(params === 'duplicate'){
                Client.connect(MONGO_URI)
                    .then(tableFind=> {
                        database = tableFind.db(ADMIN_DB_NAME)
                        tableFind.db(ADMIN_DB_NAME).collection('tables').find({}).toArray()
                            .then(allData=>{
                                let Duplicate = []
                                allData.map(e=>{
                                    if(data.userId === e.id){
                                        Duplicate.push(e)
                                    }
                                })
                                Duplicate.length !== 0 ? res.status(400).send('Duplicate') : res.status(200).send('Available')
                            })
                    })
            }

            //가입
            if(params === 'register'){
                Client.connect(MONGO_URI)
                    .then(tableFind=>{
                        database= tableFind.db(ADMIN_DB_NAME)
                        tableFind.db(ADMIN_DB_NAME).collection('tables').find({company:"Blaubit"}).toArray()
                            .then(userData=>{
                                let filterData=[];
                                let Duplicate;
                                userData.map(e=>{
                                    if(data.userId === e.id) {
                                        Duplicate = true
                                    }
                                    if(filterData.length !== 0){
                                        if(Number(e.contract_num.split('Blau')[1]) > Number(filterData[0].contract_num.split('Blau')[1])){
                                            filterData[0] = e
                                        }
                                    }else{
                                        filterData.push(e)
                                    }
                                })
                                if(Duplicate === true){
                                    return res.status(400).send('Duplicate UserId')
                                }else{
                                    let contract_num = `Blau${Number(filterData[0].contract_num.split('Blau')[1]) + 1}`

                                    //계약번호는 로직으로 Blau 뒤 숫자 +1(유니크값)
                                    //비투씨는 company Blaubit 고정
                                    //서비스 스타트날짜 => 오늘 날짜 자동, 엔드날짜 => 9999-12-30 고정(추후변경가능)
                                    //contract_services => 주계약자로 바로 개통
                                    //개통, 통신 => data.communication === true ? 'O':'X' data.start_up === true ? 'O':'X',

                                    // 계약번호(유니크), 회사명, 계약자구분(주계약,부계약), 통신, 개통, 서비스시작날짜, 서비스해지날짜는 자동세팅
                                    // 디바이스아이디(유니크), 이름, 아이디, 주소, 전화번호, 서비스종류 5개는 유저에게 받아야할 최소 단위

                                    const saveTime = moment().tz('Asia/Seoul')

                                    let saveData = {
                                        contract_num: contract_num,
                                        device_id: data.device_id,
                                        company: "Blaubit",
                                        name:data.name,
                                        contract_service: '주계약자',
                                        id:data.userId,
                                        addr:data.addr,
                                        tel:data.tel,
                                        communication: 'O',
                                        service_name:data.service_name,
                                        service_start: saveTime.format('YYYY-MM-DD'),
                                        service_end: "9999-12-30",
                                        start_up: 'O',
                                    }

                                    database.collection('tables').insertOne(saveData)
                                        .then(ls=>{
                                            console.log('저장완료')
                                            tableFind.close()
                                            res.status(200).send('Save Success')
                                        })
                                        .catch(err=>{
                                            console.log(err)
                                            res.status(400).send(err)
                                        })
                                }

                            })
                            .catch(err=>{
                                res.status(400).send(err)
                            })
                    })
                    .catch(err=>{
                        res.status(400).send(err)
                    })
            }



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
            Client.connect(MONGO_URI)
                .then(dbs => {
                    let database = dbs.db(ADMIN_DB_NAME)
                    database.collection('tables').find({id: data.id, tel: data.tel}).toArray().then(data => {
                        if (data.length === 0) {
                            res.status(400).send('해당하는 가입정보가 없습니다. 개통 완료 후 이용해주세요.')
                        } else {
                            res.status(200).send(data)
                        }
                    })
                })
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
            const data = req.body
            console.log(data)
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
                if(data.pir === null){
                    updateExpression += ', pir = :pir';
                    expressionAttributeValues[':pir'] = data.pir
                }else{
                    updateExpression += ', pir = :pir';
                    expressionAttributeValues[':pir'] = Number(data.pir);
                }

            }
            if (data.battery_status !== undefined) {
                if(data.battery_status === null){
                    updateExpression += ', battery_status = :battery_status';
                    expressionAttributeValues[':battery_status'] = data.battery_status;
                }else{
                    updateExpression += ', battery_status = :battery_status';
                    expressionAttributeValues[':battery_status'] = Number(data.battery_status);
                }

            }
            const params = {
                TableName: 'DEVICE_TABLE', // 테이블 이름을 적절히 변경하세요
                Key: {
                    device_id: data.device_id,
                    user_key: data.user_key
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            };
            try {
                const result = await dynamoDB.update(params).promise();
                res.json({
                    message: 'Device data updated successfully',
                    data: result.Attributes
                });
            } catch (error) {
                console.error('Error updating device data:', error);
                res.status(500).json({error: 'Could not update device data'});
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

        async sendEmail(req, res) {
            const data = req.body
            // try {
                // const client = MongoClient.connect(MONGO_URI);
                // const db = client.db(ADMIN_DB_NAME);
                //
                //
                // const findData = await db.collection("tables").findOne({id: data.user_id});
                // if (findData) {
                //     res.status(200).send('Duplicate user_id');
                //     return;
                // }
                //
                // const findEmail = await db.collection("tables").findOne({email: data.email});
                // if (findEmail) {
                //     res.status(200).send('Duplicate email address');
                //     return;
                // }

            // } catch (error) {
            //     console.error('Error:', error);
            //     res.status(500).send(error);
            // }
            Client.connect(MONGO_URI)
                .then(tableFind=> {
                    tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({id:data.user_id})
                        .then(findData=>{
                            if(!findData){
                                tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({email:data.email})
                                    .then(async findEmail => {
                                        if (!findEmail) {
                                            AuthNumDB.findOne({email:data.email})
                                                .then(findEmails=>{
                                                    if(!findEmails){
                                                        AuthNumDB.findOne({user_id:data.user_id})
                                                            .then(async findUserIds => {
                                                                if (!findUserIds) {
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
                                                                    transporter.sendMail(mailOptions, function (error,info) {
                                                                       if(error){
                                                                           res.status(400).send(error)
                                                                       }else{
                                                                           new AuthNumDB({
                                                                               email: data.email,
                                                                               user_id: data.user_id,
                                                                               num: authNum,
                                                                               expires: new Date(new Date().getTime() + 3 * 60 * 1000)
                                                                           }).save()
                                                                           res.send('ok');
                                                                       }
                                                                    })
                                                                    transporter.close()
                                                                } else {
                                                                    res.status(400).send('user_id requested for authentication')
                                                                }
                                                            })
                                                    }else{
                                                        res.status(400).send('email requested for authentication')
                                                    }
                                                })

                                            // let transporter = nodemailer.createTransport({
                                            //     service: NODEMAILER_SERVICE,
                                            //     host: NODEMAILER_HOST,
                                            //     port: 587,
                                            //     secure: false,
                                            //     auth: {
                                            //         user: NODEMAILER_USER,
                                            //         pass: NODEMAILER_PASS
                                            //     }
                                            // });
                                            // //인증번호 생성 및 토큰생성
                                            // let authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
                                            // const curr = new Date();
                                            // const kr_curr = new Date(curr.getTime() + (9 * 60 * 60 * 1000)); // UTC 시간에 9시간을 더함
                                            //
                                            // const mailOptions = {
                                            //     from: `MyRucell`,
                                            //     to: data.email,
                                            //     subject: `[MyRucell] 이메일 인증번호 서비스 입니다.`,
                                            //     text: `안녕하세요 아래의 인증번호를 확인하여 이메일 주소 인증을 완료해 주세요.\n인증번호: ${authNum} \n해당 인증번호는 3분간 유효합니다.`
                                            // };
                                            //
                                            // await Promise.all([
                                            //     new AuthNumDB({
                                            //         email: data.email,
                                            //         user_id: data.user_id,
                                            //         num: authNum,
                                            //         expires: new Date(new Date().getTime() + 3 * 60 * 1000)
                                            //     }).save()
                                            // ])
                                            // res.send('이메일이 전송되었습니다. 인증번호 유효시간은 3분입니다.')

                        //                     transporter.sendMail({
                        //                         from: `MyRucell`,
                        //                         to: data.email,
                        //                         subject: `[MyRucell] 이메일 인증번호 서비스 입니다.`,
                        //                         text: `안녕하세요 아래의 인증번호를 확인하여 이메일 주소 인증을 완료해 주세요.\n
                        // 인증번호: ${authNum} \n
                        // 해당 인증번호는 3분간 유효합니다.`
                        //
                        //                     }, function (error, info) {
                        //                         if (error) {
                        //                             console.log(error)
                        //                             res.status(500).send(error)
                        //                         } else {
                        //                             new AuthNumDB({
                        //                                 email: data.email,
                        //                                 user_id: data.user_id,
                        //                                 num: authNum,
                        //                                 expires: new Date(new Date().getTime() + 3 * 60 * 1000)
                        //                             })
                        //                                 .save()
                        //                                 .then(r => {
                        //                                     console.log('save Token')
                        //                                     res.send('이메일이 전송되었습니다. 인증번호 유효시간은 3분입니다.');
                        //                                 })
                        //                                 .catch(err => {
                        //                                     res.status(500).send(err)
                        //                                 })
                        //                         }
                        //                     })

                                        } else {
                                            res.status(400).send('Duplicate email address')
                                        }
                                    })

                            }else{
                                res.status(400).send('Duplicate user_id')
                            }
                        })
                })

        },

        checkAuthNum(req,res){
            const data = req.body
            AuthNumDB.findOne({user_id:data.user_id.trim(),email:data.email.trim()})
                .then(findData=>{
                    if(findData){
                        if(String(data.auth).trim() === findData.num){
                            res.status(200).send(true)
                        }else{
                            res.status(400).send("Authentication number mismatch")
                        }
                    }else{
                        res.status(400).send(false)
                    }
                })

            // AuthNumDB.findOne({user_id:data.user_id.trim(),email:data.email.trim()})
            //     .then(findId=>{
            //         if(findId){
            //             AuthNumDB.findOne({email:data.email.trim()})
            //                 .then(findEmail=>{
            //                     if(findEmail){
            //                         if(String(data.auth).trim() === findEmail.num){
            //                             // 현재 시간
            //                             const curr = new Date();
            //                             const kr_curr = new Date(curr.getTime() + (9 * 60 * 60 * 1000)); // UTC 시간에 9시간을 더함
            //                             const timeDifference = kr_curr - findEmail.expires;
            //                             // 3분(밀리초)
            //                             const threeMinutes = 3 * 60 * 1000;
            //                             AuthNumDB.deleteOne({user_id:data.user_id,email:data.email})
            //                                 .then(suc2=>{
            //                                     // 3분이 지났는지 확인
            //                                     if (timeDifference > threeMinutes) {
            //                                         console.log("expires 값에서 3분이 지났습니다.(재인증)");
            //                                         res.status(400).send(false)
            //                                     } else {
            //                                         console.log("expires 값에서 3분이 지나지 않았습니다.");
            //                                         res.status(200).send(true)
            //                                     }
            //                                 })
            //                         }else{
            //                             res.status(400).send('Authentication number mismatch')
            //                         }
            //                     }else{
            //                         res.status(400).send('The Email requested for authentication does not exist.')
            //                     }
            //                 })
            //         }else{
            //             res.status(400).send('The user_id requested for authentication does not exist.')
            //         }
            //     })
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