


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

async function syncMemberDevicePermission(target_user_key, device_ids, master_user_key, dynamoDB, tablesCol) {
    // 1. [삭제] 기존에 해당 멤버(user_key)가 가진 모든 device row 삭제
    // (조건: user_key = target_user_key)
    // 1-1. 먼저 전체 목록 조회
    const { Items: currentDevices = [] } = await dynamoDB.query({
        TableName: DEVICE_TABLE,
        KeyConditionExpression: 'user_key = :u',
        ExpressionAttributeValues: { ':u': target_user_key }
    }).promise();

    // 1-2. 모두 삭제
    for (const item of currentDevices) {
        await dynamoDB.delete({
            TableName: DEVICE_TABLE,
            Key: {
                device_id: item.device_id,
                user_key: item.user_key
            }
        }).promise();
    }

    // 2. [생성] 새 device_id 리스트를 기반으로 다시 insert
    // 마스터(user_key)와 device_id로 값을 복제해서 멤버에게 부여
    for (let dId of device_ids) {
        const device_id = String(dId).toLowerCase(); // 대문자 → 소문자

        // 마스터의 device 테이블에서 해당 device_id로 정보 가져오기
        const { Item: masterDevice } = await dynamoDB.get({
            TableName: DEVICE_TABLE,
            Key: {
                device_id,
                user_key: master_user_key
            }
        }).promise();

        if (!masterDevice) continue; // 마스터가 해당 device_id 안가진 경우 skip

        // 마스터 정보 복사 + user_key만 target_user_key로 변경해서 insert
        const newDevice = { ...masterDevice, user_key: target_user_key };
        await dynamoDB.put({
            TableName: DEVICE_TABLE,
            Item: newDevice
        }).promise();
    }

    // (옵션) tables 컬렉션에도 device_id 필드 동기화 (comma-separated string)
    await tablesCol.updateOne(
        { user_key: target_user_key },
        { $set: { device_id: device_ids.map(id => id.toLowerCase()).join(',') } }
    );
}



