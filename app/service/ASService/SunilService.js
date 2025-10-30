// services/ASService/index.js
// 목적: AS(수리) CRUD + 날짜변경 전용 API (식별자는 as_num만 사용) - Mongo Native(ConnectMongo) 버전

const {ConnectMongo} = require("../ConnectMongo");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


const {SUNIL_MONGO_URI} = applyDotenv(dotenv);

const STATUS_IN_PROGRESS = "as 진행 중";

// 공통 유틸: 쿼리/바디에서 as_num 추출
function getAsNum(req) {
    const raw = req.query?.as_num ?? req.body?.as_num;
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
}

// === 컬렉션 핸들 캐시 (수정: 수리/드라이버 분리 캐싱) ===
let _asColPromise = null;
let _driverColPromise = null;

async function getCol() {
    if (!_asColPromise) {
        _asColPromise = (async () => {
            const {collection} = await ConnectMongo(
                SUNIL_MONGO_URI,
                "Sunil-Doorbell",
                "asservices"
            );
            return collection;
        })();
    }
    return _asColPromise;
}

async function getDriverCol() {
    if (!_driverColPromise) {
        _driverColPromise = (async () => {
            const {collection} = await ConnectMongo(
                SUNIL_MONGO_URI,
                "Sunil-Doorbell",
                "deliveryinfos"
            );
            return collection;
        })();
    }
    return _driverColPromise;
}

// JWT 유틸
function signJwt(payload) {
    const secret = "sunil-default-secret";
    const expiresIn = "7d";
    return jwt.sign(payload, secret, {expiresIn});
}

