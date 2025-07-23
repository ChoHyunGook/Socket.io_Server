const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const {ConnectMongo} = require("../ConnectMongo");
const {verify} = require("jsonwebtoken");
const axios = require("axios");
const db = require("../../DataBase");
const moment = require("moment-timezone");
const jwt = require("jsonwebtoken");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME,
    AWS_TOKEN, SUNIL_MONGO_URI
} = applyDotenv(dotenv)

AWS.config.update({
    accessKeyId: AWS_SECRET,
    secretAccessKey: AWS_ACCESS,
    region: AWS_REGION
});

const AwsLogin = db.AWSLogin

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const users = function () {
    return{
        async renewalSignUp(req, res) {
            let {company, ...data} = req.body;
            const saveTime = moment().tz('Asia/Seoul');
            console.log(data);

            // 🔐 필수값 유효성 검사
            if (!company || typeof company !== 'string' || company.trim() === '') {
                return res.status(400).send("Invalid value for 'company'.");
            }

            // ✅ 첫 글자 대문자 + 나머지 소문자로 정규화
            company = company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();

            if (!data.user_id || typeof data.user_id !== 'string' || data.user_id.trim() === '') {
                return res.status(400).send("'user_id' is a required field.");
            }

            if (!data.user_pw || typeof data.user_pw !== 'string' || data.user_pw.trim() === '') {
                return res.status(400).send("'user_pw' is a required field.");
            }

            if (!data.user_email || typeof data.user_email !== 'string' || data.user_email.trim() === '') {
                return res.status(400).send("'user_email' is a required field.");
            }

            if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
                return res.status(400).send("'name' is a required field.");
            }

            if (!data.tel || typeof data.tel !== 'string' || data.tel.trim() === '') {
                return res.status(400).send("'tel' is a required field.");
            }


            try {
                const {collection: tableCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
                const allData = await tableCol.find({company}).toArray();
                const maxContractNumObj = allData
                    .filter(item => item.contract_num && item.contract_num.startsWith(`${company}-`))
                    .reduce((max, item) => {
                        const num = parseInt(item.contract_num.split(`${company}-`)[1], 10);
                        return (num > parseInt(max.contract_num.split(`${company}-`)[1], 10)) ? item : max;
                    }, {contract_num: `${company}-0`});

                const maxContractNum = maxContractNumObj ? parseInt(maxContractNumObj.contract_num.split(`${company}-`)[1], 10) : 0;

                const findData = await tableCol.find({
                    $or: [
                        { id: data.user_id },
                        { email: data.user_email }
                    ]
                }).toArray();

                if (findData.length !== 0) {
                    let dupMsg = '';
                    if (findData.some(u => u.id === data.user_id)) dupMsg += 'UserId ';
                    if (findData.some(u => u.email === data.user_email)) dupMsg += 'Email ';
                    return res.status(400).send(`Duplicate ${dupMsg.trim()}`);
                }

                const key = data.user_id;
                // const tel = "00000000000";
                const addr = `${company}-address`;

                const saveAwsData = {
                    user_id: key,
                    user_pw: data.user_pw,
                    name: data.name,
                    tel: data.tel,
                    addr: addr,
                    company,
                };

                try {
                    const awsResponse = await axios.post(AWS_LAMBDA_SIGNUP, saveAwsData);
                    console.log('success SignUp');
                    const awsResponseData = awsResponse.data;
                    let lambdaDecoded = jwt.verify(awsResponseData.token, AWS_TOKEN); // 또는 AWS 쪽에서 사용하는 키
                    let newUserKey = lambdaDecoded.user_key; // 여기에 유저키가 들어있음

                    const mongoSignUpData = {
                        name: data.name,
                        tel: data.tel,
                        addr: addr,
                        email: data.user_email,
                        contract_num: `${company}-${Number(maxContractNum) + 1}`,
                        device_id: null,
                        company,
                        contract_service: '주계약자',
                        id: data.user_id,
                        communication: 'O',
                        service_name: `${company}Service`,
                        service_start: saveTime.format('YYYY-MM-DD'),
                        service_end: "9999-12-30",
                        start_up: 'O',
                        user_key: newUserKey
                    };

                    const memberData = {
                        group_name: `${data.name}의 그룹`,
                        user_key:newUserKey,
                        unit:[
                            {
                                user_key:newUserKey,
                                user_name:data.name,
                                alias_name:null,
                                email:data.user_email,
                                device_info:[],
                                token:null,
                                auth:true,
                                state:"ACTIVE",
                                join_at:moment().tz('Asia/Seoul').toDate(),
                            }
                        ],
                        create_at:moment().tz('Asia/Seoul').toDate()
                    }


                    const insertSignUpResult = await tableCol.insertOne(mongoSignUpData);
                    const insertMembersResult = await membersCol.insertOne(memberData);

                    console.log(insertSignUpResult);
                    console.log(insertMembersResult)

                    const signUpData = await tableCol.findOne({id: data.user_id});
                    const groupData = await membersCol.findOne({user_key:newUserKey})

                    return res.status(200).json({
                        msg: 'Success Signup',
                        signUpData,
                        groupData,
                        awsResponse: awsResponseData
                    });
                } catch (awsErr) {
                    console.log(awsErr);
                    return res.status(502).send(awsErr);
                }


            } catch (err) {
                console.error(err);
                return res.status(500).send(err);
            }

        },


        async renewalSignOut(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(400).send('Token is required.');

            let user_key;
            try {
                ({ user_key } = jwt.verify(token, process.env.AWS_TOKEN));
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            // MongoDB 연결
            const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const findData = await tablesCol.findOne({ user_key });
            if (!findData) return res.status(404).send("User data not found.");

            const s3 = new AWS.S3();
            const DEVICE_TABLE = 'DEVICE_TABLE';
            const RECORD_TABLE = "RECORD_TABLE";
            const USER_TABLE = 'USER_TABLE';
            const BUCKET_NAME = 'doorbell-video';

            // 1. 그룹 정보 조회 (마스터 본인 그룹)
            const group = await membersCol.findOne({ user_key });
            if (!group) return res.status(404).send("Group not found.");

            // 2. FCM 알림을 보낼 ACTIVE 그룹원(본인 제외) 필터링
            const unitsToNotify = (group.unit || []).filter(u =>
                u.user_key !== user_key && u.state === "ACTIVE"
            );

            // 3. 각 그룹원에게 그룹 삭제 FCM 알림 전송
            if (unitsToNotify.length > 0) {
                const pushArr = unitsToNotify.map(unit => {
                    const alias = unit.alias_name || group.group_name;
                    return {
                        user_key: unit.user_key,
                        title: `[${alias}] Group Deleted`,
                        message: "The group has been deleted by the master.",
                        fileName: ""
                    }
                });
                try {
                    await axios.post(
                        "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                        { push: pushArr },
                        { headers: { "x-access-token": token } }
                    );
                } catch (e) {
                    console.error("FCM Push Error:", e?.response?.data || e.message);
                }
            }

            // 본인 USER_TABLE row 삭제
            await dynamoDB.delete({
                TableName: USER_TABLE,
                Key: { user_key }
            }).promise();

            // 4. 모든 그룹원(unit)들의 device_info에서 device_id, user_key 조합으로 DEVICE_TABLE 삭제
            for (const unit of (group.unit || [])) {
                if (Array.isArray(unit.device_info)) {
                    for (const device of unit.device_info) {
                        if (device.device_id) {
                            await dynamoDB.delete({
                                TableName: DEVICE_TABLE,
                                Key: {
                                    device_id: device.device_id,
                                    user_key: unit.user_key
                                }
                            }).promise();
                        }
                    }
                }
            }

            // 5. 그룹(MongoDB members)과 본인 테이블 row(MongoDB tables) 삭제
            await membersCol.deleteOne({ user_key });
            await tablesCol.deleteOne({ user_key });

            // 6. 그룹 내 모든 unit.device_info의 device_id 기준으로 Record, S3, History 데이터 삭제
            //    (device_id 중복 제거해서 unique하게 한번씩만 삭제)
            const masterDeviceIds = findData.device_id
                ? findData.device_id.split(",").map(d => d.trim())
                : [];

            for (const device_id of masterDeviceIds) {
                // RECORD_TABLE: 해당 device_id에 해당하는 모든 레코드 삭제
                const scanResult = await dynamoDB.scan({
                    TableName: RECORD_TABLE,
                    FilterExpression: 'device_id = :device_id',
                    ExpressionAttributeValues: { ':device_id': device_id }
                }).promise();

                if (scanResult.Items.length > 0) {
                    for (const record of scanResult.Items) {
                        await dynamoDB.delete({
                            TableName: RECORD_TABLE,
                            Key: {
                                device_id: record.device_id,
                                file_location: record.file_location // 정렬키
                            }
                        }).promise();
                    }
                }

                // S3: device_id로 변환한 prefix로 S3 객체 전체 삭제
                const s3ObjectPrefix = device_id.replace(/:/g, '_') + '/';
                const listedObjects = await s3.listObjectsV2({ Bucket: BUCKET_NAME, Prefix: s3ObjectPrefix }).promise();
                if (listedObjects.Contents.length > 0) {
                    await s3.deleteObjects({
                        Bucket: BUCKET_NAME,
                        Delete: { Objects: listedObjects.Contents.map(object => ({ Key: object.Key })) }
                    }).promise();
                }

                // History (MongoDB): device_id로 전체 삭제
                await History.deleteMany({ device_id });
            }

            // 7. 회사가 Sunil인 경우 Sunil-Doorbell 컬렉션에서 추가 삭제
            if (findData.company === 'Sunil') {
                const { collection: sunilCol } = await ConnectMongo(SUNIL_MONGO_URI, 'Sunil-Doorbell', 'users');
                await sunilCol.deleteMany({ id: findData.id });
            }

            // 8. 완료 응답 (영문)
            return res.status(200).send("Account deletion and group removal completed successfully.");
        },


        async saveDeivceId(req, res) {
            const data = req.body;

            try {
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const findData = await tablesCol.findOne({ user_key: data.user_key });

                if (!findData) {
                    return res.status(404).send('User not found');
                }

                const incomingDeviceId = data.device_id.toLowerCase();

                if (!findData.device_id || findData.device_id === "") {
                    // device_id가 null이거나 빈 문자열인 경우 새로 저장
                    await tablesCol.findOneAndUpdate(
                        { user_key: data.user_key },
                        { $set: { device_id: incomingDeviceId } }
                    );
                    console.log(`${findData.id}-${findData.name}-${incomingDeviceId} saved`);
                    return res.status(200).send('success');
                } else {
                    const dataArray = findData.device_id.toLowerCase().split(',');

                    if (dataArray.includes(incomingDeviceId)) {
                        return res.status(200).send(`device_id:${incomingDeviceId} - This is already saved device_id`);
                    } else {
                        const updatedDeviceId = findData.device_id + "," + incomingDeviceId;
                        await tablesCol.findOneAndUpdate(
                            { user_key: data.user_key },
                            { $set: { device_id: updatedDeviceId } }
                        );
                        console.log(`${findData.id}-${findData.name}-${incomingDeviceId} saved`);
                        return res.status(200).send('success');
                    }
                }



            } catch (err) {
                console.error('Error in saveDeivceId:', err);
                return res.status(500).send('Internal Server Error');
            }
        }


        // async signOut(req, res) {
        //     const token = req.headers['token'];
        //     if (!token) return res.status(400).send('필수 정보 없음');
        //
        //     const { user_key } = verify(token, process.env.AWS_TOKEN);
        //
        //     // 몽고DB 연결
        //     const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
        //     const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
        //     const findData = await tablesCol.findOne({ user_key });
        //     if (!findData) return res.status(404).send("해당 유저 정보 없음");
        //
        //     const isMaster = findData.contract_service !== '부계약자'; // 주계약자면 true
        //     const deviceIds = findData.device_id ? findData.device_id.split(",").map(d=>d.trim()) : [];
        //     const s3 = new AWS.S3();
        //     const DEVICE_TABLE = 'DEVICE_TABLE';
        //     const RECORD_TABLE = "RECORD_TABLE";
        //     const USER_TABLE = 'USER_TABLE';
        //     const BUCKET_NAME = 'doorbell-video';
        //
        //     if (isMaster) {
        //         // 1. 전체 unit 유저키 추출
        //         const findMember = await membersCol.findOne({ user_key });
        //         const userKeys = [...(findMember?.unit?.map(u=>u.user_key) ?? [])]; // 마스터 본인X, 유닛만
        //
        //         // 2. members, tables에서 마스터 삭제
        //         await membersCol.deleteOne({ user_key });
        //         await tablesCol.deleteOne({ user_key });
        //
        //         // 3. unit 멤버들 device_id null
        //         for (const unit of userKeys) {
        //             await tablesCol.updateOne(
        //                 { user_key: unit },
        //                 { $set: { contract_service: '주계약자', device_id: null } }
        //             );
        //         }
        //
        //         // 4. 유닛들 fcm push, fcm_token []로 초기화
        //         for (const unit_user_key of userKeys) {
        //             // fcm_token 배열 조회
        //             const userItem = await dynamoDB.get({
        //                 TableName: USER_TABLE,
        //                 Key: { user_key: unit_user_key }
        //             }).promise();
        //
        //             if (userItem.Item && Array.isArray(userItem.Item.fcm_token)) {
        //                 for (const t of userItem.Item.fcm_token) {
        //                     const tokenVal = typeof t === 'string' ? t : t?.fcm_token;
        //                     if (tokenVal) {
        //                         await axios.post(
        //                             "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
        //                             {
        //                                 user_key: unit_user_key,
        //                                 fcm_token: tokenVal,
        //                                 title: "[Re-login Request] Group deleted",
        //                                 message: "The group has been deleted by the master. Please re-login.",
        //                                 fileName: "signOut-master"
        //                             },
        //                             { headers: { 'x-access-token': token } }
        //                         ).catch(()=>{});
        //                     }
        //                 }
        //             }
        //             // fcm_token 배열 초기화
        //             await dynamoDB.update({
        //                 TableName: USER_TABLE,
        //                 Key: { user_key: unit_user_key },
        //                 UpdateExpression: 'set fcm_token = :fcm_token',
        //                 ExpressionAttributeValues: { ':fcm_token': [] }
        //             }).promise();
        //         }
        //
        //         // 5. 마스터 본인만 유저테이블에서 row 삭제
        //         await dynamoDB.delete({
        //             TableName: USER_TABLE,
        //             Key: { user_key }
        //         }).promise();
        //
        //         // 6. 디바이스/레코드/S3/히스토리 싹 삭제
        //         for (const device_id of deviceIds) {
        //             // 디바이스 테이블: device_id의 모든 유저키 row 삭제
        //             const rows = await dynamoDB.query({
        //                 TableName: DEVICE_TABLE,
        //                 KeyConditionExpression: 'device_id = :d',
        //                 ExpressionAttributeValues: { ':d': device_id }
        //             }).promise();
        //             await Promise.all(rows.Items.map(row =>
        //                 dynamoDB.delete({ TableName: DEVICE_TABLE, Key: { device_id: row.device_id, user_key: row.user_key } }).promise()
        //             ));
        //             // 레코드 테이블
        //             const scanResult = await dynamoDB.scan({
        //                 TableName: RECORD_TABLE,
        //                 FilterExpression: 'device_id = :device_id',
        //                 ExpressionAttributeValues: { ':device_id': device_id }
        //             }).promise();
        //             if (scanResult.Items.length > 0) {
        //                 await Promise.all(scanResult.Items.map(record =>
        //                     dynamoDB.delete({
        //                         TableName: RECORD_TABLE,
        //                         Key: { device_id: record.device_id, file_location: record.file_location }
        //                     }).promise()
        //                 ));
        //             }
        //             // S3
        //             const s3ObjectPrefix = device_id.replace(/:/g, '_') + '/';
        //             const listedObjects = await s3.listObjectsV2({ Bucket: BUCKET_NAME, Prefix: s3ObjectPrefix }).promise();
        //             if (listedObjects.Contents.length > 0) {
        //                 await s3.deleteObjects({
        //                     Bucket: BUCKET_NAME,
        //                     Delete: { Objects: listedObjects.Contents.map(object => ({ Key: object.Key })) }
        //                 }).promise();
        //             }
        //             // History
        //             await History.deleteMany({ device_id });
        //         }
        //
        //         // Sunil (optional)
        //         if (findData.company === 'Sunil') {
        //             const { collection: sunilCol } = await ConnectMongo(SUNIL_MONGO_URI, 'Sunil-Doorbell', 'users');
        //             await sunilCol.deleteMany({ id: findData.id });
        //         }
        //
        //         return res.status(200).send("주계약자 회원탈퇴 성공");
        //
        //     } else {
        //         // 부계약자(맴버)
        //         // 1. members에서 본인 unit만 $pull
        //         await membersCol.updateOne(
        //             { "unit.user_key": user_key },
        //             { $pull: { unit: { user_key } } }
        //         );
        //         // 2. tables에서 row 삭제
        //         await tablesCol.deleteOne({ user_key });
        //
        //         // 3. DynamoDB USER_TABLE: 본인 row만 삭제
        //         await dynamoDB.delete({
        //             TableName: USER_TABLE,
        //             Key: { user_key }
        //         }).promise();
        //
        //         // 4. DEVICE_TABLE: 본인 user_key + device_id로 row만 삭제
        //         for (const device_id of deviceIds) {
        //             await dynamoDB.delete({
        //                 TableName: DEVICE_TABLE,
        //                 Key: { device_id, user_key }
        //             }).promise();
        //         }
        //
        //         // History/S3/RecordTable은 손 안댐
        //         return res.status(200).send("부계약자 회원탈퇴 성공");
        //     }
        // },

        // async renewalSaveUserKey(req, res) {
        //     const data = req.body;
        //     const bodyData = data.bodyData;
        //     const userData = data.userData;
        //
        //     // 로그인 로그 저장
        //     new AwsLogin({ ...bodyData, id: bodyData.user_id, up_key: bodyData.upKey }).save()
        //         .then(() => {
        //             console.log(`${bodyData.user_id} - Login-log Save Success`);
        //         })
        //         .catch(err => {
        //             console.log(err);
        //             console.log(`${bodyData.user_id} - Login-log Save Fail`);
        //         });
        //
        //     try {
        //         const {collection:tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
        //         const findData = await tablesCol.findOne({ id: bodyData.user_id });
        //
        //         if (!findData) {
        //             console.log(`Login-id:${bodyData.user_id}- No user found`);
        //             return res.status(404).send('User not found');
        //         }
        //
        //         if (findData.user_key === null) {
        //             const membersCol = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
        //
        //             await tablesCol.findOneAndUpdate(
        //                 { id: bodyData.user_id },
        //                 { $set: { user_key: userData.user_key } }
        //             );
        //
        //             if(findData.contract_service === "주계약자"){
        //                 await membersCol.insertOne({
        //                     groupName:`${findData.name} group`,
        //                     user_key:userData.user_key,
        //                     unit:[
        //                         {
        //                             user_key: userData.user_key,
        //                             email:findData.email,
        //                             device_info:[],
        //                             token:null,
        //                             auth:true,
        //                             state:"ACTIVE",
        //                             join_at:moment().tz('Asia/Seoul').toDate()
        //                         }
        //                     ],
        //                     create_at:moment().tz('Asia/Seoul').toDate()
        //                 });
        //             }
        //
        //
        //             if(findData.company === "Sunil"){
        //                 const eaglesSave = {
        //                     id: bodyData.user_id,
        //                     user_key: userData.user_key
        //                 };
        //                 this.eaglesSafesOverseasSave("saveUserKey", eaglesSave);
        //             }
        //             // ✅ 부계약자라면 members의 unit 안에도 user_key 넣고 상태 ACTIVE로 변경
        //
        //             // unit에 내 email로 포함된 모든 그룹 찾기
        //             const updateResult = await membersCol.updateMany(
        //                 { "unit.email": findData.email }, // 내 email이 포함된 그룹만
        //                 {
        //                     $set: {
        //                         "unit.$[elem].user_key": userData.user_key,
        //                         "unit.$[elem].state": "ACTIVE" // 상태도 ACTIVE로
        //                     }
        //                 },
        //                 { arrayFilters: [ { "elem.email": findData.email } ] }
        //             );
        //
        //             // (optional) 만약 해당 그룹에 unit 자체가 없다면, 따로 추가해줄 필요는 없음. (정상적인 흐름에선 이미 있음)
        //             // 혹시 진짜 edge case로 unit에 없는 유저라면, 로그만 남기고 무시.
        //
        //             // 확인용 로그
        //             if (updateResult.modifiedCount > 0) {
        //                 console.log(`Login-id:${bodyData.user_id}- user_key & state updated in members.unit`);
        //             } else {
        //                 console.log(`Login-id:${bodyData.user_id}- Not found in any group unit`);
        //             }
        //
        //             console.log(`Login-id:${bodyData.user_id}- user_key Save Success`);
        //             return res.status(200).send('success');
        //         } else {
        //             console.log(`Login-id:${bodyData.user_id}- This is already saved user_key`);
        //             return res.status(200).send('Saved user_key');
        //         }
        //     } catch (err) {
        //         console.log(err);
        //         return res.status(400).send(err);
        //     }
        // }
    }
}

module.exports = users;
