const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const {ConnectMongo} = require("../ConnectMongo");
const {verify} = require("jsonwebtoken");
const axios = require("axios");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME,
    AWS_TOKEN, SUNIL_MONGO_URI
} = applyDotenv(dotenv)

AWS.config.update({
    accessKeyId: AWS_SECRET,
    secretAccessKey: AWS_ACCESS,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const users = function () {
    return{
        async signOut(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(400).send('필수 정보 없음');

            const { user_key } = verify(token, process.env.AWS_TOKEN);

            // 몽고DB 연결
            const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const findData = await tablesCol.findOne({ user_key });
            if (!findData) return res.status(404).send("해당 유저 정보 없음");

            const isMaster = findData.contract_service !== '부계약자'; // 주계약자면 true
            const deviceIds = findData.device_id ? findData.device_id.split(",").map(d=>d.trim()) : [];
            const s3 = new AWS.S3();
            const DEVICE_TABLE = 'DEVICE_TABLE';
            const RECORD_TABLE = "RECORD_TABLE";
            const USER_TABLE = 'USER_TABLE';
            const BUCKET_NAME = 'doorbell-video';

            if (isMaster) {
                // 1. 전체 unit 유저키 추출
                const findMember = await membersCol.findOne({ user_key });
                const userKeys = [...(findMember?.unit?.map(u=>u.user_key) ?? [])]; // 마스터 본인X, 유닛만

                // 2. members, tables에서 마스터 삭제
                await membersCol.deleteOne({ user_key });
                await tablesCol.deleteOne({ user_key });

                // 3. unit 멤버들 device_id null
                for (const unit of userKeys) {
                    await tablesCol.updateOne(
                        { user_key: unit },
                        { $set: { contract_service: '주계약자', device_id: null } }
                    );
                }

                // 4. 유닛들 fcm push, fcm_token []로 초기화
                for (const unit_user_key of userKeys) {
                    // fcm_token 배열 조회
                    const userItem = await dynamoDB.get({
                        TableName: USER_TABLE,
                        Key: { user_key: unit_user_key }
                    }).promise();

                    if (userItem.Item && Array.isArray(userItem.Item.fcm_token)) {
                        for (const t of userItem.Item.fcm_token) {
                            const tokenVal = typeof t === 'string' ? t : t?.fcm_token;
                            if (tokenVal) {
                                await axios.post(
                                    "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                                    {
                                        user_key: unit_user_key,
                                        fcm_token: tokenVal,
                                        title: "[Re-login Request] Group deleted",
                                        message: "The group has been deleted by the master. Please re-login.",
                                        fileName: "signOut-master"
                                    },
                                    { headers: { 'x-access-token': token } }
                                ).catch(()=>{});
                            }
                        }
                    }
                    // fcm_token 배열 초기화
                    await dynamoDB.update({
                        TableName: USER_TABLE,
                        Key: { user_key: unit_user_key },
                        UpdateExpression: 'set fcm_token = :fcm_token',
                        ExpressionAttributeValues: { ':fcm_token': [] }
                    }).promise();
                }

                // 5. 마스터 본인만 유저테이블에서 row 삭제
                await dynamoDB.delete({
                    TableName: USER_TABLE,
                    Key: { user_key }
                }).promise();

                // 6. 디바이스/레코드/S3/히스토리 싹 삭제
                for (const device_id of deviceIds) {
                    // 디바이스 테이블: device_id의 모든 유저키 row 삭제
                    const rows = await dynamoDB.query({
                        TableName: DEVICE_TABLE,
                        KeyConditionExpression: 'device_id = :d',
                        ExpressionAttributeValues: { ':d': device_id }
                    }).promise();
                    await Promise.all(rows.Items.map(row =>
                        dynamoDB.delete({ TableName: DEVICE_TABLE, Key: { device_id: row.device_id, user_key: row.user_key } }).promise()
                    ));
                    // 레코드 테이블
                    const scanResult = await dynamoDB.scan({
                        TableName: RECORD_TABLE,
                        FilterExpression: 'device_id = :device_id',
                        ExpressionAttributeValues: { ':device_id': device_id }
                    }).promise();
                    if (scanResult.Items.length > 0) {
                        await Promise.all(scanResult.Items.map(record =>
                            dynamoDB.delete({
                                TableName: RECORD_TABLE,
                                Key: { device_id: record.device_id, file_location: record.file_location }
                            }).promise()
                        ));
                    }
                    // S3
                    const s3ObjectPrefix = device_id.replace(/:/g, '_') + '/';
                    const listedObjects = await s3.listObjectsV2({ Bucket: BUCKET_NAME, Prefix: s3ObjectPrefix }).promise();
                    if (listedObjects.Contents.length > 0) {
                        await s3.deleteObjects({
                            Bucket: BUCKET_NAME,
                            Delete: { Objects: listedObjects.Contents.map(object => ({ Key: object.Key })) }
                        }).promise();
                    }
                    // History
                    await History.deleteMany({ device_id });
                }

                // Sunil (optional)
                if (findData.company === 'Sunil') {
                    const { collection: sunilCol } = await ConnectMongo(SUNIL_MONGO_URI, 'Sunil-Doorbell', 'users');
                    await sunilCol.deleteMany({ id: findData.id });
                }

                return res.status(200).send("주계약자 회원탈퇴 성공");

            } else {
                // 부계약자(맴버)
                // 1. members에서 본인 unit만 $pull
                await membersCol.updateOne(
                    { "unit.user_key": user_key },
                    { $pull: { unit: { user_key } } }
                );
                // 2. tables에서 row 삭제
                await tablesCol.deleteOne({ user_key });

                // 3. DynamoDB USER_TABLE: 본인 row만 삭제
                await dynamoDB.delete({
                    TableName: USER_TABLE,
                    Key: { user_key }
                }).promise();

                // 4. DEVICE_TABLE: 본인 user_key + device_id로 row만 삭제
                for (const device_id of deviceIds) {
                    await dynamoDB.delete({
                        TableName: DEVICE_TABLE,
                        Key: { device_id, user_key }
                    }).promise();
                }

                // History/S3/RecordTable은 손 안댐
                return res.status(200).send("부계약자 회원탈퇴 성공");
            }
        }
    }
}

module.exports = users;