const members = function () {
    return {
        //맴버 그룹 생성
        async createMembers(req, res) {
            const token = req.headers['token'];
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
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findUser = await tablesCol.findOne({user_key});
                const findMember = await membersCol.findOne({user_key});

                if(findUser.contract_service === "부계약자"){
                    return res.status(400).send("Permission denied: Only masters can create a group. You are registered as a member.");
                }

                if(findMember){
                    return res.status(400).send("Group has already been created.");
                }

                await membersCol.insertOne({
                    user_key,
                    unit:[],
                    create_at:moment().tz('Asia/Seoul').toDate()
                });

                return res.status(200).send('Member created successfully');

            }catch(err) {
                return res.status(500).send(err);
            }
        },

        //이메일,아이디로 검색 API(초대할 사람 검색)
        async findUsers(req, res) {
            const {email, user_id} = req.body;
            let query = {}
            if (email) query.email = email;
            if (user_id) query.id = user_id;
            try {
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const findUser = await tablesCol.findOne(query);
                if(!findUser){
                    return res.status(400).send("User not found.");
                }
                if(findUser.contract_service === "부계약자"){
                    return res.status(400).send("User is already a member of another group.");
                }
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const findMember = await membersCol.findOne({user_key:findUser.user_key});
                if(findMember){
                    return res.status(400).send("User is already registered as a master.");
                }
                return res.status(200).send(findUser);
            }catch(err) {
                return res.status(500).send(err);
            }
        },

        //초대하는 Email보내기(html로 버튼)
        async sendInvitation(req, res) {
            const token = req.headers['token'];
            let {email} = req.body;
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
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findMaster = await tablesCol.findOne({user_key});
                const findInvitee = await tablesCol.findOne({email});
                const findMember = await membersCol.findOne({user_key});
                if (!findMember) {
                    return res.status(400).send("Group has not been created yet.");
                }
                let isResend = false;
                // findMember는 마스터의 그룹(문서)
                // findInvitee는 초대하려는 사용자(문서)
                const targetUnit = findMember.unit.find(u => u.user_key === findInvitee.user_key);

                if (targetUnit) {
                    switch (targetUnit.state) {
                        case 'REJECTED':
                        case 'EXPIRED':
                        case 'APPROVED_REJECTED':
                            // APPROVED_REJECTED(최종승인 거절),REJECTED(맴버가 거절), EXPIRED(만료)면 재초대 허용 (unit 업데이트 후 메일 발송)
                            // 아래쪽에서 실제 초대 로직 이어서 진행
                            isResend = true; // 재발송임을 표시
                            break;
                        case 'INVITED':
                            return res.status(400).send("Invitation is already pending. Please wait for the invitee to accept.");
                        case 'PENDING_APPROVAL':
                            return res.status(400).send("This user has already accepted the invitation. Awaiting master approval.");
                        case 'APPROVED':
                            return res.status(400).send("This user is already a member of the group.");
                        default:
                            return res.status(400).send("Unknown member state.");
                    }
                }

                const token = jwt.sign(
                    {master: user_key, invitee: findInvitee.user_key},
                    AWS_TOKEN,
                    {expiresIn: '10m'}
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
            아래 버튼을 눌러 초대 수락을 완료해주세요.</p>
            <a href="https://your-domain.com/api/invite/confirm?token=${token}"
                style="display:inline-block;padding:12px 32px;background:#3489f7;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                초대 수락하기
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
                                token,
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




        //버튼 누르면 승인상태 변경,
        async inviteConfirm(req, res) {
            const { token } = req.query;
            if (!token) return res.status(400).send('Invalid or missing token.');

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.AWS_TOKEN);
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

            if (!group) return res.status(404).send('Invitation not found.');

            // 초대 token이 실제로 저장된 token과 일치하는지 체크!
            const invitedUnit = group.unit.find(u => u.user_key === invitee);

            if (!invitedUnit || invitedUnit.token !== token) {
                return res.status(400).send('This invitation link is no longer valid.');
            }

            // 이미 처리된 상태(승인/거절/만료 등)
            if (invitedUnit.state !== "INVITED") {
                return res.send(`<h3>이미 승인 요청이 처리되었습니다.</h3>`);
            }

            // 승인 처리
            await membersCol.updateOne(
                { user_key: master, "unit.user_key": invitee },
                { $set: { "unit.$.state": "PENDING_APPROVAL" } }
            );

            return res.send(`<h3>초대가 정상적으로 수락되었습니다. 승인 대기 중입니다.</h3>`);
        },

        // 마스터 최종 승인(부계약자로 변경)
        async memberApprove(req,res) {
            const token = req.headers['token'];
            let { approve, email } = req.body;
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
                const {collection: membersCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findMaster = await tablesCol.findOne({user_key});
                const findInvitee = await tablesCol.findOne({email});
                const findMember = await membersCol.findOne({user_key});

                if (!findMaster || !findInvitee || !findMember) {
                    return res.status(404).send("Master or Invitee not found.");
                }

                if(approve){
                    // true면 맴버 unit에 findInvitee.user_key 찾아서 state를 approved로 변경
                    //findInvitee.contract_service를 "부계약자"로 변경
                    await membersCol.updateOne(
                        { user_key, "unit.user_key": findInvitee.user_key },
                        {
                            $set: {
                                "unit.$.state": "APPROVED",
                                "unit.$.join_at": moment().tz('Asia/Seoul').toDate()
                            }
                        }
                    );
                    // tables의 contract_service를 '부계약자'로
                    await tablesCol.updateOne(
                        { user_key: findInvitee.user_key },
                        { $set: { contract_service: "부계약자" } }
                    );
                    return res.status(200).send("Member has been approved successfully.");
                }else{
                    // false면 맴버 unit에 findInvitee.user_key 찾아서 state를 APPROVED_REJECTED로 변경
                    // APPROVED_REJECTED 처리
                    await membersCol.updateOne(
                        { user_key, "unit.user_key": findInvitee.user_key },
                        { $set: { "unit.$.state": "APPROVED_REJECTED" } }
                    );
                    return res.status(200).send("Member invitation has been rejected.");
                }

            }catch (err) {
                return res.status(500).send(err);
            }


        },

        // 맴버 조회
        async getMemberInfo(req, res) {
            const token = req.headers['token'];
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
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findMember = await membersCol.findOne({ user_key });
                if (!findMember) {
                    return res.status(404).send("Group not found.");
                }

                // unit 배열 돌면서 각 멤버의 정보 취합
                const memberInfoList = await Promise.all(
                    (findMember.unit || []).map(async (u) => {
                        const info = await tablesCol.findOne({ user_key: u.user_key });
                        return {
                            state: u.state,
                            info
                        };
                    })
                );

                return res.status(200).json(memberInfoList);
            } catch (err) {
                return res.status(500).send(err);
            }
        },

        //마스터 - 삭제할 맴버
        async removeMemberFromUnit(req, res) {
            const token = req.headers['token'];
            const { target_user_key } = req.body; // 삭제할 맴버의 user_key
            if (!token) {
                return res.status(401).send("Unauthorized: Token is required.");
            }
            let verify;
            try {
                verify = jwt.verify(token, process.env.AWS_TOKEN);
            } catch (e) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }
            const user_key = verify.user_key; // 마스터의 user_key

            try {
                const { collection: membersCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'members');
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                // 1. unit에서 해당 멤버 정보 찾기 (상태확인용)
                const findMember = await membersCol.findOne({ user_key });
                if (!findMember) {
                    return res.status(404).send("Group not found.");
                }
                const targetUnit = (findMember.unit || []).find(u => u.user_key === target_user_key);
                if (!targetUnit) {
                    return res.status(404).send("Member not found in group.");
                }

                // 2. unit에서 해당 멤버 제거
                await membersCol.updateOne(
                    { user_key },
                    { $pull: { unit: { user_key: target_user_key } } }
                );

                // 3. APPROVED 상태면 tables 컬렉션 contract_service를 "주계약자"로 변경
                if (targetUnit.state === "APPROVED") {
                    await tablesCol.updateOne(
                        { user_key: target_user_key },
                        { $set: { contract_service: "주계약자" } }
                    );
                }

                return res.status(200).send("Member removed successfully.");
            } catch (err) {
                return res.status(500).send(err);
            }
        },

        //맴버- 그룹탈퇴
        async leaveGroup(req, res) {
            const token = req.headers['token'];
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
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                // 1. 내가 unit에 포함된 그룹(마스터)의 user_key 찾기
                const group = await membersCol.findOne({ "unit.user_key": user_key });
                if (!group) {
                    return res.status(404).send("You are not a member of any group.");
                }

                // 2. 내 unit 정보(state 확인)
                const myUnit = (group.unit || []).find(u => u.user_key === user_key);
                if (!myUnit || myUnit.state !== "APPROVED") {
                    return res.status(400).send("You can only leave a group if your membership is approved.");
                }

                // 3. unit에서 내 정보 삭제
                await membersCol.updateOne(
                    { user_key: group.user_key },
                    { $pull: { unit: { user_key } } }
                );

                // 4. 내 contract_service를 '주계약자'로 변경
                await tablesCol.updateOne(
                    { user_key },
                    { $set: { contract_service: "주계약자" } }
                );

                return res.status(200).send("Successfully left the group.");
            } catch (err) {
                return res.status(500).send(err);
            }
        },

        // 마스터 맴버 디바이스 아이디 권한줄때 다이나모 디바이스 테이블 => 덮어쓰기개념 사용 권한을 줄 device_id들을 배열로 나열해서 보내면됨.
        async assignDevicePermission(req, res) {
            const token = req.headers['token'];
            const { target_user_key, device_id = [] } = req.body;
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
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                // 마스터 권한 체크
                const masterMember = await membersCol.findOne({ user_key });
                if (!masterMember) {
                    return res.status(403).send("Only masters can assign device permissions.");
                }

                // target 유저가 unit에 포함되어 있는지 체크(실제 멤버인지 확인)
                const isTargetMember = (masterMember.unit || []).some(u => u.user_key === target_user_key);
                if (!isTargetMember) {
                    return res.status(404).send("Target user is not a member of your group.");
                }

                // device_id가 배열이면 문자열로 저장
                const device_id_str = Array.isArray(device_id) ? device_id.join(',') : device_id;

                // target_user_key의 device_id 업데이트(덮어쓰기)
                await tablesCol.updateOne(
                    { user_key: target_user_key },
                    { $set: { device_id: device_id_str } }
                );

                // 권한 동기화
                await syncMemberDevicePermission(
                    target_user_key,
                    device_id,
                    user_key,
                    dynamoDB,
                    tablesCol
                );

                return res.status(200).send("Device permission assigned successfully.");
            } catch (err) {
                return res.status(500).send(err);
            }
        },



    }
}

module.exports = members