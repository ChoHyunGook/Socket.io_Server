const {ConnectMongo} = require("../ConnectMongo");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

const {
    GROUP_MONGO_URI,AWS_TOKEN,GROUP_DB_NAME
} = applyDotenv(dotenv)


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

            if (r.modifiedCount === 0) return res.status(400).send("업데이트된 정보가 없습니다.");

            return res.status(200).json(true);
        },


    }
}

module.exports = groups
