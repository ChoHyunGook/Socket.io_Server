const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const db = require("../../DataBase");


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION, AWS_BUCKET_NAME, DEV_DEVICE_ADMIN, DEV_APP_ADMIN,
    DEV_SEVER_ADMIN, DEV_CEO_ADMIN,DEV_FRONT_ADMIN,AWS_CLOUD_FRONT
} = applyDotenv(dotenv)

const Version = db.version

async function uploadFile(file, loginData, ip,Bucket_name) {
    const params = {
        Bucket: `${Bucket_name}/app/doorbellApk`,
        Key: file.originalname.trim(),
        Body: file.buffer
    };

    const upload = new AWS.S3.ManagedUpload({
        params: params,
        partSize: 20 * 1024 * 1024, // 10MB 단위로 분할 업로드
        queueSize: 5 // 동시에 업로드할 파트의 수
    });

    try {
        const data = await upload.promise();
        const cloudFrontUrl = `https://${AWS_CLOUD_FRONT}/${file.originalname.trim()}`;
        const date = moment().tz('Asia/Seoul');
        let versionData = {
            access_id: loginData.access_id,
            access_name: loginData.access_name,
            department: loginData.department,
            ip: ip,
            contents: `Upload.${file.originalname}`,
            date: date.format('YYYY-MM-DD HH:mm:ss')
        };

        // 버전 업데이트 히스토리 저장
        await new Version(versionData).save();
        console.log('Version Update History Save Success');

        return { cloudFrontUrl, versionData, params };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}
module.exports = uploadFile