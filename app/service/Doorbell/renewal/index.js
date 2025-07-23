const applyDotenv = require("../../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const {ConnectMongo} = require("../../ConnectMongo");
const {verify} = require("jsonwebtoken");
const axios = require("axios");
const db = require("../../../DataBase");
const moment = require("moment-timezone");
const jwt = require("jsonwebtoken");
const serviceAPI = require("../../api/api");
const AWSAPI = require("../../../router/AWS");

const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME,
    AWS_TOKEN, SUNIL_MONGO_URI, AWS_LAMBDA_SIGNUP,GROUP_MONGO_URI,GROUP_DB_NAME
} = applyDotenv(dotenv)

AWS.config.update({
    accessKeyId: AWS_SECRET,
    secretAccessKey: AWS_ACCESS,
    region: AWS_REGION
});

const AwsLogin = db.AWSLogin

const dynamoDB = new AWS.DynamoDB.DocumentClient();



// 1. 회원가입 ( 그룹 자동생성 및 lambda에서 response 받은걸로 user_key 바로 저장 ) - renewalSignUp
// 2. 회원 탈퇴 ( 그룹 내 그룹원들 fcm 보내고 본인+그룹원 포함 디바이스 테이블 삭제, 그외 테이블들은 본인 tables 계정 삭제 + s3,레코드,history 삭제) - renewalSignOut
// 3. 마스터 디바이스아이디 추가 ( 그룹 내 본인 unit에 저장 )- renewalSaveDeviceId
// 4. 유저키 동기화 ( 업데이트 할 유저키가 있을경우 그룹 디비까지 업데이트 ) - renewalSaveUserKey
// 5. 디바이스 정보 업데이트 ( 마스터의 다이나모디비 디바이스 테이블의 device_name과 그룹의 본인 unit 내 device_info 내  device_name 동기화 ) -renewalUpdateDeviceInfo
// 6. 마스터 디바이스 아이디 삭제 ( 해당 디바이스 아이디의 권한 찾은 후 그룹원 포함 디바이스테이블 순회하며 삭제 + fcm도 보냄 , 본인 tables에서 device_id 삭제 필터로
// s3, 레코드, history는 디바이스아이디로 필요값들 돌거나 다이렉트 삭제 ) -renewalDeleteDeviceId

