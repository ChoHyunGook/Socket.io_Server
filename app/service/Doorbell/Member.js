


const dotenv = require("dotenv");
const applyDotenv = require("../../../lambdas/applyDotenv");
const bcrypt = require('bcrypt')
const AWS = require("aws-sdk")
const nodemailer = require("nodemailer");
const moment = require("moment-timezone");
const axios = require("axios");
const CryptoJS = require('crypto-js')
const {ConnectMongo} = require('../ConnectMongo');
const db = require("../../DataBase");
const jwt = require("jsonwebtoken");


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, MONGO_URI, ADMIN_DB_NAME, SMS_service_id,
    SMS_secret_key, SMS_access_key, SMS_PHONE, NICE_CLIENT_ID, NICE_CLIENT_SECRET, NICE_PRODUCT_CODE,
    NICE_ACCESS_TOKEN, AWS_LAMBDA_SIGNUP,AWS_LAMBDA_SIGNIN,
    AWS_TOKEN, NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_SERVICE, NODEMAILER_HOST, SUNIL_MONGO_URI,
} = applyDotenv(dotenv)


const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS


AWS.config.update({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();


const DEVICE_TABLE = 'DEVICE_TABLE';

async function syncMemberDevicePermission(target_user_key, device_ids, master_user_key, dynamoDB) {
    // 1. 현재 이 멤버가 가진 device row 전체 조회
    const { Items: currentDevices = [] } = await dynamoDB.query({
        TableName: DEVICE_TABLE,
        KeyConditionExpression: 'user_key = :u',
        ExpressionAttributeValues: { ':u': target_user_key }
    }).promise();

    const currentDeviceIds = currentDevices.map(d => d.device_id);

    // 2. 요청 device_id 목록 정규화(소문자)
    const normalizedDeviceIds = device_ids.map(d => String(d).toLowerCase());

    // 3. 삭제 대상(더이상 권한 없는 device_id)
    const toDelete = currentDeviceIds.filter(id => !normalizedDeviceIds.includes(id));

    // 4. 신규 추가 대상(현재 없는데 요청에만 있는 device_id)
    const toAdd = normalizedDeviceIds.filter(id => !currentDeviceIds.includes(id));

    // 5. 삭제
    for (const device_id of toDelete) {
        await dynamoDB.delete({
            TableName: DEVICE_TABLE,
            Key: {
                device_id,
                user_key: target_user_key
            }
        }).promise();
    }

    // 6. 추가 (마스터꺼 복사해서)
    for (const device_id of toAdd) {
        const { Item: masterDevice } = await dynamoDB.get({
            TableName: DEVICE_TABLE,
            Key: {
                device_id,
                user_key: master_user_key
            }
        }).promise();

        if (!masterDevice) continue; // 마스터가 안 가진 경우 skip

        // 복사, user_key만 멤버로 변경
        const newDevice = { ...masterDevice, user_key: target_user_key };
        await dynamoDB.put({
            TableName: DEVICE_TABLE,
            Item: newDevice
        }).promise();
    }

    // (선택) 동기화 결과 반환하고 싶으면 return { deleted: toDelete, added: toAdd }
}



/**
 * Request 헤더의 토큰을 검증 후 user_key 등 반환.
 * 실패시 res에 401 전송 + null 반환.
 */
async function verifyTokenFromHeader(req, res) {
    const token = req.headers['token'];
    if (!token) {
        res.status(401).send("Unauthorized: Token is required.");
        return null;
    }
    try {
        // 동기 verify지만, async 함수로 만들어도 됨 (일관성 위해)
        const decoded = jwt.verify(token, process.env.AWS_TOKEN);
        return decoded; // { user_key: ... }
    } catch (e) {
        res.status(401).send("Unauthorized: Invalid token.");
        return null;
    }
}




const members = function () {
    return {
        //---------------------------- Group Home ( 화면 공통 ) ------------------------------//

        //계정정보 (계정정보, 그룹정보) - 그룹 Home
        async getInfo(req, res) {

            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;

            const user_key = verify.user_key;

            try {
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');


                // 1. 마스터(그룹장) 정보
                const findTablesMaster = await tablesCol.findOne({ user_key });
                const findGroupMaster = await membersCol.findOne({ user_key });

                //findGroupMaster의 unit의 email을 추출하여 tablesCol로 유저들 정보와 그룹의 정보 취합
                // let sendMasterData = {
                //     user_info:{
                //         //본인 정보 - findTablesMaster
                //     },
                //     group_info:{
                //         //본인 그룹 - findGroupMaster
                //         //여기의 unit을 넣을때 unit의 email의 값으로 tablesCol.findOne({ email })해서 member_info : {조회한 데이터} 추가.
                //         //저 email로 tables 조회 시 state가 INVITED_SIGNUP은 회원가입 전이라 조회 하지않고 member_info에 null을 주면됨.
                //     }
                // }
                let sendMasterData = null;
                if (findTablesMaster && findGroupMaster) {
                    // unit별로 tables에서 member_info 추가
                    const mergedUnit = await Promise.all(
                        (findGroupMaster.unit || []).map(async (u) => {
                            let member_info = null;
                            // INVITED_SIGNUP(회원가입 전)은 member_info null
                            if (u.state !== "INVITED_SIGNUP") {
                                member_info = await tablesCol.findOne({ email: u.email });
                            }
                            return {
                                ...u,
                                member_info
                            };
                        })
                    );
                    sendMasterData = {
                        user_info: findTablesMaster, //본인 정보
                        group_info: {
                            ...findGroupMaster,//본인 그룹정보(unit은 하단의 정제된 데이터 따로)
                            unit: mergedUnit // unit들의 개인 정보(tables)를 넣은 정제된 unit
                        }
                    }
                }

                // 2. 그룹원(본인이 unit으로 포함된 모든 그룹)
                const findGroupMemberArr = await membersCol.find({ "unit.user_key": user_key }).toArray();
                let sendUnitData = [];
                //본인이 속해있는 그룹의 모든 정보에서
                // let sendUnitData = [
                //     {
                //        master_info:{
                //            //해당 그룹의 그룹장의 정보, findGroupMember를 배열을 돌면서 user_key tablesCol.findOne({ user_key })하여 정보넣어야함
                //            //user_key, name, id, email
                //        },
                //         master_user_key: "",// 해당 마스터의 유저키정보
                //         unit_info:{}, // findGroupMember의 배열을 돌며 unit의 본인 user_key와 매칭하여 해당하는 본인 객체
                //         display_name:"",// 본인 객체인 unit_info에 넣은 unit내 본인 객체에서 alias_name이 없으면 해당 배열 돌던값의 .group_name 있을경우 unit 본인객체의 alias_name값
                //     },
                //     //...
                // ]
                for (const group of findGroupMemberArr) {
                    // [추가] 본인이 마스터인 그룹은 제외
                    if (group.user_key === user_key) continue;
                    // 마스터 정보
                    const master_info = await tablesCol.findOne({ user_key: group.user_key });
                    // 본인 unit 객체 찾기 => 로그인을 했으니 해당페이지에 접근 했으므로 user_key로 찾는게 정확함.
                    const unit_info = (group.unit || []).find(u => u.user_key === user_key);
                    // 표시 이름 - 그룹의 group_name이냐 본인이 설정한 값이 있으면 alias_name이냐
                    let display_name = unit_info?.alias_name || group.group_name || "";
                    sendUnitData.push({
                        master_info: master_info
                            ? { user_key: master_info.user_key, name: master_info.name, id: master_info.id, email: master_info.email }
                            : null, // 마스터 기본정보
                        master_user_key: group.user_key,// 해당 그룹의 마스터 유저키 - 바로 사용할 수 있도록
                        unit_info: unit_info || null, //unit들 (그룹원들) 중 본인 객체만
                        display_name // 그룹 selectBox 및 알림설정때 사용하는 그룹의 보여지게 하는 그룹이름
                    });
                }


                res.status(200).json({
                    master:sendMasterData,
                    unit:sendUnitData,
                    message:"find Group Info Successfully"
                })

            } catch (err) {
                return res.status(500).send(err);
            }
        },


        //그룹이름 변경 - 그룹자체의 group_name 업데이트 ( 마스터 )
        async patchGroupName(req,res){
            //verify된 user_key로 본인 데이터 찾고 거기 안에 group_name을 바꾸면 됨.
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;

            const user_key = verify.user_key;
            const { group_name } = req.body;
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');

            try {
                const result = await membersCol.findOneAndUpdate(
                    { user_key },
                    { $set: { group_name } }
                );

                if (!result.value) {
                    return res.status(404).json({ message: "Not found group" });
                }

                return res.status(200).json({ message: "update group_name successfully" });
            } catch (error) {
                console.error("patchGroupName error:", error);
                return res.status(500).send(error);
            }

        },

        //그룹원 이름 변경 - 마스터가 사용할 그룹원의 별칭 지정 - user_name ( 마스터 )
        async patchUnitUserName(req,res){
            //user_key, 유닛 유저키가 같이 있는 데이터 찾고 거기 unit에 unit_user_key로 본인 객체 찾고 거기 안에 user_name을 바꾸면 됨.

            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;

            const user_key = verify.user_key;
            const { unit_user_key, user_name } = req.body;
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');

            try {
                // 1. 그룹 문서에서 user_key, unit.user_key 일치하는 요소 찾기
                const group = await membersCol.findOne({ user_key, "unit.user_key": unit_user_key });
                if (!group) {
                    return res.status(404).json({ error: "Group or member not found." });
                }

                // 2. unit 배열에서 해당 멤버 찾기
                const unitMember = group.unit.find(u => u.user_key === unit_user_key);
                if (!unitMember) {
                    return res.status(404).json({ error: "Member not found in unit." });
                }

                // 3. user_name 변경
                unitMember.user_name = user_name;

                // 4. 몽고에 업데이트 (unit 전체를 저장)
                await membersCol.updateOne(
                    { user_key },
                    { $set: { unit: group.unit } }
                );

                return res.status(200).json({ message: "update user_name successfully" });
            } catch (error) {
                console.error("patchUnitUserName error:", error);
                return res.status(500).json({ message: "Internal Server Error" });
            }

        },

        //그룹 초기화 - unit 내의 본인 제외 배열을 돌며 device_info가 빈배열이 아니면 DynamoDB DEVICE_TABLE 순회하며 삭제 후 unit의 내부에서 본인(마스터) 유저키 제외한 값 삭제
        async deleteReset(req,res){
            //조회한 group에서 unit 배열을 돌면서 "state"가 "ACTIVE"인것들만 DynamoDB DEVICE_TABLE 삭제 해야함.
            // unit.user_key + device_info 배열을 또 돌면서 device_id + unit.user_key로 DEVICE_TABLE 삭제.
            // 또한 배열 돌고있는 unit.user_key가 본인 마스터 user_key일 경우 삭제하지 않음.
            // 위의 조건들이 충족이 되면 group의 unit에서 마스터 user_key를 제외한 객체들은 전부 삭제.
            // 그리고 다이나모 디바이스 테이블 삭제 전 unit 안에 "ACTIVE"인 user_key들을 모아서 fcm push알림 보내는데 아래가 보내는 body구조
            //{
            //     "push": [
            //         {
            //             "user_key": "96f06dbe-bc92-4ab5-aee5-4bf72e7285ee",
            //             "title": "[teeeeeest-1]message-postman",
            //             "message": "test-message",
            //             "fileName": "test"
            //         },
            //         {
            //             "user_key": "96f06dbe-bc92-4ab5-aee5-4bf72e7285ee",
            //             "title": "[teeeeeest-2]message-postman",
            //             "message": "test-message",
            //             "fileName": "test"
            //         },
            //         {
            //             "user_key": "96f06dbe-bc92-4ab5-aee5-4bf72e7285ee",
            //             "title": "[teeeeeest-3]message-postman",
            //             "message": "test-message",
            //             "fileName": "test"
            //         }
            //     ]
            // }
            // 저기 배열 내에 모아둔 user_key들을 말그대로 3개면 객체로 저렇게 3개를 만들고
            // title 스트링내부 []안에 unit 들이 alias_name을 설정하지않고 null 이라면 group.group_name을 넣고 있다면 alias_name을 넣고 그룹초기화.
            // message에는 그룹장이 그룹을 초기화 했습니다.라고 보내고 fileName은 "" 빈스트링 줘서 보내게 끔 해줘 순서는 너가 안꼬일 수 있게 잘해주고
            // 그리고 fcm push api 주소는 https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push 이거고
            // header에 x-access-token에 req.headers['token'] 넣어서 그대로 보내면 되.


            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            const user_key = verify.user_key;

            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key });

            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }

            // 1. unit에서 마스터(user_key) 제외 + state == "ACTIVE" 만 필터
            const unitsToReset = (group.unit || []).filter(u =>
                u.user_key !== user_key && !!u.user_key // user_key가 있는 것만 (가입자만)
            );

            // 2. FCM 푸시 보낼 데이터 준비
            const pushArr = unitsToReset.map((unit, idx) => {
                const alias = unit.alias_name || group.group_name;
                return {
                    user_key: unit.user_key,
                    title: `[${alias}]그룹초기화`,
                    message: "그룹장이 그룹을 초기화 했습니다.",
                    fileName: ""
                }
            });

            // 3. FCM 푸시 전송
            if (pushArr.length > 0) {
                try {
                    await axios.post(
                        "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                        { push: pushArr },
                        { headers: { "x-access-token": req.headers["token"] } }
                    );
                } catch (e) {
                    console.error("FCM Push Error:", e?.response?.data || e.message);
                    // 푸시 실패해도 일단 계속 진행 (원하면 실패시 return해도 됨)
                }
            }

            // 4. 각 unit의 device_info가 있으면 DynamoDB DEVICE_TABLE에서 삭제
            for (const unit of unitsToReset) {
                if (Array.isArray(unit.device_info)) {
                    for (const device of unit.device_info) {
                        try {
                            await req.app.locals.dynamoDB.delete({
                                TableName: DEVICE_TABLE,
                                Key: {
                                    device_id: device.device_id,
                                    user_key: unit.user_key
                                }
                            }).promise();
                        } catch (err) {
                            console.error("DynamoDB delete error:", err);
                        }
                    }
                }
            }

            // 5. unit에서 마스터(user_key)만 남기고 나머지 전부 삭제
            const masterUnit = (group.unit || []).find(u => u.user_key === user_key);
            const newUnitArr = masterUnit ? [masterUnit] : [];

            await membersCol.updateOne(
                { user_key },
                { $set: { unit: newUnitArr } }
            );

            return res.status(200).json({ message: "group reset successfully" });

        },

        //그룹원 추방 - unit 삭제 및 "ACTIVE"상태일 경우 device_info가 빈배열이 아니면 배열을 돌며 device_id + 해당 그룹원 user_key로 DynamoDB DEVICE_TABLE 삭제
        async deleteUnitRemove(req,res){
            // email와 조회한 group의 unit 배열에 email을 매칭해서 객체를 찾은 후
            // 찾은 객체의 state가 "ACTIVE"일 경우 device_info의 배열이 0이 아닐때 DynamoDB DEVICE_TABLE에서 찾은 객체의 unit.user_key + device_info 배열 돌고있는 device_id로 해당 데이터 삭제.
            // state가 그외의 경우 group의 unit내에서 같은 email인 객체 삭제
            // "ACTIVE"일 경우에는 똑같이 다이나모 디바이스 테이블 삭제 전 user_key들을 모아서 fcm push알림 보내는데 아래가 보내는 body구조
            //{
            //     "push": [
            //         {
            //             "user_key": "96f06dbe-bc92-4ab5-aee5-4bf72e7285ee",
            //             "title": "[teeeeeest-1]message-postman",
            //             "message": "test-message",
            //             "fileName": "test"
            //         }
            //     ]
            // }
            // title 스트링내부 []안에 unit 들이 alias_name을 설정하지않고 null 이라면 group.group_name을 넣고 있다면 alias_name을 넣고 그룹탈퇴.
            // message에는 그룹장이 []그룹에서 탈퇴 처리했습니다.라고 보내고 fileName은 "" 빈스트링 줘서 보내게 끔 해줘 순서는 너가 안꼬일 수 있게 잘해주고
            //메세지 []에도 그룹이름, 알리아스이름은 똑같이 체크하고 fcm 보내고
            // 그리고 fcm push api 주소는 https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push 이거고
            // header에 x-access-token에 req.headers['token'] 넣어서 그대로 보내면 되.

            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            const user_key = verify.user_key;

            const { email } = req.body;

            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key });

            // 1. 추방 대상 unit 찾기 (이메일로)
            const targetUnit = (group.unit || []).find(u => u.email === email);
            if (!targetUnit) {
                return res.status(404).json({ message: "Not found target_unit" });
            }

            // 2. "ACTIVE"인 경우 device_info 삭제 + FCM push
            if (targetUnit.user_key) {
                // 2-1. device_info 있으면 DynamoDB DEVICE_TABLE에서 삭제
                if (Array.isArray(targetUnit.device_info) && targetUnit.device_info.length > 0) {
                    for (const device of targetUnit.device_info) {
                        try {
                            await req.app.locals.dynamoDB.delete({
                                TableName: DEVICE_TABLE,
                                Key: {
                                    device_id: device.device_id,
                                    user_key: targetUnit.user_key
                                }
                            }).promise();
                        } catch (err) {
                            console.error("DynamoDB delete error:", err);
                        }
                    }
                }

                // 2-2. FCM push 준비
                const alias = targetUnit.alias_name || group.group_name;
                const pushArr = [
                    {
                        user_key: targetUnit.user_key,
                        title: `[${alias}]그룹탈퇴`,
                        message: `그룹장이 [${alias}]그룹에서 탈퇴 처리했습니다.`,
                        fileName: ""
                    }
                ];

                try {
                    await axios.post(
                        "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                        { push: pushArr },
                        { headers: { "x-access-token": req.headers["token"] } }
                    );
                } catch (e) {
                    console.error("FCM Push Error:", e?.response?.data || e.message);
                    // push 실패해도 계속 진행
                }
            }

            // 3. unit 배열에서 해당 email의 객체 삭제
            const newUnit = (group.unit || []).filter(u => u.email !== email);

            await membersCol.updateOne(
                { user_key },
                { $set: { unit: newUnit } }
            );

            return res.status(200).json({ message: "Target unit deleted successfully" });

        },




        //---------------------------- Group Home ( Unit ) ------------------------------//

        //그룹이름 변경 - 그룹원이 본인이 속해있는 그룹의 별칭 지정 - alias_name ( 그룹원 )
        async patchUnitAliasName(req,res){
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            const user_key = verify.user_key;

            const { master_user_key, alias_name } = req.body;

            if (!master_user_key || !alias_name) {
                return res.status(400).send("master_user_key and alias_name are required.");
            }

            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key: master_user_key });
            //group에서 user_key로 unit 내 본인 객체를 찾고
            //그 객체에서 바디에서 받은 alias_name을 그대로 업데이트
            if (!group) {
                return res.status(404).send("Group not found.");
            }
            // unit 내 본인(user_key) 객체가 존재하는지 체크
            const unitIdx = (group.unit || []).findIndex(u => u.user_key === user_key);
            if (unitIdx === -1) {
                return res.status(404).send("Member not found in group.");
            }

            // unit 내 해당 객체의 alias_name 업데이트
            const updateField = {};
            updateField[`unit.${unitIdx}.alias_name`] = alias_name;

            await membersCol.updateOne(
                { user_key: master_user_key },
                { $set: updateField }
            );

            res.status(200).send("Alias name updated successfully.");
        },

        //기기 이름 변경 - 그룹원이 권한을 받은 기기의 별칭 지정 - device_name ( 그룹원 )
        async patchUnitDeviceName(req,res){
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            const user_key = verify.user_key;

            const { master_user_key, device_id, device_name } = req.body;

            if (!master_user_key || !device_id || !device_name) {
                return res.status(400).send("master_user_key, device_id, device_name are required.");
            }


            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key: master_user_key });
            if (!group) {
                return res.status(404).send("Group not found.");
            }
            //group에서 user_key로 unit 내 본인 객체를 찾고
            //그 객체에서 device_info 배열 내 바디에서 받은 device_id로 객체를 찾아 낸 후 객체의 device_name을 바디에서 받은 값으로 변경 후 response

            // unit 내 본인 객체 찾기
            const unitIdx = (group.unit || []).findIndex(u => u.user_key === user_key);
            if (unitIdx === -1) {
                return res.status(404).send("Member not found in group.");
            }

            // device_info 내 해당 device_id의 인덱스 찾기
            const deviceInfoArr = group.unit[unitIdx].device_info || [];
            const deviceIdx = deviceInfoArr.findIndex(d => d.device_id === device_id);
            if (deviceIdx === -1) {
                return res.status(404).send("Device not found in your device list.");
            }

            // device_name 필드 업데이트
            const updateField = {};
            updateField[`unit.${unitIdx}.device_info.${deviceIdx}.device_name`] = device_name;

            await membersCol.updateOne(
                { user_key: master_user_key },
                { $set: updateField }
            );

            // 2. DynamoDB DEVICE_TABLE에도 업데이트
            await dynamoDB.update({
                TableName: 'DEVICE_TABLE',
                Key: {
                    device_id: device_id,
                    user_key: user_key
                },
                UpdateExpression: 'set device_name = :device_name',
                ExpressionAttributeValues: { ':device_name': device_name }
            }).promise();

            res.status(200).send("Device name updated successfully.");
        },

        //그룹탈퇴 - 본인이 그룹에서 본인 unit 객체 삭제, device_info가 빈배열이 아니면 본인 user_key+device_id 매칭하며 배열을 돌면서 DynamoDB DEVICE_TABLE 삭제
        async deleteUnitLeave(req,res){
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            const user_key = verify.user_key;

            const { master_user_key } = req.body;
            if (!master_user_key) return res.status(400).send("master_user_key is required.");

            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key: master_user_key });
            if (!group) return res.status(404).send("Group not found.");
            // 조회한 group의 unit 에서 본인 삭제
            // group.unit의 배열안에서 본인의 user_key로 본인 객체를 찾은 후 state가 "ACTIVE"인지 체크
            // 찾은 본인의 객체에서 device_info의 배열 길이가 0이 아니면 배열을 돌면서 device_id + 본인 user_key 매칭해서 다이나모디비 삭제
            // 아닐경우 group에서 unit내 본인 객체만 삭제
            // 삭제 전 fcm 메세지를 보내는데 마스터에게 본인이 탈퇴했다는 내용을 보내야함.
            //{
            //     "push": [
            //         {
            //             "user_key": "96f06dbe-bc92-4ab5-aee5-4bf72e7285ee",
            //             "title": "[teeeeeest-1]message-postman",
            //             "message": "test-message",
            //             "fileName": "test"
            //         }
            //     ]
            // }
            // 저기 푸시 내부 user_key는 master_user_key 값이고 x-access-token은 req.headers['token'].
            // 앞과 달리 [] 내부에 그룹장에게 보내기때문에 group_name으로 넣고 본인 unit의 user_name이 그룹 탈퇴.
            // 메세지에도 [] 내부에 그룹장에게 보내기때문에 group_name으로 넣고 본인 unit의 user_name이 그룹을 탈퇴하였습니다.하고 fileName은 ""
            // 그리고 fcm push api 주소는 https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push
            // 본인 unit 객체 찾기
            const myUnit = (group.unit || []).find(u => u.user_key === user_key);
            if (!myUnit) return res.status(404).send("You are not a member of this group.");

            // device_info가 빈 배열이 아니면 DEVICE_TABLE 삭제 (user_key+device_id)
            if (Array.isArray(myUnit.device_info) && myUnit.device_info.length > 0) {
                for (const device of myUnit.device_info) {
                    await dynamoDB.delete({
                        TableName: "DEVICE_TABLE",
                        Key: {
                            device_id: device.device_id,
                            user_key: user_key
                        }
                    }).promise();
                }
            }
            // 그룹에서 본인 unit 객체 삭제
            await membersCol.updateOne(
                { user_key: master_user_key },
                { $pull: { unit: { user_key } } }
            );

            // FCM 푸시 발송 (마스터에게)
            const pushPayload = {
                push: [
                    {
                        user_key: master_user_key,
                        title: `[${group.group_name}] 그룹 탈퇴`,
                        message: `${myUnit.user_name}님이 그룹을 탈퇴하였습니다.`,
                        fileName: ""
                    }
                ]
            };
            try {
                await axios.post(
                    "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push",
                    pushPayload,
                    {
                        headers: {
                            'x-access-token': req.headers['token']
                        }
                    }
                );
            } catch (pushErr) {
                // 푸시 에러는 알림만, 탈퇴 자체는 정상 진행
                console.error('FCM push error:', pushErr?.response?.data || pushErr);
            }

            return res.status(200).send("You have successfully left the group.");
        },


        //---------------------------- Invite Page ----------------------------//

        //초대할 사람 찾기 - company + email을 body로 받아서 조회
        async postInviteFind(req,res){
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;

            const user_key = verify.user_key;

            const { company, email }= req.body;

            if (!company || !email) {
                return res.status(400).send("company, email are required.");
            }

            const { collection: tableCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');

            // email이 있으면 같은 company인지 체크 후 같은 company일 경우에는 해당 회원의 정보가 조회되면 되고
            // email정보로 조회했을때 정보가 없으면 회원가입 그룹초대 이메일 보내라는 메세지
            // 위에 조건에 조회가 됫다면 회원정보 마스킹처리해서 전송
            const findUsers = await tableCol.findOne({email})
            const findGroups = await membersCol.findOne({user_key, "unit.email": email})
            if(findGroups){
                return res.status(400).send("The user is already part of this group.");
            }

            if(!findUsers){
                res.status(200).json({signUp:true});
            }

            if(findUsers.company !== company){
                res.status(400).send("This user is not registered under the same company.")
            }

            function maskString(str) {
                if (!str) return "";
                const len = str.length;
                if (len === 1) return str;
                if (len === 2) return str[0] + '*';

                // 3글자 이상
                if (/^[a-zA-Z]+$/.test(str)) {
                    // 영어인 경우, 첫글자만 남기고 뒤는 *
                    return str[0] + '*'.repeat(len - 2) + str[len - 1];
                } else {
                    // 한글인 경우, 첫글자 + * + 끝글자 (가운데 *)
                    return str[0] + '*'.repeat(len - 2) + str[len - 1];
                }
            }


            function maskPhone(tel) {
                if (!tel) return "";
                // 숫자만 추출
                const digits = tel.replace(/\D/g, "");
                if (digits.length < 9) return tel; // 짧은 번호는 마스킹X

                // 국번(앞 3~4자리) + 뒷 8자리 분리
                const prefix = digits.slice(0, digits.length - 8);
                const mid4 = digits.slice(-8, -4);
                const last4 = digits.slice(-4);

                // 각 4자리에서 가운데 2자리 마스킹
                function maskFour(s) {
                    if (s.length !== 4) return s;
                    return s[0] + "**" + s[3];
                }

                // 최종 조합
                return `${prefix}-${maskFour(mid4)}-${maskFour(last4)}`;
            }



            res.status(200).json({
                signUp:false,
                name:maskString(findUsers.name),
                id:maskString(findUsers.id),
                tel:maskPhone(findUsers.tel),
                email
            })


        },



        //초대하는 Email보내기(html로 버튼) => 기존 회원
        async postInviteSend(req,res){
            const verify = await verifyTokenFromHeader(req, res);
            if (!verify) return;
            let { email } = req.body;

            const user_key = verify.user_key;
            try {
                const { collection: tableCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');

                const findMaster = await tableCol.findOne({user_key});
                const findInvitee = await tableCol.findOne({email});
                const findMember = await membersCol.findOne({user_key});
                if (!findMember) {
                    return res.status(400).send("Group has not been created yet.");
                }
                let isResend = false;

                //email로 기존 저장된 유닛인지 체크
                const targetUnit = findMember.unit.find(u => u.email === email);

                if (targetUnit) {
                    switch (targetUnit.state) {
                        case 'REJECT':
                        case 'EXPIRED':
                            // REJECT(맴버가 거절), EXPIRED(만료)면 재초대 허용 (unit 업데이트 후 메일 발송)
                            // 아래쪽에서 실제 초대 로직 이어서 진행
                            isResend = true; // 재발송임을 표시
                            break;
                        case 'INVITED':
                            return res.status(400).send("Invitation is already pending. Please wait for the invitee to accept.");
                        case 'INVITED_SIGNUP':
                            return res.status(400).send(
                                "To join this group, you must complete your sign-up. Once registered and logged in, you'll automatically be added as a group member."
                            );
                        case 'ACTIVE':
                            return res.status(400).send("This user is already a member of the group.");
                        default:
                            return res.status(400).send("Unknown member state.");
                    }
                }

                const token = jwt.sign(
                    {master: user_key, invitee: findInvitee.user_key},
                    AWS_TOKEN,
                    {expiresIn: '1d'}
                );

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
                const mailSubjectPrefix = isResend ? "[재발송] " : "";
                const mailOptions = {
                    from: `"${findMaster.company}" <${NODEMAILER_USER}>`,
                    to: email,
                    subject: `${mailSubjectPrefix}[${findMaster.company}] ${findMaster.name}님의 그룹 초대 안내`,
                    html: `
        <div style="font-family:sans-serif">
            <h2>[${findMaster.name}]님의 그룹 초대 안내</h2>
            <p>${findInvitee.name}님, [${findMaster.name}]님의 그룹에 초대되었습니다.<br/>
            아래 버튼을 눌러 초대 수락 또는 거절을 선택해주세요.</p>
            <a href="http://socket.doorbellsquare.com:8080/doorbell/group/invite/confirm?token=${token}"
                style="display:inline-block;padding:12px 32px;background:#3489f7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:10px;">
                초대 수락하기
            </a>
            <a href="http://socket.doorbellsquare.com:8080/doorbell/group/invite/reject?token=${token}"
                style="display:inline-block;padding:12px 32px;background:#c13232;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                초대 거절하기
            </a>
            <p style="color:#888;font-size:12px">이 링크는 10분간만 유효합니다.</p>
        </div>
        `
                }


                const sendMailPromise = () => {
                    return new Promise((resolve, reject) => {
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) return reject(error);
                            return resolve(info);
                        });
                    });
                };

                const filteredUnit = (findMember.unit || []).filter(u => u.user_key !== findInvitee.user_key);

                // [추가] unit 최대 인원(5명) 체크
                if (filteredUnit.length >= 5) {
                    return res.status(400).send("A maximum of 5 members can be invited. Please remove an existing member before inviting a new one.");
                }

                await sendMailPromise();


                await membersCol.findOneAndUpdate(
                    { user_key },
                    {
                        unit: [
                            {
                                user_key: findInvitee.user_key,
                                user_name: findInvitee.name,
                                alias_name:null,
                                email,
                                device_info:[],
                                token,
                                auth:false,
                                state: 'INVITED',
                                join_at: null
                            },
                            ...filteredUnit
                        ]
                    }
                );

                res.status(200).send('Invitation successful');

            } catch (err) {
                return res.status(500).send(err);
            }
        },

        //기존 가입자 초대 이메일 수락버튼 - unit 데이터 업데이트
        async getInviteConfirm(req, res) {
            const { token } = req.query;
            if (!token) return res.status(400).send('Invalid or missing token.');
            let decoded;
            try {
                decoded = jwt.verify(token, AWS_TOKEN);
            } catch (e) {
                // 만료된 토큰도 여기로 catch됨!
                if (e.name === "TokenExpiredError") {
                    // 토큰 디코드(verify 말고 decode만, 만료된 토큰이라도 payload는 뽑힘)
                    const expiredPayload = jwt.decode(token);
                    if (expiredPayload) {
                        const { master, invitee } = expiredPayload;
                        const membersCol = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                        // 해당 그룹/멤버 조회
                        const group = await membersCol.findOne({ user_key: master, "unit.user_key": invitee });
                        if (group) {
                            // 해당 unit의 token이 이 토큰과 일치할 때만 상태를 EXPIRED로
                            const invitedUnit = group.unit.find(u => u.user_key === invitee);
                            if (invitedUnit && invitedUnit.token === token && invitedUnit.state === "INVITED") {
                                await membersCol.updateOne(
                                    { user_key: master, "unit.user_key": invitee },
                                    { $set: { "unit.$.state": "EXPIRED" } }
                                );
                            }
                        }
                    }
                    return res.status(400).send('Invitation link has expired. Please request a new invitation.');
                }
                return res.status(400).send('Token invalid.');
            }

            // 정상적으로 verify 된 경우
            const { master, invitee } = decoded;
            const membersCol = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const group = await membersCol.findOne({ user_key: master, "unit.user_key": invitee });

            if (!group) {
                return res.send(`
        <script>
            alert('This invitation has already been cancelled or expired.');
            window.close(); // 팝업 닫기, 필요 없으면 location.href로 교체
        </script>
    `);
            }

            // 초대 token이 실제로 저장된 token과 일치하는지 체크!
            const invitedUnit = group.unit.find(u => u.user_key === invitee);

            if (!invitedUnit || invitedUnit.token !== token) {
                return res.status(400).send('This invitation link is no longer valid.');
            }

            // 이미 처리된 상태(승인/거절/만료 등)
            if (invitedUnit.state !== "INVITED") {
                return res.send(`
        <h3>이미 승인 요청이 처리되었습니다.</h3>
        <button onclick="window.close()">확인</button>
    `);
            }

            // 승인 처리
            await membersCol.updateOne(
                { user_key: master, "unit.user_key": invitee },
                { $set: { "unit.$.state": "ACTIVE", "unit.$.join_at": moment().tz('Asia/Seoul').toDate() } }
            );

            return res.send(`
    <h3>초대가 정상적으로 수락되었습니다. 승인 대기 중입니다.</h3>
    <button onclick="window.close()">확인</button>
`);
        },


        //기존 가입자 초대 이메일 거부버튼 - unit 데이터 업데이트
        async getInviteReject(req, res) {
            const { token } = req.query;
            if (!token) return res.status(400).send('Invalid or missing token.');

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                if (e.name === "TokenExpiredError") {
                    // 만료된 토큰도 필요하면 처리
                    // 토큰 디코드(verify 말고 decode만, 만료된 토큰이라도 payload는 뽑힘)
                    const expiredPayload = jwt.decode(token);
                    if (expiredPayload) {
                        const { master, invitee } = expiredPayload;
                        const membersCol = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                        // 해당 그룹/멤버 조회
                        const group = await membersCol.findOne({ user_key: master, "unit.user_key": invitee });
                        if (group) {
                            // 해당 unit의 token이 이 토큰과 일치할 때만 상태를 EXPIRED로
                            const invitedUnit = group.unit.find(u => u.user_key === invitee);
                            if (invitedUnit && invitedUnit.token === token && invitedUnit.state === "INVITED") {
                                await membersCol.updateOne(
                                    { user_key: master, "unit.user_key": invitee },
                                    { $set: { "unit.$.state": "EXPIRED" } }
                                );
                            }
                        }
                    }
                    return res.status(400).send('Invitation link has expired. Please request a new invitation.');
                }
                return res.status(400).send('Token invalid.');
            }

            // 정상적으로 verify 된 경우
            const { master, invitee } = decoded;
            const membersCol = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
            const group = await membersCol.findOne({ user_key: master, "unit.user_key": invitee });

            if (!group) {
                return res.send(`
        <script>
            alert('This invitation has already been cancelled or expired.');
            window.close(); // 팝업 닫기, 필요 없으면 location.href로 교체
        </script>
    `);
            }

            const invitedUnit = group.unit.find(u => u.user_key === invitee);

            if (!invitedUnit || invitedUnit.token !== token) {
                return res.status(400).send('This invitation link is no longer valid.');
            }
            if (invitedUnit.state !== "INVITED") {
                return res.send(`
<h3>이미 초대가 처리된 상태입니다.</h3>
<button onclick="window.close()">창 닫기</button>
`);
            }

            // 거절 처리
            await membersCol.updateOne(
                { user_key: master, "unit.user_key": invitee },
                { $set: { "unit.$.state": "REJECT" } }
            );

            return res.send(`
  <h3>초대를 거절하셨습니다.</h3>
  <button onclick="window.close()">창 닫기</button>
`);

        },


        //신규 가입자 초대 이메일 전송 - 그룹장 user_key + company + 초대 보낼 email => token 생성 후 회원가입 링크 이메일 전송
        async postInviteSendSignUp(req,res){
            const token = req.headers['token'];
            let { email } = req.body;
            if (!token) {
                return res.status(401).send("Unauthorized: Token is required.");
            }
            let verify;
            try {
                verify = jwt.verify(token, AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key;
            try {
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                // 마스터(보내는 사람) 정보 조회
                const findMaster = await tablesCol.findOne({ user_key });
                const findMember = await membersCol.findOne({ user_key });
                if (!findMaster || !findMember) {
                    return res.status(400).send("Group has not been created yet.");
                }

                const company = findMaster.company;

                // 이미 초대된 unit에 같은 email이 있는지 체크
                const targetUnit = (findMember.unit || []).find(u => u.email === email);
                if (targetUnit) {
                    switch (targetUnit.state) {
                        case 'EXPIRED':
                        case 'REJECT':
                            break;
                        case 'INVITED':
                            return res.status(400).send("Invitation is already pending. Please wait for the invitee to accept.");
                        case 'INVITED_SIGNUP':
                            return res.status(400).send(
                                "To join this group, you must complete your sign-up. Once registered and logged in, you'll automatically be added as a group member."
                            );
                        case 'ACTIVE':
                            return res.status(400).send("This user is already a member of the group.");
                        default:
                            return res.status(400).send("Unknown member state.");
                    }
                }

                // [추가] unit 최대 인원(5명) 체크 - 본인제외 5명
                const filteredUnit = (findMember.unit || []).filter(u => u.email !== email);
                if (filteredUnit.length >= 6) {
                    return res.status(400).send("A maximum of 5 members can be invited. Please remove an existing member before inviting a new one.");
                }

                // 회원가입용 토큰 생성 (payload에 master_token, company, user_email)
                const masterToken = jwt.sign({ user_key }, process.env.AWS_TOKEN, { expiresIn: '1d' });
                const signUpToken = jwt.sign(
                    {
                        master_token: masterToken,
                        company,
                        user_email: email
                    },
                    process.env.AWS_TOKEN,
                    { expiresIn: '1d' }
                );

                // 이메일 발송 설정
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
                    from: `"${company}" <${NODEMAILER_USER}>`,
                    to: email,
                    subject: `[${company}] ${findMaster.name}님의 그룹원 회원가입 초대 안내`,
                    html: `
<div style="font-family:sans-serif">
    <h2>[${findMaster.name}]님의 그룹원 회원가입 초대 안내</h2>
    <p>아래 버튼을 눌러 회원가입을 완료하고 그룹에 등록하세요.<br>
    (24시간 내에 회원가입을 완료하셔야 하며 회원가입 후 어플을 설치하여 회원가입한 정보로 로그인 해주셔야 합니다.)</p>
    <a href="http://socket.doorbellsquare.com:8080/group/invite/sign_up/link?token=${signUpToken}&company=${company}"
        style="display:inline-block;padding:12px 32px;background:#3489f7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
        회원가입 바로가기
    </a>
    <p style="color:#888;font-size:12px">이 링크는 24시간 동안만 유효합니다.</p>
</div>
`
                };

                // 메일 보내기
                const sendMailPromise = () => {
                    return new Promise((resolve, reject) => {
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) return reject(error);
                            return resolve(info);
                        });
                    });
                };
                await sendMailPromise();

                // unit에 초대기록 추가 (user_key는 null, email만 저장)
                await membersCol.findOneAndUpdate(
                    { user_key },
                    {
                        unit: [
                            {
                                user_key: null,
                                user_name:null,
                                alias_name:null,
                                email,
                                device_info:[],
                                token: signUpToken,
                                auth:false,
                                state: 'INVITED_SIGNUP',
                                join_at: null
                            },
                            ...filteredUnit
                        ]
                    }
                );

                res.status(200).send('Sign-up invitation sent successfully.');
            } catch (err) {
                return res.status(500).send(err);
            }
        },

        //신규 가입자 초대 이메일 회원가입 버튼 - 회원가입 ( 몽고디비, 다이나모 디비 signUp ) 및 맴버 업데이트 ( state, join_at 등 데이터 처리)
        async postInviteSignUp(req,res){
            let { token } = req.query;
            const data = req.body;
            const saveTime = moment().tz('Asia/Seoul');

            //여기서 하루안에 회원가입 한지 체크
            if (!token) {
                return res.status(401).send("Unauthorized: Token is required.");
            }
            let verify;
            try {
                verify = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            //다시 받아서 풀면 마스터토큰, 회사, 초대한사람 이메일
            let { master_token, company, user_email } = verify

            const master_user_key = jwt.verify(master_token, AWS_TOKEN);

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

            if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
                return res.status(400).send("'name' is a required field.");
            }

            if (!data.tel || typeof data.tel !== 'string' || data.tel.trim() === '') {
                return res.status(400).send("'tel' is a required field.");
            }

            try {
                const { collection: tableCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');

                const findData = await tableCol.find({
                    $or: [
                        { id: data.user_id },
                        { email: user_email }
                    ]
                }).toArray();

                if (findData.length !== 0) {
                    if (findData.some(u => u.id === data.user_id)) {
                        return res.send(`
        <script>
            alert('아이디가 이미 존재합니다. 다른 아이디를 입력하세요.');
            history.back();
        </script>
    `);
                    }
                }

                const findMembers = await membersCol.findOne({user_key:master_user_key});

                if (!findMembers) {
                    return res.send(`
            <script>
                alert('This invitation has already been cancelled or expired.');
                window.close();
            </script>
        `);
                }
                const inviteUnit = (findMembers.unit || []).find(u => u.email === user_email);
                if (!inviteUnit || inviteUnit.state !== 'INVITED') {
                    return res.send(`
            <script>
                alert('This invitation has already been cancelled or expired.');
                window.close();
            </script>
        `);
                }

                const addr = `${company}-address`;

                const saveAwsData = {
                    user_id: data.user_id,
                    user_pw: data.user_pw,
                    name: data.name,
                    tel: data.tel,
                    addr: addr,
                    company,
                };

                try {
                    const awsResponse = await axios.post(AWS_LAMBDA_SIGNUP, saveAwsData);
                    console.log(awsResponse.data)
                    console.log('success invite subSignUp');
                    let lambdaToken = awsResponse.data.token;
                    let lambdaDecoded = jwt.verify(lambdaToken, AWS_TOKEN); // 또는 AWS 쪽에서 사용하는 키
                    let newUserKey = lambdaDecoded.user_key; // 여기에 유저키가 들어있음

                    const allData = await tableCol.find({company}).toArray();
                    const maxContractNumObj = allData
                        .filter(item => item.contract_num && item.contract_num.startsWith(`${company}-`))
                        .reduce((max, item) => {
                            const num = parseInt(item.contract_num.split(`${company}-`)[1], 10);
                            return (num > parseInt(max.contract_num.split(`${company}-`)[1], 10)) ? item : max;
                        }, {contract_num: `${company}-0`});

                    const maxContractNum = maxContractNumObj ? parseInt(maxContractNumObj.contract_num.split(`${company}-`)[1], 10) : 0;


                    const mongoUserData = {
                        name: data.name,
                        tel: data.tel,
                        addr: addr,
                        email: user_email,
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
                                email:user_email,
                                device_info:[],
                                token:null,
                                auth:true,
                                state:"ACTIVE",
                                join_at:moment().tz('Asia/Seoul').toDate(),
                            }
                        ],
                        create_at:moment().tz('Asia/Seoul').toDate()
                    }
                    await membersCol.updateOne(
                        { user_key: master_user_key, "unit.email": user_email },
                        {
                            $set: {
                                "unit.$.user_key": newUserKey,
                                "unit.$.user_name": data.name,
                                "unit.$.state": 'ACTIVE',
                                "unit.$.join_at": moment().tz('Asia/Seoul').toDate()
                            }
                        }
                    );
                    //몽고 유저정보 저장
                    const insertResult = await tableCol.insertOne(mongoUserData);
                    const insertMembersResult = await membersCol.insertOne(memberData);
                    console.log(insertResult);
                    console.log(insertMembersResult)

                    return res.send(`
  <script>
    alert('회원가입이 완료되었습니다. 앱에서 로그인 후 그룹에 등록됩니다.');
    window.close(); // 팝업이면 닫기, 아니면 location.href="/"로 보내도 됨
  </script>
`);

                } catch (awsErr) {
                    console.log(awsErr);
                    console.log("lambda error")
                    return res.status(502).send(awsErr);
                }


            }catch(err) {
                return res.status(500).send(err);
            }
        },




        //---------------------------- Device Permission Page ----------------------------//

        //그룹원 기기권한 덮어쓰기
        async patchDevicePermission(req,res){

            const token = req.headers['token'];
            const { unit_user_key, device_id = [] } = req.body;
            if (!token) {
                return res.status(401).send("Unauthorized: Token is required.");
            }
            let verify;
            try {
                verify = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key;

            try {
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');

                // 마스터 권한 체크
                const masterMember = await membersCol.findOne({ user_key });
                if (!masterMember) {
                    return res.status(403).send("Only masters can assign device permissions.");
                }

                // 대상 멤버 unit 찾기
                const targetUnit = (masterMember.unit || []).find(u => u.user_key === unit_user_key);
                if (!targetUnit) {
                    return res.status(404).send("Target user is not a member of your group.");
                }
                if (targetUnit.state !== "ACTIVE") {
                    return res.status(400).send("Device permission can only be assigned to active members.");
                }

                // ---- 여기서부터 변경 ----

                // 1. 기존 device_info 맵
                const oldDeviceMap = {};
                (targetUnit.device_info || []).forEach(d => {
                    oldDeviceMap[d.device_id] = d;
                });

// 2. 마스터 device_name 맵 (신규 추가용)
                const masterUnit = masterMember.unit.find(u => u.user_key === user_key);
                const masterDeviceMap = {};
                (masterUnit?.device_info || []).forEach(d => {
                    masterDeviceMap[d.device_id] = d.device_name;
                });

// 3. 요청 device_id 기준으로 새 배열 생성
                const requestedDeviceIds = Array.isArray(device_id) ? device_id : [device_id];
                const newDeviceInfo = requestedDeviceIds
                    .filter(id => !!id)
                    .map(id => {
                        // 기존 기기는 값 유지
                        if (oldDeviceMap[id]) return oldDeviceMap[id];
                        // 신규 기기는 마스터 device_name, 나머지 디폴트
                        return {
                            device_id: id,
                            device_name: masterDeviceMap[id] || "noname",
                            privacy: false,
                            alarm_event: true,
                            motion_event: true
                        };
                    });

// 4. 최종 저장 (기존에 없다면 자동 삭제됨)
                await membersCol.updateOne(
                    { user_key, "unit.user_key": unit_user_key },
                    { $set: { "unit.$.device_info": newDeviceInfo } }
                );


                // ---- 여기까지 ----

                // 3. DynamoDB 권한 동기화
                try {
                    await syncMemberDevicePermission(
                        unit_user_key,
                        Array.isArray(device_id) ? device_id : [device_id],
                        user_key,
                        dynamoDB
                    );
                    return res.status(200).send("Device permission assigned successfully.");
                } catch (dynamoErr) {
                    console.error('DynamoDB 동기화 실패:', dynamoErr);
                    return res.status(500).send("Partial failure: Device permission updated in main DB, but synchronization with device server failed. Please try again later or contact support.");
                }
            } catch (err) {
                return res.status(500).send(err);
            }

        },




        //---------------------------- Alarm Setting Page ----------------------------//

        //알람 정보 조회 - 본인그룹 + 본인이 속해있는 그룹 => master => 본인 그룹 조회 후 unit 내 본인 device_info / 본인 유저키로 unit에 속해있는 데이터 전체 조회- 데이터 정제필요
        async getAlarmInfo(req,res){

            const token = req.headers['token'];
            if (!token) {
                return res.status(401).send("Unauthorized: Token is required.");
            }
            let verify;
            try {
                verify = jwt.verify(token, AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key;

            try {
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');

                //본인이 마스터로 있는 그룹의 unit내의 본인 user_key를 찾아서 device_info를 아래 sendData처럼 보내면되고
                //본인이 그룹에 속해있는 그룹원인 데이터들은 sendData의 unit 안과 같이 본인의 device_info는 그대로 넣고
                //해당 그룹의 마스터의 user_key를 master_user_key로 넣고 display_name이라고 unit 내 본인이 alias_name의 값이 없으면 즉,
                //item?.alias_name || e.group_name || "" 이런 식으로 alias_name이 있으면 alias_name이 없다면 해당 그룹의 group_name을 지정해서
                //display_name에 지정해주면됨
                // let sendData = {
                //     master : [
                //         {
                //             device_id:"",
                //             device_name:"",
                //             privacy:false,
                //             alarm_event:true,
                //             motion_event:true,
                //         },
                //     ],
                //     unit:[
                //         {
                //             display_name:"",
                //             master_user_key:"",
                //             device_info:[
                //                 {
                //                     device_id:"",
                //                     device_name:"",
                //                     privacy:false,
                //                     alarm_event:true,
                //                     motion_event:true,
                //                 },
                //             ]
                //         }
                //     ]
                // }


                // 1. 본인(마스터) 그룹에서 본인 unit의 device_info
                const masterGroup = await membersCol.findOne({ user_key });
                let masterDeviceInfo = [];
                if (masterGroup) {
                    const masterUnit = (masterGroup.unit || []).find(u => u.user_key === user_key);
                    masterDeviceInfo = masterUnit?.device_info || [];
                }

                // 2. 본인이 unit으로 들어가 있는 그룹들 조회 (본인이 마스터인 그룹은 제외)
                const memberGroups = await membersCol.find({ "unit.user_key": user_key }).toArray();
                let unitData = [];
                for (const g of memberGroups) {
                    if (g.user_key === user_key) continue; // 자기 그룹(마스터)은 제외
                    // unit 중 본인 user_key로 된 객체
                    const myUnit = (g.unit || []).find(u => u.user_key === user_key);
                    if (!myUnit) continue;
                    // display_name은 alias_name > group_name
                    const display_name = myUnit.alias_name || g.group_name || "";
                    unitData.push({
                        display_name,
                        master_user_key: g.user_key,
                        device_info: myUnit.device_info || []
                    });
                }
                // 최종 리턴
                return res.status(200).json({
                    master: masterDeviceInfo,
                    unit: unitData
                });




            }catch(err) {
                return res.status(500).send(err);
            }
        },

        //각 알림 설정 변경 - body의 master_user_key가 null 이면 본인그룹 내 본인 user_key기준 업데이트, 아닐시 master_user_key로 조회 후 unit 내 본인(그룹원)의 user_key 찾아서 업데이트
        /**
         * 알림 세팅(privacy, alarm_event, motion_event) 전체 덮어쓰기 + 프라이버시 규칙 위반시 warningPoint로 반환
         *
         * - 본인(마스터)의 경우 master_user_key === null
         * - 그룹원의 경우 master_user_key에 해당 마스터 유저키 전달
         * - device_info: [{ device_id, device_name, privacy, alarm_event, motion_event }]
         *   * privacy가 true이면서 alarm_event/motion_event가 true로 들어오면 false로 강제 저장 + warningPoint로 반환
         */
        async patchAlarmSettings(req, res) {
            // 1. 토큰 검증
            const token = req.headers['token'];
            if (!token) return res.status(401).send("Unauthorized: Token is required.");

            let verify;
            try {
                verify = jwt.verify(token, AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key;

            // 2. 파라미터 추출
            const { master_user_key, device_info } = req.body;
            // groups 콜렉션 핸들러 준비
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');

            // 3. device_info 배열 유효성 체크
            if (!Array.isArray(device_info)) {
                return res.status(400).send("device_info must be an array.");
            }

            // 4. 경고용 반환 배열 (privacy 위반 있을 시)
            const warningPoint = [];

            // 5. device_info 사전 처리 (실제 저장될 값 가공)
            const sanitizedDeviceInfo = device_info.map(d => {
                let { device_id, device_name, privacy, alarm_event, motion_event } = d;

                // 값 타입 보정: undefined/null/'' 방지 (boolean)
                privacy = !!privacy;
                alarm_event = !!alarm_event;
                motion_event = !!motion_event;

                // 1. privacy가 true인데 alarm/motion이 true → 강제 false, warningPoint
                if (privacy && (alarm_event || motion_event)) {
                    warningPoint.push({
                        device_id,
                        privacy: true,
                        alarm_event: false,
                        motion_event: false
                    });
                    alarm_event = false;
                    motion_event = false;
                }

                // 2. privacy가 false인데 alarm/motion이 둘 다 false → privacy true로 강제, warningPoint
                if (!privacy && !alarm_event && !motion_event) {
                    warningPoint.push({
                        device_id,
                        privacy: true,
                        alarm_event: false,
                        motion_event: false
                    });
                    privacy = true;
                }


                // 최종 반환 객체 (실제 저장될 값)
                return {
                    device_id,
                    device_name,
                    privacy,
                    alarm_event,
                    motion_event
                };
            });

            // 6. 업데이트할 대상 및 위치 찾기
            let updateFilter, updateQuery, findGroup;
            if (master_user_key === null) {
                // 본인 그룹 (마스터일 때)
                findGroup = await membersCol.findOne({ user_key });
                if (!findGroup) return res.status(404).send("Group not found.");

                // unit에서 내 user_key 위치 찾기
                const idx = (findGroup.unit || []).findIndex(u => u.user_key === user_key);
                if (idx === -1) return res.status(404).send("Unit not found.");

                updateFilter = { user_key };
                updateQuery = { $set: { [`unit.${idx}.device_info`]: sanitizedDeviceInfo } };
            } else {
                // 그룹원(초대된 그룹에서 내 유닛)
                findGroup = await membersCol.findOne({ user_key: master_user_key });
                if (!findGroup) return res.status(404).send("Group not found.");

                // 해당 그룹에서 내 user_key 위치 찾기
                const idx = (findGroup.unit || []).findIndex(u => u.user_key === user_key);
                if (idx === -1) return res.status(404).send("Unit not found in target group.");

                updateFilter = { user_key: master_user_key };
                updateQuery = { $set: { [`unit.${idx}.device_info`]: sanitizedDeviceInfo } };
            }

            // 7. MongoDB 업데이트 실행 (덮어쓰기)
            await membersCol.updateOne(updateFilter, updateQuery);

            // 8. 응답: 성공 + warningPoint 배열
            return res.status(200).json({
                message: "Alarm settings updated successfully.",
                warningPoint
            });
        },

        //디바이스에서 lambda에 fcm요청 했을때 기기권한을 가지고 있는 그룹장 + 그룹원들의 알림세팅 정보
        async getDeviceAlarmInfo(req, res) {
            try {
                let { user_key, device_id, upKey, title, message, fileName, MacAddr, ...elseData } = req.body;

                device_id = device_id || (fileName ? MacAddr : "");

                if (!user_key) {
                    return res.status(400).send("user_key not found.");
                }

                const FcmSettings = db.FcmSettings;
                const History = db.history;
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
                const group = await membersCol.findOne({ user_key }); // 마스터 user_key 기준 그룹 찾기

                if (!group) {
                    return res.status(404).json({ error: "Group not found." });
                }

                // 그룹의 unit을 모두 순회하여, 해당 device_id 권한자들을 뽑아 배열로 구성
                let alarmUsers = [];
                for (const unit of group.unit || []) {
                    if (!Array.isArray(unit.device_info)) continue;
                    const device = unit.device_info.find(d => d.device_id === device_id);
                    if (device) {
                        alarmUsers.push({
                            ...unit,
                            privacy: device.privacy
                        });
                    }
                }

                // (선택) 마스터가 제일 위에 오도록 정렬
                alarmUsers.sort((a, b) => (b.auth === true) - (a.auth === true));

                let resultArr = [];

                // 1. 타이틀이 protocol인 경우
                if (title === "protocol" && typeof message === "string") {
                    // fcmSettings에서 조회
                    const fcmSetting = await FcmSettings.findOne({ code: message });

                    if (!fcmSetting) {
                        return res.status(404).json({ error: "fcm_setting not found for code: " + message });
                    }

                    // 프라이버시와 bypass 분기
                    if (fcmSetting.bypass === true) {
                        // 모두 포함 (프라이버시 true/false 상관없이)
                        for (const u of alarmUsers) {
                            resultArr.push({
                                user_key: u.user_key,
                                device_id,
                                upKey,
                                title: fcmSetting.title,
                                message: fcmSetting.message,
                                fileName,
                                MacAddr,
                                ...elseData
                            });
                        }
                    } else {
                        // bypass === false면 privacy가 false인 유저만 포함
                        for (const u of alarmUsers) {
                            if (u.privacy === false) {
                                resultArr.push({
                                    user_key: u.user_key,
                                    device_id,
                                    upKey,
                                    title: fcmSetting.title,
                                    message: fcmSetting.message,
                                    fileName,
                                    MacAddr,
                                    ...elseData
                                });
                            }
                        }
                    }
                }
                // 2. protocol이 아니면, privacy가 false인 유저만 포함, 타이틀/메시지는 받은 그대로
                else {
                    for (const u of alarmUsers) {
                        if (u.privacy === false) {
                            resultArr.push({
                                user_key: u.user_key,
                                device_id,
                                upKey,
                                title,
                                message,
                                fileName,
                                MacAddr,
                                ...elseData
                            });
                        }
                    }
                }

                return res.status(200).json(resultArr);

            } catch (err) {
                return res.status(500).json({ error: err.message || String(err) });
            }
        },

        //본인 등록된 기기 디바이스 이름 변경 - 마스터 본인 디바이스 이름 변경
        async patchMasterDeviceName(req,res){
            const token = req.headers['token'];
            if (!token) return res.status(401).send("Unauthorized: Token is required.");

            let verify;
            try {
                verify = jwt.verify(token, AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key;


            const { device_id, device_name } = req.body;

            if (!device_id || !device_name)
                return res.status(400).send("device_id and device_name are required.");

            // 본인 그룹에 unit 내 본인 user_key로 본인의 device_info 중 device_id값으로 내부값 찾아서 device_name 값을 변경
            // 다이나모 디비는 device_id + user_key값으로 DEVICE_TABLE 의 device_name 값을 변경하면됨.

            // 3. 그룹 찾기 (본인 그룹)
            const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'groups');
            const group = await membersCol.findOne({ user_key });
            if (!group) return res.status(404).send("Group not found.");

            // 4. 내 유닛 찾기
            const unitIdx = (group.unit || []).findIndex(u => u.user_key === user_key);
            if (unitIdx === -1) return res.status(404).send("Your unit not found.");

            // 5. device_info 내 해당 디바이스 찾기
            const deviceInfoArr = group.unit[unitIdx].device_info || [];
            const deviceIdx = deviceInfoArr.findIndex(d => d.device_id === device_id);
            if (deviceIdx === -1) return res.status(404).send("Device not found in your device list.");

            // 6. MongoDB 내 device_name 변경
            const updateField = {};
            updateField[`unit.${unitIdx}.device_info.${deviceIdx}.device_name`] = device_name;
            await membersCol.updateOne(
                { user_key },
                { $set: updateField }
            );

            // 7. DynamoDB 내 device_name 변경
            try {
                await dynamoDB.update({
                    TableName: DEVICE_TABLE,
                    Key: {
                        device_id: device_id,
                        user_key: user_key
                    },
                    UpdateExpression: "set device_name = :n",
                    ExpressionAttributeValues: { ":n": device_name }
                }).promise();
            } catch (e) {
                // DynamoDB 에러는 저장만 실패 메시지로 전달
                return res.status(500).send("MongoDB updated, but failed to update device name in device server.");
            }

            // 8. 성공 응답
            return res.status(200).send("Device name updated successfully.");


        }




    }
}

module.exports = members