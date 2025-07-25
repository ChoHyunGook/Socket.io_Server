const {ConnectMongo} = require("../ConnectMongo");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const db = require("../../DataBase/index");
const moment = require("moment-timezone");
const AWS = require("aws-sdk");



const {
    GROUP_MONGO_URI,AWS_TOKEN,GROUP_DB_NAME,AWS_SECRET,AWS_ACCESS,AWS_REGION
} = applyDotenv(dotenv)


AWS.config.update({
    accessKeyId: AWS_SECRET,
    secretAccessKey: AWS_ACCESS,
    region: AWS_REGION
});


const dynamoDB = new AWS.DynamoDB.DocumentClient();


const groups = function () {
    return{
        async getAlarms(req,res){
            let token = req.headers["token"];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            let { device_id } = req.query;

            if (!device_id) {
                return res.status(400).send("params에 device_id가 필요합니다.");
            }

            const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');

            const cursor = groupsCol.aggregate([
                { $match: { user_key, "unit.user_key": user_key, "unit.auth": true, "unit.device_info.device_id": device_id } },
                { $unwind: "$unit" },
                { $unwind: "$unit.device_info" },
                { $match: { "unit.user_key": user_key, "unit.auth": true, "unit.device_info.device_id": device_id } },
                { $project: { privacy: "$unit.device_info.privacy" } },
                { $limit: 1 }
            ]);

            const docs = await cursor.toArray();
            if (!docs.length) return res.status(404).send("not found");
            return res.status(200).json(docs[0].privacy)

        },

        async latestDeviceId(req,res){
            let token = req.headers["token"];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }



            const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');

            const doc = await groupsCol.findOne(
                { user_key, "unit.user_key": user_key, "unit.auth": true },
                { projection: { unit: { $elemMatch: { user_key, auth: true } } } }
            );

            console.log(doc)
            const latest_device_id = doc?.unit?.[0]?.latest_device_id ?? null;
            console.log(latest_device_id);
            //if (!latest_device_id) return res.status(404).send("latest_device_id가 없습니다.");

            return res.status(200).send(doc.unit[0].latest_device_id === "" ? null:doc.unit[0].latest_device_id);

        },

        async patchMasterPrivacy(req,res){
            let token = req.headers["token"];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            // 2. 바디에서 device_id, privacy 추출
            const { device_id, privacy } = req.body;
            if (!device_id || typeof privacy !== "boolean") {
                return res.status(400).send("device_id와 privacy(boolean)가 필요합니다.");
            }

            // 3. groups 컬렉션 핸들러
            const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');

            // 읽지 말고 바로 arrayFilters로 수정
            const r = await groupsCol.updateOne(
                {
                    user_key,
                    "unit.user_key": user_key,
                    "unit.auth": true,
                    "unit.device_info.device_id": device_id,
                },
                {
                    $set: {
                        "unit.$[u].device_info.$[d].privacy": privacy,
                    },
                },
                {
                    arrayFilters: [
                        { "u.user_key": user_key, "u.auth": true },
                        { "d.device_id": device_id },
                    ],
                }
            );

            if (r.modifiedCount === 0) return res.status(400).send("업데이트된 정보가 없습니다.");

            return res.status(200).json(privacy);
        },


        async patchLatestDeviceId(req,res){
            let token = req.headers["token"];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            // 2. 바디에서 device_id, privacy 추출
            const { device_id } = req.body;
            if (!device_id) {
                return res.status(400).send("body에 device_id가 필요합니다.");
            }

            // 3. groups 컬렉션 핸들러
            const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');

            // 1) 존재 여부 체크 (마스터 유닛 + 해당 device_id)
            const exists = await groupsCol.findOne({
                user_key,
                "unit": {
                    $elemMatch: {
                        user_key,
                        auth: true,
                        "device_info.device_id": device_id
                    }
                }
            }, { projection: { _id: 1 } });

            if (!exists) return res.status(404).send("본인에게 등록된 device_id가 아닙니다.");


            // 읽지 말고 바로 arrayFilters로 수정
            const r = await groupsCol.updateOne(
                {
                    user_key,
                    "unit.user_key": user_key,
                    "unit.auth": true
                },
                {
                    $set: {
                        "unit.$[u].latest_device_id": device_id,
                    },
                },
                {
                    arrayFilters: [{ "u.user_key": user_key, "u.auth": true }],
                }
            );


            return res.status(200).json(true);
        },


        async checkFcm (req,res){

            try {
                const pushArray = req.body;

                const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');
                const { collection: protocolsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'fcmprotocols');

                let sendFcm = [];

                for (const element of pushArray) {
                    if (!element.user_key || !element.title || !element.message) {
                        console.log('Invalid element:', JSON.stringify(element));
                        return res.status(400).json({code:'A3',message:"Invalid parameter in push element."});
                    }
                    let { user_key, device_id, title, message, fileName, MacAddr, ...elseData } = element;

                    device_id = device_id || (fileName ? MacAddr : "");

                    // groups에서 해당 user_key의 group, 그리고 unit에서 auth:true + 해당 device_id의 device_info 찾기
                    const group = await groupsCol.findOne({ user_key });
                    if (!group) continue;

                    let unit = (group.unit || []).find(u =>
                        u.auth === true &&
                        Array.isArray(u.device_info) &&
                        u.device_info.some(d => (d.device_id === device_id))
                    );
                    if (!unit) continue;

                    let deviceInfo = (unit.device_info || []).find(d => d.device_id === device_id);
                    if (!deviceInfo) continue;


                    if(title === "Protocol"){
                        // message에 프로토콜 코드 ex) Kmotion01
                        // protocolsCol에서 해당 프로토콜 정보 찾기
                        const protocol = await protocolsCol.findOne({ protocol: message });
                        if (!protocol) continue;

                        // Kdoor03, Kdoor04라면 히스토리에 저장 (FCM X)
                        if (["Kdoor03", "Kdoor04"].includes(message)) {

                            // 프로토콜 title에서 {}를 device_name으로 치환
                            const protoTitle = (protocol.title || "").replace(/\{\}/g, deviceInfo.device_name || "");
                            const protoMessage = protocol.message || "";

                            // 만료일 (7일 후)
                            const expiredAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

                            // 저장할 문서 생성
                            await db.history.create({
                                user_key: element.user_key,
                                title: protoTitle,
                                body: protoMessage,
                                date: moment().tz('Asia/Seoul').format('YYYY:MM:DD.HH:mm:ss'),
                                createAt: new Date(),
                                expiredAt,
                                upKey: element.upKey || "",
                                device_id: element.device_id || (element.fileName ? element.MacAddr : ""),
                                fileName: element.fileName || "",
                            });

                            continue; // FCM 발송 안함
                        }

                        // privacy 체크
                        if (deviceInfo.privacy === true) {
                            // 프로토콜에서 bypass true여야만 FCM 발송
                            if (protocol.bypass === true) {
                                // title 메시지 가공: {} 부분에 device_name 넣기
                                let protoTitle = (protocol.title || "").replace(/\{\}/g, deviceInfo.device_name || "");
                                sendFcm.push({
                                    title: protoTitle,
                                    message: protocol.message,
                                    user_key, device_id, fileName,
                                    ...elseData
                                });
                            } else {
                                // 히스토리 저장만 (FCM 미발송)
                                const protoTitle = (protocol.title || "").replace(/\{\}/g, deviceInfo.device_name || "");
                                const protoMessage = protocol.message || "";
                                const expiredAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

                                await db.history.create({
                                    user_key: element.user_key,
                                    title: protoTitle,
                                    body: protoMessage,
                                    date: moment().tz('Asia/Seoul').format('YYYY:MM:DD.HH:mm:ss'),
                                    createAt: new Date(),
                                    expiredAt,
                                    upKey: element.upKey || "",
                                    device_id: element.device_id || (element.fileName ? element.MacAddr : ""),
                                    fileName: element.fileName || "",
                                });

                                continue; // FCM 발송 안함
                            }
                        } else {
                            // privacy false → 그냥 프로토콜대로 FCM 보냄
                            let protoTitle = (protocol.title || "").replace(/\{\}/g, deviceInfo.device_name || "");
                            sendFcm.push({
                                title: protoTitle,
                                message: protocol.message,
                                user_key, device_id, fileName,
                                ...elseData
                            });
                        }
                    }else{
                        if (deviceInfo.privacy === true) {
                            // 프라이버시 true면 히스토리 바로 저장 (FCM 미발송)
                            const expiredAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

                            await db.history.create({
                                user_key: element.user_key,
                                title: element.title,    // 일반 메시지라 title 그대로
                                body: element.message,   // 일반 메시지라 message 그대로
                                date: moment().tz('Asia/Seoul').format('YYYY:MM:DD.HH:mm:ss'),
                                createAt: new Date(),
                                expiredAt,
                                upKey: element.upKey || "",
                                device_id: element.device_id || (element.fileName ? element.MacAddr : ""),
                                fileName: element.fileName || "",
                                status: "GENERAL_PRIVACY_BLOCKED"
                            });

                            continue; // FCM 발송 안함
                        }
                        // privacy false → 그대로 FCM 발송
                        sendFcm.push({
                            ...element
                        });
                    }

                }
                // sendFcm 배열에는 실제 발송할 FCM 데이터가 모임
                // saveHistory 배열에는 히스토리로 따로 저장할 데이터가 모임 (직접 저장 로직 구현)

                return res.status(200).json(sendFcm);
            }catch(e){
                console.error(e);
                return res.status(500).json({ code: 'ERR', message: e.message });
            }

        },

        async patchDeviceName(req,res){
            let token = req.headers["token"];

            let { device_id, device_name } = req.body;

            let user_key;

            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                throw new Error('유효하지 않은 token입니다.');
            }

            const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');
            const group = await groupsCol.findOne({ user_key });
            if (!group) throw new Error("그룹을 찾을 수 없습니다.");

            // 2. 본인 unit 찾기
            const groupUnitIdx = (group.unit || []).findIndex(u => u.user_key === user_key);
            if (groupUnitIdx === -1) throw new Error('본인 unit을 찾을 수 없습니다.');
            const myUnit = group.unit[groupUnitIdx];

            // 3. unit의 device_info에서 해당 device_id의 device_name 변경
            let found = false;
            if (!myUnit.device_info) myUnit.device_info = [];
            myUnit.device_info = myUnit.device_info.map(dev => {
                if (dev.device_id === device_id) {
                    found = true;
                    return { ...dev, device_name };
                }
                return dev;
            });

            // 4. groups 업데이트
            await groupsCol.updateOne(
                { _id: group._id },
                { $set: { [`unit.${groupUnitIdx}.device_info`]: myUnit.device_info } }
            );

            // 5. 다이나모 디비에서도 디바이스네임 업데이트
            try {
                await dynamoDB.update({
                    TableName: "DEVICE_TABLE", // 환경변수 또는 클래스 변수
                    Key: {
                        device_id,
                        user_key
                    },
                    UpdateExpression: 'SET device_name = :dn',
                    ExpressionAttributeValues: {
                        ':dn': device_name
                    }
                }).promise();
                return res.status(200).send("success");
            } catch (e) {
                return res.status(500).json({ message: '다이나모DB 업데이트 실패', error: e.message });
            }
        },


    }


}

module.exports = groups
