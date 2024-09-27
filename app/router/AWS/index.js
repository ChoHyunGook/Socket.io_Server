const AWS = require("aws-sdk");
const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const dynamoDB = new AWS.DynamoDB.DocumentClient();


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS

AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const AWSAPI  = function (){
    return{
        async delDynamoUserFcm(table,user_key,msg){
            const UserParams = {
                TableName: table,
                Key: {
                    user_key // 파티션 키
                },
                UpdateExpression: 'set fcm_token = :fcm_token',
                ExpressionAttributeValues: {
                    ':fcm_token': [] // 업데이트할 fcm_token 배열
                },
                ReturnValues: 'UPDATED_NEW' // 업데이트된 값을 반환
            };
            try {
                const result = await dynamoDB.update(UserParams).promise();
                console.log('Update succeeded:', result);
                msg.USER_TABLE.complete = []; // 업데이트된 fcm 배열 저장
            } catch (error) {
                msg.USER_TABLE.false = user_key; // 실패한 user_key 저장
                msg.USER_TABLE.err = error.message; // 오류 메시지 저장
                console.error('Unable to update USER_TABLE. Error:', error);
            }
        },
        async delDynamoDeviceTable(table,device_id,user_key,msg){
            const deviceDeleteParams = {
                TableName: table,
                Key: {
                   device_id, user_key
                }
            };
            try {
                await dynamoDB.delete(deviceDeleteParams).promise();
                msg.DEVICE_TABLE.complete = device_id;
                console.log(`DEVICE_TABLE: 삭제성공 deviceId: ${device_id} userKey: ${user_key}`);
            } catch (error) {
                msg.DEVICE_TABLE.false = device_id;
                msg.DEVICE_TABLE.err = error.message;
                console.error(`DEVICE_TABLE: 삭제 실패`, error);
            }
        },
        async delDynamoRecord(table,device_id,msg){
            const recordScanParams = {
                TableName: table,
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
                            TableName: table,
                            Key: {
                                device_id: record.device_id,
                                file_location: record.file_location // 정렬 키
                            }
                        };
                        return dynamoDB.delete(deleteParams).promise().then(() => {
                            console.log(`RECORD_TABLE: 삭제성공 deviceId: ${record.device_id} fileLocation: ${record.file_location}`);
                        }).catch(error => {
                            msg.RECORD_TABLE.false = record.device_id;
                            msg.RECORD_TABLE.err = error.message;
                        });
                    });

                    await Promise.all(deletePromises);
                    msg.RECORD_TABLE.complete = device_id;
                } else {
                    msg.RECORD_TABLE.nodata = device_id;
                    console.log(`RECORD_TABLE: 삭제할 데이터 없음 deviceId: ${device_id}`);
                }
            } catch (error) {
                msg.RECORD_TABLE.err = error.message;
                console.error(`RECORD_TABLE: 삭제 실패`, error);
            }
        },
        async delS3(bucket, device_id, msg) {
            const s3 = new AWS.S3();
            const s3ObjectPrefix = device_id.split(':').join('_') + '/';
            const s3FormattedKey = s3ObjectPrefix.replace(/:/g, '_').replace(/_/g, '_');
            try {
                const listParams = { Bucket: bucket, Prefix: s3FormattedKey };
                const listedObjects = await s3.listObjectsV2(listParams).promise();

                if (listedObjects.Contents.length > 0) {
                    const deleteParams = {
                        Bucket: bucket,
                        Delete: {
                            Objects: listedObjects.Contents.map(object => ({ Key: object.Key })),
                        },
                    };
                    await s3.deleteObjects(deleteParams).promise();
                    msg.S3.complete = device_id;
                    console.log(`S3: 삭제성공 삭제된 deviceId: ${device_id}`);
                } else {
                    msg.S3.nodata = device_id;
                    console.log(`S3: 삭제할 데이터 없음 deviceId: ${device_id}`);
                }
            } catch (error) {
                msg.S3.false = device_id;
                msg.S3.err = error.message;
                console.error(`S3: 삭제 실패`, error);
            }
        },
    }
}


module.exports = AWSAPI
