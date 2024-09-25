const db = require('../../DataBase');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const {MongoClient} = require("mongodb");
const moment = require("moment-timezone");
var Client = require('mongodb').MongoClient;



const Myrucell = async function () {

    const {
        AWS_TOKEN, SUNIL_MONGO_URI, MONGO_URI, ADMIN_DB_NAME
    } = applyDotenv(dotenv)
    // MongoDB 클라이언트 연결
    const sunilClient = await MongoClient.connect(SUNIL_MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});
    const db = sunilClient.db("Sunil-Doorbell");
    const users = db.collection("users");
    const inquiry = db.collection("inquiries");
    const repair = db.collection("repairs");

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


    }


}

module.exports = Myrucell;


