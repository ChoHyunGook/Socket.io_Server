const dotenv = require("dotenv");
const applyDotenv = require("../../middlewares/applyDotenv");
const bcrypt = require('bcrypt')
const AWS = require("aws-sdk")
const nodemailer = require("nodemailer");
const moment = require("moment-timezone");
const axios = require("axios");
const CryptoJS = require('crypto-js')
const {ConnectMongo} = require('../../utils/connectMongo');
const db = require("../../Models");
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

const AuthNumDB = db.authNum


const doorbell = function () {
    return {
        async autoSignIn(req, res) {
            const body = req.body;
            console.log('[autoSignIn] called');
            console.log('[autoSignIn] request body:', body);

            try {
                const lambdaResponse = await axios.post(
                    AWS_LAMBDA_SIGNIN,
                    JSON.stringify(body),
                    { headers: { 'Content-Type': 'application/json' } }
                );
                console.log('[autoSignIn] raw lambda response:', lambdaResponse.data);

                const result = typeof lambdaResponse.data.body === 'string'
                    ? JSON.parse(lambdaResponse.data.body)
                    : lambdaResponse.data;

                console.log('[autoSignIn] parsed lambda result:', result);

                if (result.resultcode === '00') {
                    const autoToken = jwt.sign(
                        { user_key: result.response.user_key },
                        AWS_TOKEN,
                        { expiresIn: '1y' }
                    );

                    const resultObj = {
                        resultcode: '00',
                        message: 'success',
                        response: {
                            token: autoToken,
                            user_key: result.response.user_key
                        }
                    };

                    console.log('[autoSignIn] login success - issuing new token');
                    console.log('[autoSignIn] issued token payload:', {
                        user_key: result.response.user_key,
                        expiresIn: '1y'
                    });
                    console.log('[autoSignIn] final response object:', resultObj);

                    return res.status(200).json(resultObj);
                } else {
                    console.log('[autoSignIn] login failed - lambda result:', result);
                    return res.status(401).json({
                        resultcode: result.resultcode || 'EE',
                        message: result.message || 'Login failed',
                        response: null
                    });
                }

            } catch (err) {
                console.error('[autoSignIn] lambda call failed');
                console.error(err);

                if (err.response) {
                    console.error('[autoSignIn] err.response.data:', err.response.data);
                    console.error('[autoSignIn] err.response.status:', err.response.status);
                } else if (err.request) {
                    console.error('[autoSignIn] err.request:', err.request);
                } else {
                    console.error('[autoSignIn] err.message:', err.message);
                }

                return res.status(500).json({
                    resultcode: 'FF',
                    message: 'Lambda call failed',
                    response: {
                        error: err.message
                    }
                });
            }
        },

        async updateUser(req, res) {
            const data = req.body;
            const token = req.headers['token'];

            try {
                const verify = jwt.verify(token, process.env.AWS_TOKEN);
                const userKey = verify.user_key;

                // ✅ MongoDB 연결 및 해당 유저 조회
                const { collection: tablesCol } = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findData = await tablesCol.findOne({ user_key: userKey });

                if (!findData) {
                    return res.status(404).send('User not found');
                }
                console.log(data)

                // ✅ MongoDB 정보 업데이트 (비밀번호 제외)
                await tablesCol.updateOne(
                    { user_key: userKey },
                    {
                        $set: {
                            id: data.user_id,
                            name: data.name,
                            tel: data.tel,
                            addr: data.addr
                        }
                    }
                );

                // ✅ DynamoDB 비밀번호 포함 모든 정보 업데이트
                const encryptedPassword = bcrypt.hashSync(data.user_pw, 5);

                const updateParams = {
                    TableName: 'USER_TABLE',
                    Key: {
                        user_key: userKey
                    },
                    UpdateExpression: 'SET user_id = :user_id, user_pw = :user_pw, #name = :name, tel = :tel, addr = :addr',
                    ExpressionAttributeNames: {
                        '#name': 'name' // 'name'은 예약어이므로 ExpressionAttributeNames로 지정
                    },
                    ExpressionAttributeValues: {
                        ':user_id': data.user_id,
                        ':user_pw': encryptedPassword,
                        ':name': data.name,
                        ':tel': data.tel,
                        ':addr': data.addr
                    },
                    ReturnValues: 'ALL_NEW'
                };

                dynamoDB.update(updateParams, (err, result) => {
                    if (err) {
                        console.error('Error updating DynamoDB:', err);
                        return res.status(400).send('Could not update user in DynamoDB');
                    }
                    return res.status(200).send('User updated successfully');
                });

            } catch (error) {
                console.error('Update error:', error);
                return res.status(500).send('Internal server error');
            }
        },

        async signUp(req, res) {
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
                const allData = await tableCol.find({company}).toArray();
                const maxContractNumObj = allData
                    .filter(item => item.contract_num && item.contract_num.startsWith(`${company}-`))
                    .reduce((max, item) => {
                        const num = parseInt(item.contract_num.split(`${company}-`)[1], 10);
                        return (num > parseInt(max.contract_num.split(`${company}-`)[1], 10)) ? item : max;
                    }, {contract_num: `${company}-0`});

                const maxContractNum = maxContractNumObj ? parseInt(maxContractNumObj.contract_num.split(`${company}-`)[1], 10) : 0;

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

                const mongoData = {
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
                    user_key: null,
                    member_key: null
                };

                const findData = await tableCol.find({id: data.user_id}).toArray();
                if (findData.length !== 0) {
                    console.log('Duplicate UserId');
                    return res.status(400).send('Duplicate UserId');
                }

                const insertResult = await tableCol.insertOne(mongoData);
                console.log(insertResult);

                const sendData = await tableCol.find({id: data.user_id}).toArray();

                try {
                    const awsResponse = await axios.post(AWS_LAMBDA_SIGNUP, saveAwsData);
                    console.log('success SignUp');
                    return res.status(200).json({
                        msg: 'Success Signup',
                        checkData: sendData[0],
                        awsResponse: awsResponse.data
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


        async signUpEmail(req, res) {
            let {company, user_id, email} = req.body;

            if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
                return res.status(400).send("'user_id' is a required field.");
            }

            if (!email || typeof email !== 'string' || email.trim() === '') {
                return res.status(400).send("'email' is a required field.");
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) return res.status(400).send("Invalid email format.");


            if (!company || typeof company !== 'string' || company.trim() === '') {
                return res.status(400).send("Invalid value for 'company'.");
            }


            // ✅ 첫 글자 대문자 + 나머지 소문자로 정규화
            company = company.charAt(0).toUpperCase() + company.slice(1).toLowerCase();


            try {
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');

                const findUser = await tablesCol.findOne({id: user_id});
                if (findUser) {
                    return res.status(400).send('Duplicate user_id');
                }

                const findEmail = await tablesCol.findOne({email});
                if (findEmail) {
                    return res.status(400).send('Duplicate email address');
                }

                const findEmails = await AuthNumDB.findOne({email});
                if (findEmails) {
                    return res.status(400).send('email requested for authentication');
                }

                const findUserIds = await AuthNumDB.findOne({user_id: user_id});
                if (findUserIds) {
                    return res.status(400).send('user_id requested for authentication');
                }

                const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

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
                    from: `${company}`,
                    to: email,
                    subject: `[${company}] 회원가입 인증번호 서비스 입니다.`,
                    text: `안녕하세요, 이메일 주소 인증을 완료하시려면 아래의 인증번호를 입력해주세요.\n인증번호: ${authNum}\n본 인증번호는 3분간 유효합니다.`
                };

                const sendMailPromise = () => {
                    return new Promise((resolve, reject) => {
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) return reject(error);
                            return resolve(info);
                        });
                    });
                };

                await sendMailPromise();

                await new AuthNumDB({
                    email,
                    user_id,
                    num: authNum,
                    expires: new Date(Date.now() + 3 * 60 * 1000)
                }).save();

                res.send('ok');
            } catch (error) {
                console.error('Error in sendEmail:', error);
                res.status(500).send('Internal Server Error');
            }
        },

        async findEmail(req, res) {
            let data = req.body;

            if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
                return res.status(400).send("'email' is a required field.");
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) return res.status(400).send("Invalid email format.");


            if (!data.company || typeof data.company !== 'string' || data.company.trim() === '') {
                return res.status(400).send("Invalid value for 'company'.");
            }


            // ✅ 첫 글자 대문자 + 나머지 소문자로 정규화
            data.company = data.company.charAt(0).toUpperCase() + data.company.slice(1).toLowerCase();

            const sendMailPromise = (transporter, mailOptions) => {
                return new Promise((resolve, reject) => {
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Email send error:", error);
                            return reject(error.message);
                        } else {
                            console.log("Email sent:", info.response);
                            return resolve(info.response);
                        }
                    });
                });
            };

            if (!["id", "pw"].includes(data.service)) {
                return res.status(400).send('Invalid service type');
            }

            try {
                const {collection: tablesCol} = await ConnectMongo(MONGO_URI, ADMIN_DB_NAME, 'tables');
                const query = data.service === "id"
                    ? {email: data.email}
                    : {id: data.user_id, email: data.email};

                const findData = await tablesCol.findOne(query);
                if (!findData) {
                    return res.status(404).send('Not Found Data');
                }

                const findAuth = await AuthNumDB.findOne({email: data.email});
                if (findAuth) {
                    return res.status(400).send('Email already requested for authentication');
                }

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

                const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");

                const mailOptions = {
                    from: `${data.company}`,
                    to: data.email,
                    subject: `[${data.company}] ${data.service === "id" ? "아이디" : "비밀번호"} 찾기 서비스 입니다.`,
                    text: `안녕하세요, 이메일 인증을 위해 아래의 인증번호를 입력해주세요.\n인증번호: ${authNum}\n해당 인증번호는 3분간 유효합니다.`
                };

                await sendMailPromise(transporter, mailOptions);

                await new AuthNumDB({
                    email: data.email,
                    user_id: data.service === "id" ? findData.id : data.user_id,
                    num: authNum,
                    expires: new Date(Date.now() + 3 * 60 * 1000)
                }).save();

                res.send('ok');

            } catch (error) {
                console.error("Error in sendFindServiceEmail:", error);
                res.status(500).send('Internal Server Error');
            }
        }

    }
}

module.exports = doorbell