const renewals = function () {
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
                const {collection: membersCol} = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');
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
                        company,
                        user_key:newUserKey,
                        unit:[
                            {
                                user_key:newUserKey,
                                user_name:data.name,
                                alias_name:null,
                                email:data.user_email,
                                latest_device_id:"",
                                device_info:[],
                                token:null,
                                auth:true,
                                state:"ACTIVE",
                                join_at:moment().tz('Asia/Seoul').toDate(),
                            }
                        ],
                        created_at:moment().tz('Asia/Seoul').toDate()
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
            const { collection: membersCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');
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


        async renewalSaveDeviceId(req, res) {
            let { user_key, device_id, device_name, op } = req.body;

            try {
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const { collection: membersCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');
                const findData = await tablesCol.findOne({ user_key });

                if (!findData) {
                    return res.status(404).send('User not found');
                }

                device_id = device_id.toLowerCase();

                const raw = (findData.device_id ?? "").trim();   // null/undefined 대비
                const lower = raw ? raw.toLowerCase().split(",").filter(Boolean) : [];
                if (!lower.includes(device_id)) {
                    const newValue = raw ? `${raw},${device_id}` : device_id;
                    await tablesCol.updateOne({ user_key }, { $set: { device_id: newValue } });
                }

                if (op === "update") {
                    // device_name만 수정 (값이 왔을 때만)
                    if (req.body.device_name !== undefined) {
                        await membersCol.updateOne(
                            {
                                user_key,
                                "unit.user_key": user_key,
                                "unit.auth": true,
                                "unit.device_info.device_id": device_id
                            },
                            {
                                $set: {
                                    "unit.$[u].device_info.$[d].device_name": device_name,
                                    "unit.$[u].latest_device_id": device_id
                                }
                            },
                            {
                                arrayFilters: [
                                    { "u.user_key": user_key, "u.auth": true },
                                    { "d.device_id": device_id }
                                ]
                            }
                        );
                    }
                } else { // create or 미지정
                    // 이미 있는지 확인 후 없으면 prepend
                    const groupDoc = await membersCol.findOne(
                        { user_key, "unit.user_key": user_key, "unit.auth": true },
                        { projection: { unit: { $elemMatch: { user_key, auth: true } } } }
                    );
                    if (!groupDoc?.unit?.length) return res.status(404).send("group/unit 없음");

                    const devArr = groupDoc.unit[0].device_info || [];
                    const exist = devArr.find(d => (d.device_id || "").toLowerCase() === device_id);

                    if (!exist) {
                        await membersCol.updateOne(
                            { user_key, "unit.user_key": user_key, "unit.auth": true },
                            {
                                $push: {
                                    "unit.$.device_info": {
                                        $each: [{ device_id, device_name, privacy: false }],
                                        $position: 0
                                    }
                                }
                            }
                        );
                    } else {
                        // 이미 있었으면 이름만 업데이트
                        await membersCol.updateOne(
                            {
                                user_key,
                                "unit.user_key": user_key,
                                "unit.auth": true,
                                "unit.device_info.device_id": device_id
                            },
                            {
                                $set: {
                                    "unit.$[u].device_info.$[d].device_name": device_name
                                }
                            },
                            {
                                arrayFilters: [
                                    { "u.user_key": user_key, "u.auth": true },
                                    { "d.device_id": device_id }
                                ]
                            }
                        );
                    }
                }
                // const groups = await membersCol.findOne({ user_key });
                // const targetUnit = (groups.unit || []).find(u => u.user_key === user_key);
                // await membersCol.updateOne(
                //     { user_key, "unit.user_key": user_key },
                //     { $set: { "unit.$.device_info": [
                //                 {
                //                     device_id,
                //                     device_name:"noname",
                //                     privacy: false
                //                 },
                //                 ...((targetUnit && targetUnit.device_info) || [])
                //             ] } }
                // );

                return res.status(200).send('success')

            } catch (err) {
                console.error('Error in saveDeivceId:', err);
                return res.status(500).send('Internal Server Error');
            }
        },



        async renewalDeleteDeviceId(req, res) {
            const data  = req.body;
            const token = req.headers['token'];

            if (!data.device_id) return res.status(400).json({ error: 'There is no device_id inside the body.' });
            if (!token)         return res.status(400).send('Token not found.');

            const lowerDeviceId = String(data.device_id).toLowerCase();

            let verify;
            try {
                verify = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                return res.status(401).json({ error: 'Token invalid.' });
            }

            // === 컬렉션 / 상수 ===
            const { collection: tablesCol  } = await ConnectMongo(MONGO_URI,       ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI,       ADMIN_DB_NAME, 'members');
            const DEVICE_TABLE = 'DEVICE_TABLE';
            const RECORD_TABLE = 'RECORD_TABLE';
            const BUCKET_NAME  = 'doorbell-video';
            const s3           = new AWS.S3();

            // 1. 그룹(마스터) 조회
            const group = await membersCol.findOne({ user_key: verify.user_key });
            if (!group) return res.status(404).json({ error: "Group (master) not found." });

            // 2. (그룹원은 건드리지 않음) 마스터 unit만 device_info에서 해당 device_id 제거
            await membersCol.updateOne(
                { user_key: verify.user_key, "unit.user_key": verify.user_key, "unit.auth": true },
                { $pull: { "unit.$.device_info": { device_id: lowerDeviceId } } }
            );

            // 3. tables.device_id 문자열에서 해당 id 제거 (마스터만)
            const findUser = await tablesCol.findOne({ user_key: verify.user_key });
            if (findUser) {
                let updated = (findUser.device_id || '')
                    .split(',')
                    .map(v => v.trim())
                    .filter(v => v && v.toLowerCase() !== lowerDeviceId)
                    .join(',');
                if (!updated) updated = null;
                await tablesCol.updateOne({ _id: findUser._id }, { $set: { device_id: updated } });
            }

            // 4. History 삭제
            await History.deleteMany({ device_id: lowerDeviceId });

            // 5. DynamoDB 삭제 (마스터만)
            await dynamoDB.delete({
                TableName: DEVICE_TABLE,
                Key: { device_id: lowerDeviceId, user_key: verify.user_key }
            }).promise();

            // 6. RECORD_TABLE 삭제 (device_id 기준)
            const scan = await dynamoDB.scan({
                TableName: RECORD_TABLE,
                FilterExpression: 'device_id = :id',
                ExpressionAttributeValues: { ':id': lowerDeviceId }
            }).promise();

            if (scan.Items?.length) {
                for (const r of scan.Items) {
                    await dynamoDB.delete({
                        TableName: RECORD_TABLE,
                        Key: { device_id: r.device_id, file_location: r.file_location }
                    }).promise();
                }
            }

            // 7. S3 삭제
            const prefix = lowerDeviceId.replace(/:/g, '_') + '/';
            let ct;
            do {
                const listed = await s3.listObjectsV2({
                    Bucket: BUCKET_NAME,
                    Prefix: prefix,
                    ContinuationToken: ct
                }).promise();

                if (listed.Contents?.length) {
                    await s3.deleteObjects({
                        Bucket: BUCKET_NAME,
                        Delete: { Objects: listed.Contents.map(o => ({ Key: o.Key })) }
                    }).promise();
                }
                ct = listed.IsTruncated ? listed.NextContinuationToken : null;
            } while (ct);

            // 8. 기존 리턴 형식 유지
            const lastData = await tablesCol.findOne({ user_key: verify.user_key });

            return res.status(200).json({
                msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                changeData: lastData
            });
        },


    }

}

module.exports = renewals;
