const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const {MongoClient} = require("mongodb");
const axios = require("axios");
const CryptoJS = require('crypto-js')
const moment = require("moment-timezone");
const {ConnectMongo} = require("../ConnectMongo");
var Client = require('mongodb').MongoClient;



const Myrucell = async function () {

    const {
        AWS_TOKEN, SUNIL_MONGO_URI, MONGO_URI, ADMIN_DB_NAME,GROUP_MONGO_URI,GROUP_DB_NAME,
        SMS_service_id,
        SMS_secret_key,
        SMS_access_key,
        SMS_PHONE,
    } = applyDotenv(dotenv)
    // MongoDB 클라이언트 연결
    const sunilClient = await MongoClient.connect(SUNIL_MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    const db = sunilClient.db("Sunil-Doorbell");
    const users = db.collection("users");
    const inquiry = db.collection("inquiries");
    const repair = db.collection("repairs");

    // 👇 Myrucell 리턴 객체 안쪽 함수들 정의하기 전에 한 번만 선언
    const findDuplicates = (arr = []) => {
        const map = {};
        const dups = [];
        for (const v of arr) {
            if (!map[v]) map[v] = 0;
            map[v]++;
        }
        for (const [key, count] of Object.entries(map)) {
            if (count > 1) dups.push(key);
        }
        return dups;
    };



    return {
        //신규문의(others,repair)=> others는 product 없어도됨. repair는 필수
        //{
        //     "types":"repair",
        //     "alertType": "email",
        //     "product": {
        //             "classification": "model",
        //             "name": "[4고싶은컬러금고]MC-20PR(HB,블루)",
        //             "serial": "202409101838",
        //             "device_id": "a4:b1:dd:k1:ms:k1"
        //         },
        //         "description":{
        //             "title":"[others]App용 API 테스트중입니다.",
        //             "content":"한번에 좀 되봅시다..."
        //         }
        // }
        async createInquiries(req, res) {
            const data = req.body
            const token = req.headers['x-access-token']
            try {
                const tokenVerify = jwt.verify(token, AWS_TOKEN)
                const userData = await users.findOne({user_key:tokenVerify.user_key})
                const findInquiry = await inquiry.findOne({id:userData.id,email:userData.email})
                // 유효성 검사
                if (!data.types || (data.types !== "repair" && data.types !== "others")) {
                    return res.status(400).json({ message: "Invalid types. Must be 'repair' or 'others'." });
                }

                if (!data.alertType || (data.alertType !== "email" && data.alertType !== "app")) {
                    return res.status(400).json({ message: "Invalid alertType. Must be 'email' or 'app'." });
                }

                if (!data.description || !data.description.title || !data.description.content) {
                    return res.status(400).json({ message: "Description must include a title and content." });
                }

                // types가 "repair"인 경우 product 유효성 검사
                if (data.types === "repair") {
                    if (!data.product || typeof data.product !== 'object' || Object.keys(data.product).length === 0) {
                        return res.status(400).json({ message: "Product must be a non-empty object when types is 'repair'." });
                    }

                    const { classification, name, serial } = data.product;
                    if (!classification || !name || !serial || classification.trim() === "" || name.trim() === "" || serial.trim() === "") {
                        return res.status(400).json({ message: "Product classification, name, and serial must not be empty." });
                    }
                }

                let nowTime =moment().tz('Asia/Seoul').toDate()
                let saveResponse;
                if (findInquiry === null) {
                    //이건 생 초짜배기 생성해주고
                    saveResponse = await inquiry.insertOne({
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        repairHistory: [],
                        communication: [
                            {
                                index: 0,
                                types: data.types,
                                inquiryNum: `${data.types}-${moment().tz('Asia/Seoul').format('YYYYMMDDkkmmss')}`,
                                alertType: data.alertType,
                                approve: data.types === "repair" ? "승인대기중" : "일반문의",
                                ...(data.product ? {product: data.product} : {}), // product가 있을 때만 추가
                                description: [{
                                    ...data.description,
                                    index:0,
                                    reply:false,
                                    date: nowTime,
                                }],
                            }
                        ],
                        answer:[
                            {
                                index: 0,
                                types: data.types,
                                inquiryNum: `${data.types}-${moment().tz('Asia/Seoul').format('YYYYMMDDkkmmss')}`,
                                alertType: data.alertType,
                                approve: data.types === "repair" ? "승인대기중" : "일반문의",
                                ...(data.product ? {product: data.product} : {}), // product가 있을 때만 추가
                                description: [{
                                    index:0,
                                    reply:false,
                                    date: null,
                                    title:null,
                                    content:null
                                }],
                            }
                        ]
                    })
                    if (saveResponse.acknowledged) {
                        return res.status(200).json({ message: "saveSuccess", data: "" });
                    } else {
                        return res.status(400).json({ message: "saveFail", error: "Failed to save data." });
                    }
                } else {
                    // findInquiry의 communication 배열에서 types가 "repair"인 객체들 중 최대 index 찾기
                    const maxIndex = Math.max(...findInquiry.communication
                        .filter(comm => comm.types === data.types)
                        .map(comm => comm.index), -1); // 기본값을 -1로 설정

                    saveResponse = await inquiry.updateOne(
                        {_id: findInquiry._id}, // 업데이트할 문서의 조건
                        {$set: {communication: [
                                    {
                                        index: maxIndex + 1,
                                        types: data.types,
                                        inquiryNum: `${data.types}-${moment().tz('Asia/Seoul').format('YYYYMMDDkkmmss')}`,
                                        alertType: data.alertType,
                                        approve: data.types === "repair" ? "승인대기중" : "일반문의",
                                        ...(data.product ? {product: data.product} : {}), // product가 있을 때만 추가
                                        description: [{
                                            ...data.description,
                                            index:0,
                                            reply:false,
                                            date: nowTime,
                                        }]
                                    },
                                    ...findInquiry.communication,
                                ],
                                answer:[
                                    {
                                        index: maxIndex + 1,
                                        types: data.types,
                                        inquiryNum: `${data.types}-${moment().tz('Asia/Seoul').format('YYYYMMDDkkmmss')}`,
                                        alertType: data.alertType,
                                        approve: data.types === "repair" ? "승인대기중" : "일반문의",
                                        ...(data.product ? {product: data.product} : {}), // product가 있을 때만 추가
                                        description: [{
                                            ...data.description,
                                            index:0,
                                            reply:false,
                                            title:null,
                                            content:null,
                                            date: null,
                                        }]
                                    },
                                    ...findInquiry.answer
                                ]

                        }} // 업데이트할 필드
                    );
                }

                // 응답 처리
                if (findInquiry === null) {
                    // 신규 생성 성공 여부 체크
                    if (saveResponse.acknowledged) {
                        return res.status(200).json({ message: "saveSuccess", data: saveResponse.ops[0] }); // 새로 생성된 데이터 반환
                    } else {
                        return res.status(400).json({ message: "saveFail", error: "Failed to save data." });
                    }
                } else {
                    // 업데이트 성공 여부 체크
                    if (saveResponse.modifiedCount > 0) {
                        const updatedInquiry = await inquiry.findOne({ _id: findInquiry._id }); // 업데이트된 데이터 가져오기
                        return res.status(200).json({ message: "updateSuccess", data: updatedInquiry }); // 업데이트된 데이터 반환
                    } else {
                        return res.status(400).json({ message: "updateFail", error: "Failed to update data." });
                    }
                }

            }catch (e){
                res.status(400).json({error: e})
            }

        },


        //헤더필수 tables="inquiry", "repair", "user"
        async getMyrucell(req, res) {
            const token = req.headers['x-access-token']
            try {
                const tokenVerify = jwt.verify(token, AWS_TOKEN)
                const table = req.query.tables //table
                // table 유효성 검사
                if (!["repair", "inquiry", "user"].includes(table)) {
                    return res.status(400).json({ error: "Invalid tables" });
                }
                const userData = await users.findOne({user_key:tokenVerify.user_key})
                if(table === 'user'){
                    return res.status(200).json(userData)
                }
                const findInquiry = await inquiry.findOne({id:userData.id,email:userData.email})
                const asNum = req.query.asNum
                // asNum 유효성 검사
                if (table === "repair" && !asNum) {
                    return res.status(400).json({ message: "asNum parameter is required." });
                }
                const findRepair = await inquiry.findOne({asNum:asNum,id:userData.id,email:userData.email})

                if(table === "inquiry"){
                    if (!findInquiry) {
                        // findInquiry 조회 실패 시 모든 값들을 {}로 반환
                        return res.status(200).json({ repair: {}, others: {}, all: {} });
                    }
                    // communication 내에서 types가 "repair"와 "others"로 나누기
                    const repairCommunications = findInquiry.communication
                        .filter(comm => comm.types === "repair")
                        .sort((a, b) => b.index - a.index); // index가 높은 순으로 정렬

                    const othersCommunications = findInquiry.communication
                        .filter(comm => comm.types === "others")
                        .sort((a, b) => b.index - a.index); // index가 높은 순으로 정렬

                    res.status(200).json({repair:repairCommunications,others: othersCommunications,all:findInquiry})
                }
                if(table === "repair"){
                    if (!findRepair) {
                        // findRepair 조회 실패 시 데이터가 없으면 {}
                        return res.status(200).json({ all: {} });
                    }

                    // findRepair 데이터가 있을 경우
                    return res.status(200).json({ all: findRepair });
                }
            } catch (err) {
                res.status(500).json({error: err})
            }
        },

        //{
        //     "inquiryNum": "iq-20240911245001-repair",
        //     "description":{
        //             "title":"재답변요망2",
        //             "content":"아니 승인해달라구요."
        //         }
        // }
        async updateInquiries(req, res) {
            const data = req.body;
            const token = req.headers['x-access-token'];
            console.log("Request data:", data); // 요청 데이터 확인
            try {
                const tokenVerify = jwt.verify(token, AWS_TOKEN);
                let nowTime = moment().tz('Asia/Seoul').toDate();
                const userData = await users.findOne({ user_key: tokenVerify.user_key });
                const findInquiry = await inquiry.findOne({ id: userData.id, email: userData.email });

                // inquiryNum에 해당하는 communication 항목 찾기
                let findTarget = findInquiry.communication.find(item => item.inquiryNum === data.inquiryNum);
                let findAnswerTarget = findInquiry.answer.find(item => item.inquiryNum === data.inquiryNum);

                // saveItems 생성
                let saveItems = [
                    {
                        ...data.description,
                        index: findTarget.description.length, // 현재 description의 길이를 index로 사용
                        reply: false,
                        date: nowTime,
                    },
                    ...findTarget.description
                ];
                let saveAnswerItems = [
                    {
                        index: findTarget.description.length, // 현재 description의 길이를 index로 사용
                        reply: false,
                        title:null,
                        content:null,
                        date: null,
                    },
                    ...findAnswerTarget.description
                ];

                console.log("saveItems before update:", saveItems); // saveItems 확인

                // 데이터베이스 업데이트
                let saveResponse = await inquiry.updateOne(
                    { _id: findInquiry._id, "communication.inquiryNum": data.inquiryNum,"answer.inquiryNum": data.inquiryNum },
                    {
                        $set: {
                            "communication.$.description": saveItems, // 해당 communication의 description 업데이트
                            "answer.$.description": saveAnswerItems // 해당 communication의 description 업데이트
                        }
                    }
                );

                // 결과 처리
                if (saveResponse.modifiedCount > 0) {
                    const updatedInquiry = await inquiry.findOne({ _id: findInquiry._id });
                    return res.status(200).json({ message: "Update successful", data: updatedInquiry });
                } else {
                    // 업데이트가 성공했지만, 수정된 문서가 없는 경우
                    return res.status(400).json({ message: "noChanges", error: "No documents were modified." });
                }
            } catch (err) {
                console.error("Error:", err); // 에러 로그
                res.status(400).json({ error: err });
            }
        },

        //repair => {}
        async deleteInquiries(req, res) {
            const data = req.body; // 요청 본문에서 데이터 가져오기
            const token = req.headers['x-access-token'];

            try {
                const tokenVerify = jwt.verify(token, AWS_TOKEN);
                const userData = await users.findOne({ user_key: tokenVerify.user_key });
                const findInquiry = await inquiry.findOne({ id: userData.id, email: userData.email });

                // data.inquiryNum을 사용하여 해당 communication을 찾습니다.
                const communication = findInquiry.communication.find(item => item.inquiryNum === data.inquiryNum);

                if (communication) {
                    // 해당 description에서 index, title, content가 일치하는 항목을 찾습니다.
                    const description = communication.description.find(desc =>
                        desc.index === data.description.index &&
                        desc.title === data.description.title &&
                        desc.content === data.description.content
                    );

                    if (description && description.reply) {
                        // 이미 답변이 달린 경우
                        return res.status(400).json({
                            error: "Cannot delete inquiries with replies.",
                            message: "Responses have already been provided. Please make additional inquiries or re-inquire."
                        });
                    } else {
                        // 답변이 없는 경우, 해당 description 삭제
                        communication.description = communication.description.filter(desc =>
                            !(desc.index === data.description.index &&
                                desc.title === data.description.title &&
                                desc.content === data.description.content)
                        );

                        // 업데이트된 communication 저장
                        await inquiry.updateOne(
                            { _id: findInquiry._id, "communication.inquiryNum": data.inquiryNum },
                            { $set: { "communication.$.description": communication.description } }
                        );

                        return res.status(200).json({ message: "Inquiry deleted successfully." });
                    }
                } else {
                    return res.status(404).json({ error: "Inquiry not found." });
                }
            } catch (err) {
                console.error(err); // 전체 에러 로그 출력
                res.status(500).json({ error: err.message });
            }
        },

        //긴급 연락처 조회
        async getEmergency(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            try {
                const { collection: emergencyCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'emergency');

                const doc = await emergencyCol.findOne({ user_key });

                // 문의 조회 로직처럼, 없으면 200 + 빈 구조 반환
                if (!doc) {
                    return res.status(200).json({ tels: [] });
                }

                return res.status(200).json({
                    user_key: doc.user_key,
                    tels: doc.tels || []
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ message: "서버 오류가 발생했습니다." });
            }
        },

        //긴급 연락처 첫 생성
        async createEmergency(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            const { tels = [] } = req.body;

            // 기본 검증
            if (!Array.isArray(tels) || tels.length === 0) {
                return res.status(400).json({ message: "tels 배열을 최소 1개 이상 보내주세요." });
            }

            if (tels.length > 5) {
                return res.status(400).json({ message: "긴급 연락처는 최대 5개까지 등록 가능합니다." });
            }

            // 요청 배열 내부 중복 체크
            const dupInBody = findDuplicates(tels);
            if (dupInBody.length > 0) {
                return res.status(400).json({
                    message: "요청에 중복된 번호가 포함되어 있습니다.",
                    duplicates: dupInBody
                });
            }

            try {
                const { collection: emergencyCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'emergency');

                // 이미 생성되어 있는지 체크
                const existing = await emergencyCol.findOne({ user_key });
                if (existing) {
                    return res.status(400).json({
                        message: "이미 긴급 연락처가 생성되어 있습니다. 추가 등록은 addEmergency를 사용하세요."
                    });
                }

                const now = new Date();
                const doc = {
                    user_key,
                    tels: tels.map(num => ({
                        number: num,
                        createdAt: now
                    }))
                };

                const result = await emergencyCol.insertOne(doc);

                return res.status(201).json({
                    message: "긴급 연락처가 생성되었습니다.",
                    data: { _id: result.insertedId, ...doc }
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ message: "서버 오류가 발생했습니다." });
            }
        },


        //긴급 연락처 추가
        async addEmergency(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            const { tels = [] } = req.body;

            if (!Array.isArray(tels) || tels.length === 0) {
                return res.status(400).json({ message: "tels 배열을 최소 1개 이상 보내주세요." });
            }

            // 요청 배열 내부 중복 체크
            const dupInBody = findDuplicates(tels);
            if (dupInBody.length > 0) {
                return res.status(400).json({
                    message: "요청에 중복된 번호가 포함되어 있습니다.",
                    duplicates: dupInBody
                });
            }

            try {
                const { collection: emergencyCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'emergency');

                const emergency = await emergencyCol.findOne({ user_key });
                if (!emergency) {
                    return res.status(404).json({ message: "긴급 연락처가 아직 생성되지 않았습니다." });
                }

                const existingNumbers = (emergency.tels || []).map(t => t.number);

                // DB에 이미 존재하는 번호와 겹치는지 체크
                const duplicatedWithExisting = tels.filter(num => existingNumbers.includes(num));
                if (duplicatedWithExisting.length > 0) {
                    return res.status(400).json({
                        message: "이미 등록된 번호가 있습니다.",
                        duplicates: duplicatedWithExisting
                    });
                }

                // 최대 5개 제한 체크
                const totalCount = existingNumbers.length + tels.length;
                if (totalCount > 5) {
                    return res.status(400).json({
                        message: "긴급 연락처는 최대 5개까지 등록 가능합니다.",
                        currentCount: existingNumbers.length,
                        addCount: tels.length
                    });
                }

                const now = new Date();
                const newTels = tels.map(num => ({
                    number: num,
                    createdAt: now
                }));

                // push + each 로 추가
                await emergencyCol.updateOne(
                    { user_key },
                    { $push: { tels: { $each: newTels } } }
                );

                const updated = await emergencyCol.findOne({ user_key });

                return res.status(200).json({
                    message: "긴급 연락처가 추가되었습니다.",
                    data: updated
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ message: "서버 오류가 발생했습니다." });
            }
        },


        //긴급 연락처 삭제
        async deleteEmergency(req, res) {
            const token = req.headers['token'];
            if (!token) return res.status(401).send("토큰이 없습니다.");

            let user_key;
            try {
                const decoded = jwt.verify(token, AWS_TOKEN);
                user_key = decoded.user_key;
            } catch (err) {
                return res.status(401).send("Unauthorized: Invalid token.");
            }

            const { type, tels = [] } = req.body;

            try {
                const { collection: emergencyCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'emergency');

                const emergency = await emergencyCol.findOne({ user_key });
                if (!emergency) {
                    return res.status(404).json({ message: "긴급 연락처가 존재하지 않습니다." });
                }

                if (type === "all") {
                    // 전체삭제: tels 를 빈 배열로
                    await emergencyCol.updateOne(
                        { user_key },
                        { $set: { tels: [] } }
                    );

                    const updated = await emergencyCol.findOne({ user_key });

                    return res.status(200).json({
                        message: "모든 긴급 연락처가 삭제되었습니다.",
                        data: updated
                    });
                } else {
                    // 부분 삭제: 넘겨준 tels 에 해당하는 번호만 삭제
                    if (!Array.isArray(tels) || tels.length === 0) {
                        return res.status(400).json({
                            message: "삭제할 번호를 tels 배열로 보내주세요."
                        });
                    }

                    const beforeTels = emergency.tels || [];
                    const beforeCount = beforeTels.length;

                    const newTels = beforeTels.filter(t => !tels.includes(t.number));
                    const afterCount = newTels.length;

                    if (beforeCount === afterCount) {
                        // 하나도 삭제되지 않은 경우
                        return res.status(404).json({
                            message: "삭제 대상 번호가 존재하지 않습니다.",
                            requested: tels
                        });
                    }

                    await emergencyCol.updateOne(
                        { user_key },
                        { $set: { tels: newTels } }
                    );

                    const updated = await emergencyCol.findOne({ user_key });

                    return res.status(200).json({
                        message: "선택한 긴급 연락처가 삭제되었습니다.",
                        removedCount: beforeCount - afterCount,
                        data: updated
                    });
                }
            } catch (err) {
                console.error(err);
                return res.status(500).json({ message: "서버 오류가 발생했습니다." });
            }
        },

        //긴급 연락처들로 문자 전송
        // 긴급 연락처들로 문자 전송
        async sendEmergency(req, res) {
            const { device_id, user_key } = req.body;

            if (!device_id || !user_key) {
                return res.status(400).json({
                    message: "device_id와 user_key는 필수입니다."
                });
            }

            try {
                // 1) 그룹 정보에서 해당 유저 + 디바이스 찾기
                const { collection: groupsCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'groups');

                const groupDoc = await groupsCol.findOne(
                    {
                        user_key, // 마스터 user_key (Groups 스키마 상단 user_key)
                        unit: {
                            $elemMatch: {
                                user_key,          // 그 안의 unit.user_key
                                auth: true,        // 마스터
                                "device_info.device_id": device_id
                            }
                        }
                    },
                    { projection: { unit: 1, _id: 0 } }
                );

                if (!groupDoc) {
                    return res.status(404).send("본인에게 등록된 device_id가 아닙니다.");
                }

                // unit 배열에서 해당 유저 + 디바이스 정보 찾기
                const unit = (groupDoc.unit || []).find(
                    (u) =>
                        u.user_key === user_key &&
                        Array.isArray(u.device_info) &&
                        u.device_info.some(d => d.device_id === device_id)
                );

                if (!unit) {
                    return res.status(404).send("해당 유저에 대한 device 정보가 없습니다.");
                }

                const devInfo = unit.device_info.find(d => d.device_id === device_id);
                const deviceName = devInfo?.device_name || "등록된 기기";

                // 2) emergency 컬렉션에서 긴급 연락처 조회
                const { collection: emergencyCol } = await ConnectMongo(GROUP_MONGO_URI, GROUP_DB_NAME, 'emergency');
                const emergency = await emergencyCol.findOne({ user_key });

                if (!emergency || !Array.isArray(emergency.tels) || emergency.tels.length === 0) {
                    return res.status(404).json({ message: "등록된 긴급 연락처가 없습니다." });
                }

                const phoneNumbers = emergency.tels
                    .map(t => t.number)
                    .filter(Boolean);

                if (phoneNumbers.length === 0) {
                    return res.status(404).json({ message: "유효한 긴급 연락처 번호가 없습니다." });
                }

                // 3) NCP SENS로 SMS 전송
                const date = Date.now().toString();

                const serviceId = SMS_service_id;
                const secretKey = SMS_secret_key;
                const accessKey = SMS_access_key;
                const smsPhone = SMS_PHONE;

                const method = "POST";
                const space = " ";
                const newLine = "\n";
                const url = `https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
                const url2 = `/sms/v2/services/${serviceId}/messages`;

                // signature 작성
                const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
                hmac.update(method);
                hmac.update(space);
                hmac.update(url2);
                hmac.update(newLine);
                hmac.update(date);
                hmac.update(newLine);
                hmac.update(accessKey);
                const hash = hmac.finalize();
                const signature = hash.toString(CryptoJS.enc.Base64);

                const content = `경고!! [${deviceName}] 금고가 긴급 비밀번호로 오픈되었습니다.`;

                await axios({
                    method,
                    json: true,
                    url,
                    headers: {
                        "Content-type": "application/json; charset=utf-8",
                        "x-ncp-iam-access-key": accessKey,
                        "x-ncp-apigw-timestamp": date,
                        "x-ncp-apigw-signature-v2": signature,
                    },
                    data: {
                        type: "SMS",
                        countryCode: "82",
                        from: smsPhone,
                        content, // 공통 내용
                        messages: phoneNumbers.map(p => ({ to: String(p) })), // 긴급 연락처 전체
                    },
                });

                return res.status(200).json({
                    message: "긴급 문자가 전송되었습니다.",
                    device_name: deviceName,
                    count: phoneNumbers.length,
                });

            } catch (err) {
                console.error(err);
                return res.status(500).json({
                    message: "긴급 문자 전송 중 오류가 발생했습니다.",
                    error: err.message,
                });
            }
        },


    }

}

module.exports = Myrucell;


