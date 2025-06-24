
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk")
const moment = require("moment-timezone");
const db = require("../../DataBase");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION,
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS


AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const Pictures = db.pictures

const AWSAPI  = function (){
    return{
        async getPicture(req, res) {
            try {
                // 예: /get/picture?date=2025-06-24
                const { date } = req.query;
                if (!date) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

                // KST(한국시간)으로 0시~23:59:59 범위 구하기
                const start = moment.tz(date, 'YYYY-MM-DD', 'Asia/Seoul').startOf('day').toDate();
                const end = moment.tz(date, 'YYYY-MM-DD', 'Asia/Seoul').endOf('day').toDate();

                // 몽고에 저장된 created_at은 UTC지만,
                // 범위를 toDate()로 넘기면 몽고가 자동 UTC로 맞춰줌
                const pics = await Pictures.find({
                    created_at: { $gte: start, $lte: end }
                }).sort({ created_at: 1 });

                res.json({ count: pics.length, pictures: pics });
            } catch (err) {
                res.status(500).json({ error: '조회 실패', detail: err.message });
            }
        },

        async deletePicture(req, res) {
            try {
                const { date } = req.query;
                if (!date) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

                // 한국 시간 기준으로 범위 생성
                const start = moment.tz(date, 'YYYY-MM-DD', 'Asia/Seoul').startOf('day').toDate();
                const end = moment.tz(date, 'YYYY-MM-DD', 'Asia/Seoul').endOf('day').toDate();

                const pics = await Pictures.find({
                    created_at: { $gte: start, $lte: end }
                });

                if (pics.length === 0) {
                    return res.status(404).json({ error: '해당 날짜에 파일 없음' });
                }

                // S3에서 전부 삭제 (Promise.all)
                const s3 = new AWS.S3();
                const deleteS3 = pics.map(pic =>
                    s3.deleteObject({
                        Bucket: "blaubit-picture",
                        Key: pic.aws_key,
                    }).promise()
                );
                await Promise.all(deleteS3);

                // DB에서 전부 삭제
                const ids = pics.map(pic => pic._id);
                await Pictures.deleteMany({ _id: { $in: ids } });

                res.json({ message: 'delete success', count: pics.length, date, deleted_ids: ids });
            } catch (err) {
                res.status(500).json({ error: '삭제 실패', detail: err.message });
            }
        },

        async uploadPicture(req, res) {
            try {
                const file = req.file;
                if (!file) return res.status(400).json({ error: '파일이 없습니다.' });

                // moment로 오늘 날짜 폴더 경로 만들기
                const todayPath = moment().format('YYYY-MM/DD'); // 예: 2025-06/24

                // 중복 방지로 파일명 앞에 타임스탬프 추가
                const fileName = `${file.originalname}`;
                const s3Key = `${todayPath}/${fileName}`; // 2025-06/24/파일명

                const params = {
                    Bucket: "blaubit-picture",
                    Key: s3Key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ACL: 'public-read',
                };

                const s3 = new AWS.S3();
                const data = await s3.upload(params).promise();

                new Pictures({
                    file_name:file.originalname,
                    aws_url: data.Location,
                    aws_key: data.Key,
                    created_at: moment().toISOString(),
                }).save()
                    .then(r=>res.json({
                        message: 'upload success',
                        s3_url: data.Location,
                        key: data.Key,
                    }))
                    .catch(err=>
                    {
                        res.status(400).send(err)
                    })


            } catch (err) {
                console.error('업로드 실패:', err);
                res.status(500).json({ error: '업로드 실패', detail: err.message });
            }
        },

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
