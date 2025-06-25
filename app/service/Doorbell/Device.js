const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const {ConnectMongo} = require("../ConnectMongo");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const db = require("../../DataBase");
const AWSAPI = require("../../router/AWS");


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, AWS_LAMBDA_SIGNUP,
    AWS_TOKEN,NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_SERVICE, NODEMAILER_HOST,SUNIL_MONGO_URI,
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS


const History = db.history


AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const devices = function () {


    return{
        async deleteDeviceId(req, res) {
            const data = req.body;
            console.log(data);
            const lowerDeviceId = data.device_id.toLowerCase();
            const token = req.headers['token'];
            const DEVICE_TABLE = 'DEVICE_TABLE';
            const RECORD_TABLE = 'RECORD_TABLE';
            const USER_TABLE = 'USER_TABLE';
            const BUCKET_NAME = 'doorbell-video';

            if (data.fcm_token === undefined) {
                console.log('There is no fcm_token inside the body.');
                return res.status(400).json({ error: 'There is no fcm_token inside the body.' });
            }
            if (data.device_id === undefined) {
                console.log('There is no device_id inside the body.');
                return res.status(400).json({ error: 'There is no device_id inside the body.' });
            }
            if (token === undefined) {
                console.log('Token not found.');
                return res.status(400).send('Token not found.');
            }

            const verify = jwt.verify(token, process.env.AWS_TOKEN);

            // 1. 멤버 전체(user_key 배열)
            const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const findMembers = await membersCol.findOne({ user_key: verify.user_key });
            if (!findMembers) {
                return res.status(404).json({ error: "Group (master) not found." });
            }
            const userKeys = [verify.user_key, ...(findMembers.unit || []).map(u => u.user_key)];

            // 2. 각 유저의 fcm_token 전체 수집 (중복제거)
            const fcmTokenSet = new Set();
            for (const uKey of userKeys) {
                const userItem = await dynamoDB.get({
                    TableName: USER_TABLE,
                    Key: { user_key: uKey }
                }).promise();
                if (userItem.Item && Array.isArray(userItem.Item.fcm_token)) {
                    userItem.Item.fcm_token.forEach(t => {
                        const tokenVal = typeof t === 'string' ? t : t?.fcm_token;
                        if (tokenVal) fcmTokenSet.add(tokenVal);
                    });
                }
            }
            const messagePayload = {
                user_key: verify.user_key,
                title: "[Re-login Request] Change User Information",
                message: "Your user information has been changed. Please log in again.",
                fileName: "deleteDeviceId"
            };

            const sendResults = await Promise.allSettled(
                [...fcmTokenSet].map(fcm_token =>
                    axios.post(
                        "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                        { ...messagePayload, fcm_token },
                        { headers: { 'x-access-token': token } }
                    )
                )
            );

            // 결과별로 성공/실패 로그
            sendResults.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    const data = result.value.data;
                    if (data.resultcode === "00") {
                        console.log(`[FCM PUSH] [${idx}] Success:`, data);
                    } else {
                        console.log(`[FCM PUSH] [${idx}] Failed (resultcode):`, data);
                    }
                } else {
                    // rejected
                    console.log(`[FCM PUSH] [${idx}] Error:`, result.reason?.message || result.reason);
                }
            });

            for (const uKey of userKeys) {
                // 1. 해당 user_key의 device_id 조회
                const findUser = await tablesCol.findOne({ user_key: uKey });
                if (!findUser) continue; // 없으면 skip

                let updatedDeviceIds = findUser.device_id !== null
                    ? findUser.device_id.split(',').filter(id => id !== lowerDeviceId).join(',')
                    : null;

                if (updatedDeviceIds === '') {
                    updatedDeviceIds = null;
                }

                // 2. 해당 user_key의 device_id 업데이트
                await tablesCol.updateOne(
                    { _id: findUser._id },
                    { $set: { device_id: updatedDeviceIds } }
                );
            }

            // MongoDB History 삭제
            await History.deleteMany({ device_id: lowerDeviceId });

            const responseMsg = {
                DEVICE_TABLE: {},
                RECORD_TABLE: {},
                USER_TABLE: {},
                S3: {}
            };

            await Promise.all([
                AWSAPI().renewalDelDynamoUserFcm(USER_TABLE, userKeys, responseMsg),
                AWSAPI().renewalDelDynamoDeviceTable(DEVICE_TABLE, lowerDeviceId, userKeys, responseMsg),
                AWSAPI().delDynamoRecord(RECORD_TABLE, lowerDeviceId, responseMsg),
                AWSAPI().delS3(BUCKET_NAME, lowerDeviceId, responseMsg)
            ]);

            console.log(responseMsg);

            const lastData = await tablesCol.findOne({ user_key: verify.user_key });

            res.status(200).json({
                msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                changeData: lastData
            });

        },

        async updateDeviceInfo(req,res){
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
                // 1. device_id로 모든 row 조회
                const queryParams = {
                    TableName: 'DEVICE_TABLE',
                    KeyConditionExpression: 'device_id = :device_id',
                    ExpressionAttributeValues: { ':device_id': data.device_id }
                };
                const queryResult = await dynamoDB.query(queryParams).promise();

                if (!queryResult.Items || queryResult.Items.length === 0) {
                    console.log('Device data not found, update ignored.');
                    return res.status(404).json({ message: 'Device data not found, update ignored.' });
                }

                // 2. 조회된 모든 row에 대해 update 반복
                const updateResults = [];
                for (const item of queryResult.Items) {
                    const params = {
                        TableName: 'DEVICE_TABLE',
                        Key: { device_id: item.device_id, user_key: item.user_key },
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ReturnValues: 'ALL_NEW'
                    };
                    const result = await dynamoDB.update(params).promise();
                    updateResults.push(result.Attributes);
                }

                res.json({
                    message: 'Device data updated successfully for all users',
                    data: updateResults
                });
            } catch (error) {
                console.error('Error updating device data:', error);
                res.status(500).json({ error: 'Could not update device data' });
            }

        }





        //개발자용 강제 삭제
        // async forceDeleteDeviceId(req, res) {
        //     const data = req.body;
        //     const lowerDeviceId = data.device_id.toLowerCase();
        //
        //     try {
        //         const result = {
        //             Mongo: { admin: "", history: "" },
        //             Dynamo: { Device_Table: "", Record_Table: "" },
        //             S3: ""
        //         };
        //
        //         // ✅ MongoDB: device_id 검색 및 삭제
        //         const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
        //         const findKey = await tablesCol.findOne({
        //             device_id: { $regex: lowerDeviceId, $options: 'i' }
        //         });
        //
        //         if (!findKey) {
        //             result.Mongo.admin = "삭제할 데이터 없음";
        //         } else {
        //             const deviceIds = findKey.device_id ? findKey.device_id.split(',') : [];
        //             const updatedDeviceIds = deviceIds.filter(id => id.trim() !== lowerDeviceId);
        //             const newDeviceId = updatedDeviceIds.length > 0 ? updatedDeviceIds.join(',') : null;
        //
        //             await tablesCol.updateOne(
        //                 { _id: findKey._id },
        //                 { $set: { device_id: newDeviceId } }
        //             );
        //
        //             result.Mongo.admin = "삭제 성공";
        //         }
        //
        //         // ✅ MongoDB: History 삭제
        //         const historyResult = await History.deleteMany({ device_id: lowerDeviceId });
        //         result.Mongo.history = historyResult.deletedCount > 0 ? "삭제 성공" : "삭제할 데이터 없음";
        //
        //         // ✅ DynamoDB: DEVICE_TABLE 삭제
        //         const deviceKeyResult = await dynamoDB.query({
        //             TableName: "DEVICE_TABLE",
        //             KeyConditionExpression: "device_id = :device_id",
        //             ExpressionAttributeValues: {
        //                 ":device_id": lowerDeviceId
        //             }
        //         }).promise();
        //
        //         if (deviceKeyResult.Items && deviceKeyResult.Items.length > 0) {
        //             const user_key = deviceKeyResult.Items[0].user_key;
        //
        //             const deleteParams = {
        //                 TableName: "DEVICE_TABLE",
        //                 Key: {
        //                     "device_id": lowerDeviceId,
        //                     "user_key": user_key
        //                 }
        //             };
        //             await dynamoDB.delete(deleteParams).promise();
        //             result.Dynamo.Device_Table = "삭제 성공";
        //         } else {
        //             result.Dynamo.Device_Table = "삭제할 데이터 없음";
        //         }
        //
        //         // ✅ DynamoDB: RECORD_TABLE 삭제
        //         const recordDeleteResult = await deleteFromRecordTable(lowerDeviceId);
        //         result.Dynamo.Record_Table = recordDeleteResult ? "삭제 성공" : "삭제할 데이터 없음";
        //
        //         // ✅ S3 삭제
        //         const s3DeleteResult = await deleteFromS3(lowerDeviceId);
        //         result.S3 = s3DeleteResult ? "삭제 성공" : "삭제할 데이터 없음";
        //
        //         // ✅ 최종 응답
        //         res.status(200).json(result);
        //
        //     } catch (err) {
        //         console.error('❌ Error during deletion process:', err);
        //         res.status(500).json({ error: 'Internal Server Error' });
        //     }
        //
        //     // 내부 함수들 (같은 위치 유지)
        //     async function deleteFromRecordTable(lowerDeviceId) {
        //         const queryParams = {
        //             TableName: "RECORD_TABLE",
        //             KeyConditionExpression: "device_id = :device_id",
        //             ExpressionAttributeValues: {
        //                 ":device_id": lowerDeviceId
        //             }
        //         };
        //
        //         try {
        //             const result = await dynamoDB.query(queryParams).promise();
        //             if (result.Items?.length > 0) {
        //                 for (const record of result.Items) {
        //                     const deleteParams = {
        //                         TableName: "RECORD_TABLE",
        //                         Key: {
        //                             device_id: record.device_id,
        //                             file_location: record.file_location
        //                         }
        //                     };
        //                     await dynamoDB.delete(deleteParams).promise();
        //                     console.log(`Deleted from RECORD_TABLE: ${record.device_id}, ${record.file_location}`);
        //                 }
        //                 return true;
        //             } else {
        //                 console.log(`No RECORD_TABLE data for: ${lowerDeviceId}`);
        //                 return false;
        //             }
        //         } catch (error) {
        //             console.error("RECORD_TABLE deletion error:", error);
        //             return false;
        //         }
        //     }
        //
        //     async function deleteFromS3(lowerDeviceId) {
        //         const s3 = new AWS.S3();
        //         const bucketName = "doorbell-video";
        //         const directoryKey = lowerDeviceId.replace(/:/g, '_') + "/";
        //
        //         const listParams = {
        //             Bucket: bucketName,
        //             Prefix: directoryKey
        //         };
        //
        //         try {
        //             const listData = await s3.listObjectsV2(listParams).promise();
        //             if (listData.Contents.length === 0) {
        //                 console.log(`No S3 objects for: ${directoryKey}`);
        //                 return false;
        //             }
        //
        //             const deleteParams = {
        //                 Bucket: bucketName,
        //                 Delete: {
        //                     Objects: listData.Contents.map(obj => ({ Key: obj.Key }))
        //                 }
        //             };
        //
        //             await s3.deleteObjects(deleteParams).promise();
        //             console.log(`S3 deleted: ${directoryKey}`);
        //             return true;
        //         } catch (error) {
        //             console.error("S3 deletion error:", error);
        //             return false;
        //         }
        //     }
        // },


    }
}


module.exports = devices;