const sunilService = function () {
    return {
        // ============================
        // 드라이버 로그인
        // POST /repair/driver/login
        // body: { id, pw }
        // 성공: { token, driver: { id, name, tel, area }, expiresIn }
        // ============================
        async driverLogin(req, res) {
            try {
                const col = await getDriverCol();
                let {id, pw} = req.body || {};

                if (!id || !pw) {
                    return res.status(400).json({message: "필수값 누락(id, pw)"});
                }

                const driver = await col.findOne(
                    {id},
                    {
                        projection: {
                            _id: 0,
                            id: 1,
                            pw: 1,
                            name: 1,
                            tel: 1,
                            area: 1,
                        },
                    }
                );

                if (!driver?.pw) {
                    return res
                        .status(401)
                        .json({message: "아이디 또는 비밀번호가 올바르지 않습니다."});
                }

                const ok = await bcrypt.compare(pw, driver.pw);
                if (!ok) {
                    return res
                        .status(401)
                        .json({message: "아이디 또는 비밀번호가 올바르지 않습니다."});
                }

                // 토큰 발급
                const payload = {sub: driver.id, role: "driver"};
                const token = signJwt(payload);
                const expiresIn = "7d";

                // 비밀번호 제거 후 응답
                const {pw: _pw, ...driverSafe} = driver;
                return res.status(200).json({
                    message: "로그인 성공",
                    token,
                    expiresIn,
                    driver: driverSafe,
                });


            } catch (err) {
                res
                    .status(500)
                    .json({message: "수리기사 로그인 실패", error: String(err?.message || err)});
            }
        },

        // ============================
        // 드라이버 아이디 찾기
        // POST /repair/driver/find-id
        // body: { name, tel }
        // 성공: { id }
        // ============================
        async findDriver(req, res) {
            try {
                const col = await getDriverCol();
                const {name, tel} = req.body || {};

                if (!name || !tel) {
                    return res.status(400).json({message: "필수값 누락(name, tel)"});
                }

                const doc = await col.findOne(
                    {name, tel},
                    {projection: {_id: 0, id: 1}}
                );

                if (!doc) {
                    return res
                        .status(404)
                        .json({message: "일치하는 수리기사 정보를 찾을 수 없습니다."});
                }

                return res.status(200).json({message: "아이디 조회 성공", id: doc.id});
            } catch (err) {
                return res.status(500).json({
                    message: "수리기사 아이디 찾기 실패",
                    error: String(err?.message || err),
                });
            }
        },

        // ============================
        // 드라이버 비밀번호 변경
        // POST /repair/driver/change-password
        // body: { id, name, tel, new_pw }
        // ============================
        async changePassword(req, res) {
            try {
                const col = await getDriverCol();
                const { id, name, tel, new_pw } = req.body || {};

                // 필수값 체크
                if (!id || !name || !tel || !new_pw) {
                    return res.status(400).json({
                        message: "필수값 누락(id, name, tel, new_pw)"
                    });
                }

                // 해당 기사 문서 찾기 (정확 일치)
                const driver = await col.findOne(
                    { id, name, tel },
                    { projection: { _id: 1 } }
                );

                if (!driver) {
                    return res.status(404).json({
                        message: "일치하는 수리기사 정보를 찾을 수 없습니다."
                    });
                }

                // 새 비밀번호 해시
                const hashed = await bcrypt.hash(new_pw, 10);

                // 업데이트
                await col.updateOne(
                    { _id: driver._id },
                    { $set: { pw: hashed } }
                );

                return res.status(200).json({
                    message: "비밀번호 변경 성공"
                });

            } catch (err) {
                return res.status(500).json({
                    message: "비밀번호 변경 실패",
                    error: String(err?.message || err)
                });
            }
        },


        // =====================================================================
        // 드라이버 아이디 기준 수리조회 (토큰 기반 / header.token 사용)
        // GET /repair/driver
        // header:
        //   token: <JWT 토큰>
        // query:
        //   - start (옵션, ISO 문자열) : confirmDate >= start
        //   - end   (옵션, ISO 문자열) : confirmDate <  end(다음날 00:00 권장 또는 end 자체를 미포함 경계)
        //   - page, limit (옵션, 기본 1, 10)
        // 설명: 날짜가 들어오면 confirmDate 기준으로 필터링, 없으면 전체(드라이버 아이디 기준) 조회
        // =====================================================================
        async findDriverById(req, res) {
            try {
                const col = await getCol();

                // 1) 토큰 꺼내기
                const token = req.headers?.token;
                if (!token) {
                    return res.status(401).json({message: "토큰이 필요합니다. (header.token)"});
                }

                // 2) 토큰 검증
                const secret = "sunil-default-secret";
                let decoded;
                try {
                    decoded = jwt.verify(token, secret);
                } catch {
                    return res.status(401).json({message: "유효하지 않은 토큰입니다."});
                }

                // 드라이버 id 가져오기
                const driver_id = decoded?.sub;
                if (!driver_id) {
                    return res.status(401).json({message: "토큰에 드라이버 정보가 없습니다."});
                }

                // 3) 페이지네이션
                const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
                const limit = Math.max(parseInt(req.query.limit ?? "10", 10), 1);
                const skip = (page - 1) * limit;

                // 4) 필터 생성
                const filter = {"repairInfo.driver.id": driver_id};

                // 5) 날짜 필터 (confirmDate 기준)
                const {start, end} = req.query || {};

                if (start) {
                    const s = new Date(start);
                    if (isNaN(s.getTime())) {
                        return res.status(400).json({message: "start 형식이 올바르지 않습니다(ISO 문자열)."});
                    }
                    filter.confirmDate = {...(filter.confirmDate || {}), $gte: s};
                }

                if (end) {
                    const e = new Date(end);
                    if (isNaN(e.getTime())) {
                        return res.status(400).json({message: "end 형식이 올바르지 않습니다(ISO 문자열)."});
                    }
                    filter.confirmDate = {...(filter.confirmDate || {}), $lt: e};
                }

                // 6) 조회
                const cursor = col
                    .find(filter)
                    .sort({confirmDate: -1, createdAt: -1})
                    .skip(skip)
                    .limit(limit);

                const [items, total] = await Promise.all([
                    cursor.toArray(),
                    col.countDocuments(filter),
                ]);

                return res.status(200).json({
                    message: "드라이버 아이디 기준 수리조회 성공",
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    items,
                });
            } catch (err) {
                return res.status(500).json({
                    message: "드라이버 아이디 기준 수리조회 실패",
                    error: String(err?.message || err),
                });
            }
        },


        // ✅ GET /repair (리스트 조회)
        async list(req, res) {
            try {
                const col = await getCol();

                const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
                const limit = Math.max(parseInt(req.query.limit ?? "10", 10), 1);
                const skip = (page - 1) * limit;

                const {status, user_id} = req.query;

                const filter = {};
                if (status) filter.status = status;
                if (user_id) filter.user_id = user_id;

                const cursor = col
                    .find(filter)
                    .sort({createdAt: -1})
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
                    .json({message: "AS 조회 실패", error: String(err?.message || err)});
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
                        .json({message: "필수값 누락(user_id, name, tel, model, addr)"});
                }

                // as_num 자동 증가 (가장 큰 as_num + 1)
                // ※ 동시성에 민감하다면 별도 counters 컬렉션으로 시퀀스 관리 권장
                const lastDoc = await col
                    .find({}, {projection: {as_num: 1}})
                    .sort({as_num: -1})
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
                        driver: {id: null, name: null, tel: null},
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

                res.status(200).json({message: "AS 생성 성공", item: doc});
            } catch (err) {
                res
                    .status(500)
                    .json({message: "AS 생성 실패", error: String(err?.message || err)});
            }
        },

        // ✅ PATCH /repair/date (방문일자 변경)
        async updateDate(req, res) {
            try {
                const col = await getCol();

                const as_num = getAsNum(req);
                const {appointmentDate, confirmDate} = req.body || {};

                if (as_num === null) {
                    return res.status(400).json({message: "as_num이 필요합니다."});
                }
                if (!appointmentDate && !confirmDate) {
                    return res
                        .status(400)
                        .json({message: "appointmentDate 또는 confirmDate 중 최소 1개 필요"});
                }

                const doc = await col.findOne({as_num});
                if (!doc)
                    return res.status(404).json({message: "AS 문서를 찾을 수 없습니다."});

                if (doc.status === STATUS_IN_PROGRESS) {
                    return res.status(409).json({
                        message: "as 진행 중 상태에서는 방문일자 변경이 불가합니다.",
                    });
                }

                const update = {updatedAt: new Date()};
                if (appointmentDate) update.appointmentDate = new Date(appointmentDate);
                if (confirmDate) update.confirmDate = new Date(confirmDate);

                const {value: updated} = await col.findOneAndUpdate(
                    {as_num},
                    {$set: update},
                    {returnDocument: "after"}
                );

                res.status(200).json({message: "방문일자 변경 성공", item: updated});
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
                    return res.status(400).json({message: "as_num이 필요합니다."});
                }

                const {appointmentDate, confirmDate, ...rest} = req.body || {};
                // 날짜 필드는 여기 라우트에서 불가 → 무시
                delete rest.appointmentDate;
                delete rest.confirmDate;

                const {value: updated} = await col.findOneAndUpdate(
                    {as_num},
                    {$set: {...rest, updatedAt: new Date()}},
                    {returnDocument: "after"}
                );

                if (!updated)
                    return res.status(404).json({message: "AS 문서를 찾을 수 없습니다."});

                res.status(200).json({message: "AS 수정 성공", item: updated});
            } catch (err) {
                res
                    .status(500)
                    .json({message: "AS 수정 실패", error: String(err?.message || err)});
            }
        },

        // ✅ DELETE /repair (삭제)
        async remove(req, res) {
            try {
                const col = await getCol();

                const as_num = getAsNum(req);
                if (as_num === null) {
                    return res.status(400).json({message: "as_num이 필요합니다."});
                }

                const {value: deleted} = await col.findOneAndDelete({as_num});
                if (!deleted)
                    return res.status(404).json({message: "AS 문서를 찾을 수 없습니다."});

                res.status(200).json({message: "AS 삭제 성공", item: deleted});
            } catch (err) {
                res
                    .status(500)
                    .json({message: "AS 삭제 실패", error: String(err?.message || err)});
            }
        },
    };
};

module.exports = sunilService;
