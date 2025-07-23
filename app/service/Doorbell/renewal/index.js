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
    AWS_TOKEN, SUNIL_MONGO_URI
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
                        company,
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


        async renewalSaveDeviceId(req, res) {
            let { user_key, device_id } = req.body;

            try {
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const findData = await tablesCol.findOne({ user_key });

                if (!findData) {
                    return res.status(404).send('User not found');
                }

                device_id = device_id.toLowerCase();

                if (!findData.device_id || findData.device_id === "") {
                    // device_id가 null이거나 빈 문자열인 경우 새로 저장
                    await tablesCol.findOneAndUpdate(
                        { user_key },
                        { $set: { device_id } }
                    );
                    console.log(`${findData.id}-${findData.name}-${device_id} saved`);
                    //return res.status(200).send('success');
                } else {
                    const dataArray = findData.device_id.toLowerCase().split(',');

                    if (dataArray.includes(device_id)) {
                        //return res.status(200).send(`device_id:${device_id} - This is already saved device_id`);
                    } else {
                        const updatedDeviceId = findData.device_id + "," + device_id;
                        await tablesCol.findOneAndUpdate(
                            { user_key },
                            { $set: { device_id: updatedDeviceId } }
                        );
                        console.log(`${findData.id}-${findData.name}-${device_id} saved`);
                        //return res.status(200).send('success');
                    }
                }
                const groups = await membersCol.findOne({ user_key });
                const targetUnit = (groups.unit || []).find(u => u.user_key === user_key);
                await membersCol.updateOne(
                    { user_key, "unit.user_key": user_key },
                    { $set: { "unit.$.device_info": [
                                {
                                    device_id,
                                    device_name:"noname",
                                    privacy: false,
                                    alarm_event: true,
                                    motion_event: true
                                },
                                ...((targetUnit && targetUnit.device_info) || [])
                            ] } }
                );

                return res.status(200).send('success')

            } catch (err) {
                console.error('Error in saveDeivceId:', err);
                return res.status(500).send('Internal Server Error');
            }
        },

        async renewalSaveUserKey(req, res) {
            const data = req.body;
            const bodyData = data.bodyData;
            const userData = data.userData;

            // 로그인 로그 저장 (실패해도 본 로직에 영향 X)
            new AwsLogin({
                ...bodyData,
                id: bodyData.user_id,
                up_key: bodyData.upKey
            }).save()
                .then(() => {
                    console.log(`${bodyData.user_id} - Login-log Save Success`);
                })
                .catch(err => {
                    console.log(err);
                    console.log(`${bodyData.user_id} - Login-log Save Fail`);
                });

            try {
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');

                // 1. tables에서 user_key 없으면 저장
                const findData = await tablesCol.findOne({ id: bodyData.user_id });
                if (!findData) {
                    console.log(`Login-id:${bodyData.user_id} - No user found`);
                    return res.status(404).send('User not found');
                }
                let didUpdate = false;
                if (!findData.user_key) {
                    await tablesCol.findOneAndUpdate(
                        { id: bodyData.user_id },
                        { $set: { user_key: userData.user_key } }
                    );
                    didUpdate = true;
                    // 특수 회사(e.g. Sunil) 추가 로직
                    if (findData.company === "Sunil") {
                        const eaglesSave = {
                            id: bodyData.user_id,
                            user_key: userData.user_key
                        };
                        serviceAPI().eaglesSafesOverseasSave("saveUserKey", eaglesSave);
                    }
                    console.log(`Login-id:${bodyData.user_id} - user_key saved in tables`);
                }

                // 2. (선택) 본인이 그룹의 마스터(user_key)라면, group.members에서도 user_key 없으면 저장
                const myGroup = await membersCol.findOne({ user_key: userData.user_key });
                if (myGroup && !myGroup.user_key) {
                    await membersCol.updateOne(
                        { _id: myGroup._id },
                        { $set: { user_key: userData.user_key } }
                    );
                    didUpdate = true;
                    console.log(`Login-id:${bodyData.user_id} - user_key saved in my group`);
                }

                // 3. 그룹의 unit으로 속해있는 경우, 내 email이 unit에 있는데 user_key 없는 경우만 업데이트
                const unitUpdateResult = await membersCol.updateMany(
                    { "unit.email": findData.email, "unit.user_key": { $ne: userData.user_key } },
                    {
                        $set: {
                            "unit.$[elem].user_key": userData.user_key
                        }
                    },
                    { arrayFilters: [{ "elem.email": findData.email, "elem.user_key": { $ne: userData.user_key } }] }
                );
                if (unitUpdateResult.modifiedCount > 0) {
                    didUpdate = true;
                    console.log(`Login-id:${bodyData.user_id} - user_key updated in group units`);
                }

                // 모두 이미 있으면 별도 메시지
                if (!didUpdate) {
                    console.log(`Login-id:${bodyData.user_id} - user_key already set everywhere`);
                    return res.status(200).send('Saved user_key');
                }

                // 하나라도 새로 저장/업데이트 했으면
                return res.status(200).send('success');
            } catch (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }
        },

        async renewalUpdateDeviceInfo(req, res) {
            const data = req.body;
            console.log(data);

            try {
                // 1. DynamoDB에서 device_id로 모든 row 조회
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

                // 2. MongoDB group에 device_name 동기화 (마스터만)
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');

                const allGroups = await membersCol.find({ "unit.device_info.device_id": data.device_id }).toArray();

                for (const group of allGroups) {
                    for (let unitIdx = 0; unitIdx < (group.unit || []).length; unitIdx++) {
                        const unit = group.unit[unitIdx];
                        if (!Array.isArray(unit.device_info)) continue;
                        for (let deviceIdx = 0; deviceIdx < unit.device_info.length; deviceIdx++) {
                            const device = unit.device_info[deviceIdx];
                            if (device.device_id !== data.device_id) continue;
                            // DynamoDB에 저장된 device_name 적용 (해당 user_key+device_id 조합)
                            const dynamoItem = queryResult.Items.find(i => i.user_key === unit.user_key && i.device_id === data.device_id);
                            const device_name = (dynamoItem && dynamoItem.device_name) || "noname";
                            let newDeviceInfo = { ...device, device_name };

                            // (옵션) 나머지 값들 갱신
                            if ('privacy' in data) newDeviceInfo.privacy = data.privacy;
                            if ('wifi_quality' in data) newDeviceInfo.wifi_quality = data.wifi_quality;
                            if ('firmware' in data) newDeviceInfo.firmware = data.firmware;
                            if ('ac' in data) newDeviceInfo.ac = data.ac;
                            if ('pir' in data) newDeviceInfo.pir = data.pir;
                            if ('battery_status' in data) newDeviceInfo.battery_status = data.battery_status;

                            const setPath = `unit.${unitIdx}.device_info.${deviceIdx}`;
                            await membersCol.updateOne(
                                { _id: group._id },
                                { $set: { [setPath]: newDeviceInfo } }
                            );
                        }
                    }
                }

                // for (const item of queryResult.Items) {
                //     const { user_key, device_id } = item;
                //     // 해당 그룹의 마스터 unit 찾기
                //     const group = await membersCol.findOne({ "unit.user_key": user_key, "unit.auth": true });
                //     if (!group) continue;
                //     const masterUnitIdx = (group.unit || []).findIndex(u => u.user_key === user_key && u.auth === true);
                //     if (masterUnitIdx === -1) continue;
                //     const masterUnit = group.unit[masterUnitIdx];
                //     const deviceInfoIdx = (masterUnit.device_info || []).findIndex(d => d.device_id === device_id);
                //     if (deviceInfoIdx === -1) continue;
                //
                //     // device_name은 DynamoDB 값으로 덮어쓰기, 나머지는 기존 방식대로 갱신
                //     let newDeviceInfo = { ...masterUnit.device_info[deviceInfoIdx] };
                //     newDeviceInfo.device_name = item.device_name || "noname";
                //     if ('privacy' in data) newDeviceInfo.privacy = data.privacy;
                //     if ('wifi_quality' in data) newDeviceInfo.wifi_quality = data.wifi_quality;
                //     if ('firmware' in data) newDeviceInfo.firmware = data.firmware;
                //     if ('ac' in data) newDeviceInfo.ac = data.ac;
                //     if ('pir' in data) newDeviceInfo.pir = data.pir;
                //     if ('battery_status' in data) newDeviceInfo.battery_status = data.battery_status;
                //
                //     const setPath = `unit.${masterUnitIdx}.device_info.${deviceInfoIdx}`;
                //     const updateResult = await membersCol.updateOne(
                //         { _id: group._id },
                //         { $set: { [setPath]: newDeviceInfo } }
                //     );
                //     if (updateResult.modifiedCount > 0) updatedCount++;
                // }

                // 3. DynamoDB 업데이트 (기존 방식과 동일)
                const updateResults = [];
                let updateExpression = `set wifi_quality = :wifi_quality, privacy = :privacy, firmware = :firmware`;
                let expressionAttributeValues = {
                    ':wifi_quality': data.wifi_quality,
                    ':privacy': data.privacy,
                    ':firmware': data.firmware,
                };
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

                // 👉 리스폰스는 기존 포맷 그대로!
                res.json({
                    message: 'Device data updated successfully for all users',
                    data: updateResults
                });

            } catch (error) {
                console.error('Error updating device data:', error);
                res.status(500).json({ error: 'Could not update device data' });
            }
        },


        async renewalDeleteDeviceId(req, res) {
            const data = req.body;
            console.log(data);
            const lowerDeviceId = data.device_id.toLowerCase();
            const token = req.headers['token'];

            if (!data.device_id) {
                console.log('There is no device_id inside the body.');
                return res.status(400).json({ error: 'There is no device_id inside the body.' });
            }
            if (!token) {
                console.log('Token not found.');
                return res.status(400).send('Token not found.');
            }

            let verify;
            try {
                verify = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                return res.status(401).json({ error: 'Token invalid.' });
            }

            // 1. 마스터 그룹 조회
            const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const group = await membersCol.findOne({ user_key: verify.user_key });
            if (!group) {
                return res.status(404).json({ error: "Group (master) not found." });
            }

            // 2. unit에서 해당 device_id를 가진 모든 그룹원(user_key) 추출
            const targetUserKeys = [];
            (group.unit || []).forEach(u => {
                if (
                    u.user_key &&
                    Array.isArray(u.device_info) &&
                    u.device_info.some(d => (d.device_id || '').toLowerCase() === lowerDeviceId)
                ) {
                    targetUserKeys.push(u.user_key);
                }
            });
            // 마스터 본인도 device_info에 해당 device_id가 있으면 추가
            if (
                group.user_key &&
                (group.unit || []).some(u =>
                    u.user_key === group.user_key &&
                    Array.isArray(u.device_info) &&
                    u.device_info.some(d => (d.device_id || '').toLowerCase() === lowerDeviceId)
                )
            ) {
                targetUserKeys.push(group.user_key);
            }
            // (중복 방지)
            const uniqueUserKeys = Array.from(new Set(targetUserKeys));

            // 3. FCM 푸시: 마스터 제외, state == ACTIVE, device_id 있는 유닛만
            const unitsToPush = (group.unit || []).filter(u =>
                u.user_key &&                            // 가입자만
                u.user_key !== group.user_key &&         // 마스터 제외
                u.state === "ACTIVE" &&                  // 활성화
                Array.isArray(u.device_info) &&
                u.device_info.some(d => (d.device_id || '').toLowerCase() === lowerDeviceId)
            );
            const pushArr = unitsToPush.map(unit => {
                const alias = unit.alias_name || group.group_name;
                return {
                    user_key: unit.user_key,
                    title: `[${alias}]기기 삭제`,
                    message: "그룹장이 해당 기기를 그룹에서 삭제했습니다.",
                    fileName: "deleteDeviceId"
                };
            });
            if (pushArr.length > 0) {
                try {
                    await axios.post(
                        "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                        { push: pushArr },
                        { headers: { "x-access-token": req.headers["token"] } }
                    );
                } catch (e) {
                    console.error("FCM Push Error:", e?.response?.data || e.message);
                }
            }

            // 4. 그룹장 본인만 tables.device_id에서 해당 device_id만 삭제
            const findUser = await tablesCol.findOne({ user_key: verify.user_key });
            if (findUser) {
                let updatedDeviceIds = findUser.device_id !== null
                    ? findUser.device_id.split(',').filter(id => id !== lowerDeviceId).join(',')
                    : null;
                if (updatedDeviceIds === '') updatedDeviceIds = null;
                await tablesCol.updateOne(
                    { _id: findUser._id },
                    { $set: { device_id: updatedDeviceIds } }
                );
            }

            // 5. 그룹 내 unit.device_info에서도 해당 device_id 객체만 삭제 (마스터/그룹원 모두)
            const updatedUnits = (group.unit || []).map(unit => {
                if (Array.isArray(unit.device_info)) {
                    return {
                        ...unit,
                        device_info: unit.device_info.filter(d => (d.device_id || '').toLowerCase() !== lowerDeviceId)
                    };
                }
                return unit;
            });
            await membersCol.updateOne(
                { _id: group._id },
                { $set: { unit: updatedUnits } }
            );

            // 6. History 컬렉션(몽고)에서 해당 device_id 전체 삭제
            await History.deleteMany({ device_id: lowerDeviceId });

            // 7. DynamoDB DEVICE_TABLE에서 해당 user_key+device_id로 삭제 (기존처럼)
            const DEVICE_TABLE = 'DEVICE_TABLE';
            for (const user_key of uniqueUserKeys) {
                await dynamoDB.delete({
                    TableName: DEVICE_TABLE,
                    Key: {
                        device_id: lowerDeviceId,
                        user_key: user_key
                    }
                }).promise();
            }

            // 8. RECORD_TABLE, S3: device_id 기준으로 일괄 삭제 (user_key 기준X)
            const RECORD_TABLE = "RECORD_TABLE";
            const BUCKET_NAME = "doorbell-video";
            const s3 = new AWS.S3();

            // RECORD_TABLE: device_id로 등록된 모든 레코드 삭제 (file_location=정렬키)
            const scanResult = await dynamoDB.scan({
                TableName: RECORD_TABLE,
                FilterExpression: 'device_id = :device_id',
                ExpressionAttributeValues: { ':device_id': lowerDeviceId }
            }).promise();
            if (scanResult.Items && scanResult.Items.length > 0) {
                for (const record of scanResult.Items) {
                    await dynamoDB.delete({
                        TableName: RECORD_TABLE,
                        Key: {
                            device_id: record.device_id,
                            file_location: record.file_location
                        }
                    }).promise();
                }
            }

            // S3: device_id 변환한 prefix로 버킷 전체 삭제
            const s3ObjectPrefix = lowerDeviceId.replace(/:/g, '_') + '/';
            let continuationToken;
            do {
                const listedObjects = await s3.listObjectsV2({
                    Bucket: BUCKET_NAME,
                    Prefix: s3ObjectPrefix,
                    ContinuationToken: continuationToken
                }).promise();
                if (listedObjects.Contents && listedObjects.Contents.length > 0) {
                    await s3.deleteObjects({
                        Bucket: BUCKET_NAME,
                        Delete: {
                            Objects: listedObjects.Contents.map(object => ({ Key: object.Key }))
                        }
                    }).promise();
                }
                continuationToken = listedObjects.IsTruncated ? listedObjects.NextContinuationToken : null;
            } while (continuationToken);

            // 마지막 결과 로깅 및 응답
            const lastData = await tablesCol.findOne({ user_key: verify.user_key });

            res.status(200).json({
                msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
                changeData: lastData
            });
        }

    }

}

module.exports = renewals;
