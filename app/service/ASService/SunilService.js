// services/ASService/index.js
// 목적: AS(수리) CRUD + 날짜변경 전용 API (식별자는 as_num만 사용) - Mongo Native(ConnectMongo) 버전

const { ConnectMongo } = require("../ConnectMongo");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");

const { SUNIL_MONGO_URI } = applyDotenv(dotenv);

const STATUS_IN_PROGRESS = "as 진행 중";

// 공통 유틸: 쿼리/바디에서 as_num 추출
function getAsNum(req) {
    const raw = req.query?.as_num ?? req.body?.as_num;
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
}

// 컬렉션 핸들 캐시
let _colPromise = null;
async function getCol() {
    if (!_colPromise) {
        _colPromise = (async () => {
            const { collection } = await ConnectMongo(
                SUNIL_MONGO_URI,
                "Sunil-Doorbell",
                "asservices"
            );
            return collection;
        })();
    }
    return _colPromise;
}

const sunilService = function () {
    return {
        // ✅ GET /repair (리스트 조회)
        async list(req, res) {
            try {
                const col = await getCol();

                const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
                const limit = Math.max(parseInt(req.query.limit ?? "10", 10), 1);
                const skip = (page - 1) * limit;

                const { status, user_id } = req.query;

                const filter = {};
                if (status) filter.status = status;
                if (user_id) filter.user_id = user_id;

                const cursor = col
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit);

                const [items, total] = await Promise.all([
                    cursor.toArray(),
                    col.countDocuments(filter),
                ]);

                res.status(200).json({
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    items,
                });
            } catch (err) {
                res
                    .status(500)
                    .json({ message: "AS 조회 실패", error: String(err?.message || err) });
            }
        },

        // ✅ POST /repair (AS 생성)
        async create(req, res) {
            try {
                const col = await getCol();

                const {
                    user_id,
                    name,
                    tel,
                    model,
                    addr,
                    appointmentDate,
                    confirmDate,
                    subscribe,
                    status,
                    reply,
                } = req.body || {};

                if (!user_id || !name || !tel || !model || !addr) {
                    return res
                        .status(400)
                        .json({ message: "필수값 누락(user_id, name, tel, model, addr)" });
                }

                // as_num 자동 증가 (가장 큰 as_num + 1)
                // ※ 동시성에 민감하다면 별도 counters 컬렉션으로 시퀀스 관리 권장
                const lastDoc = await col
                    .find({}, { projection: { as_num: 1 } })
                    .sort({ as_num: -1 })
                    .limit(1)
                    .toArray();
                const nextAsNum = lastDoc.length ? (lastDoc[0].as_num || 0) + 1 : 1;

                const now = new Date();
                const doc = {
                    as_num: nextAsNum,
                    user_id,
                    name,
                    tel,
                    model,
                    addr,
                    appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
                    confirmDate: confirmDate ? new Date(confirmDate) : null,
                    subscribe: subscribe ?? null,
                    status: status ?? "대기",
                    reply: reply ?? null,
                    repairInfo: {
                        driver: { id: null, name: null, tel: null },
                        status: false,
                        memo: null,
                        attached: [],
                        createAt: now,
                        updateAt: now,
                    },
                    createdAt: now,
                    updatedAt: now,
                };

                await col.insertOne(doc);

                res.status(200).json({ message: "AS 생성 성공", item: doc });
            } catch (err) {
                res
                    .status(500)
                    .json({ message: "AS 생성 실패", error: String(err?.message || err) });
            }
        },

        // ✅ PATCH /repair/date (방문일자 변경)
        async updateDate(req, res) {
            try {
                const col = await getCol();

                const as_num = getAsNum(req);
                const { appointmentDate, confirmDate } = req.body || {};

                if (as_num === null) {
                    return res.status(400).json({ message: "as_num이 필요합니다." });
                }
                if (!appointmentDate && !confirmDate) {
                    return res
                        .status(400)
                        .json({ message: "appointmentDate 또는 confirmDate 중 최소 1개 필요" });
                }

                const doc = await col.findOne({ as_num });
                if (!doc)
                    return res.status(404).json({ message: "AS 문서를 찾을 수 없습니다." });

                if (doc.status === STATUS_IN_PROGRESS) {
                    return res.status(409).json({
                        message: "as 진행 중 상태에서는 방문일자 변경이 불가합니다.",
                    });
                }

                const update = { updatedAt: new Date() };
                if (appointmentDate) update.appointmentDate = new Date(appointmentDate);
                if (confirmDate) update.confirmDate = new Date(confirmDate);

                const { value: updated } = await col.findOneAndUpdate(
                    { as_num },
                    { $set: update },
                    { returnDocument: "after" }
                );

                res.status(200).json({ message: "방문일자 변경 성공", item: updated });
            } catch (err) {
                res.status(500).json({
                    message: "방문일자 변경 실패",
                    error: String(err?.message || err),
                });
            }
        },

        // ✅ PATCH /repair (일반 수정)
        async update(req, res) {
            try {
                const col = await getCol();

                const as_num = getAsNum(req);
                if (as_num === null) {
                    return res.status(400).json({ message: "as_num이 필요합니다." });
                }

                const { appointmentDate, confirmDate, ...rest } = req.body || {};
                // 날짜 필드는 여기 라우트에서 불가 → 무시
                delete rest.appointmentDate;
                delete rest.confirmDate;

                const { value: updated } = await col.findOneAndUpdate(
                    { as_num },
                    { $set: { ...rest, updatedAt: new Date() } },
                    { returnDocument: "after" }
                );

                if (!updated)
                    return res.status(404).json({ message: "AS 문서를 찾을 수 없습니다." });

                res.status(200).json({ message: "AS 수정 성공", item: updated });
            } catch (err) {
                res
                    .status(500)
                    .json({ message: "AS 수정 실패", error: String(err?.message || err) });
            }
        },

        // ✅ DELETE /repair (삭제)
        async remove(req, res) {
            try {
                const col = await getCol();

                const as_num = getAsNum(req);
                if (as_num === null) {
                    return res.status(400).json({ message: "as_num이 필요합니다." });
                }

                const { value: deleted } = await col.findOneAndDelete({ as_num });
                if (!deleted)
                    return res.status(404).json({ message: "AS 문서를 찾을 수 없습니다." });

                res.status(200).json({ message: "AS 삭제 성공", item: deleted });
            } catch (err) {
                res
                    .status(500)
                    .json({ message: "AS 삭제 실패", error: String(err?.message || err) });
            }
        },
    };
};

module.exports = sunilService;
