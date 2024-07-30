const applyDotenv = dotenv => {
    dotenv.config()
    return {
        ORIGIN:process.env.ORIGIN,
        MONGO_URI:process.env.MONGO_URI,
        DB_NAME:process.env.DB_NAME,
        PORT:process.env.PORT,
        MESSAGE_NAME:process.env.MESSAGE_NAME,
        SOCKET_URL:process.env.SOCKET_URL,
        WS_URL:process.env.WS_URL,
        ADMIN_DB_NAME:process.env.ADMIN_DB_NAME,
        ADMIN_MONGO_URI:process.env.ADMIN_MONGO_URI,
        AWS_SECRET:process.env.AWS_SECRET,
        AWS_ACCESS:process.env.AWS_ACCESS,
        AWS_REGION:process.env.AWS_REGION,
        SMS_service_id:process.env.SMS_SERVICE_API_ID,
        SMS_secret_key:process.env.SMS_API_SECRET_KEY,
        SMS_access_key:process.env.SMS_API_ACCESS_KEY,
        SMS_PHONE:process.env.SMS_PHONE_NUM,
        NICE_CLIENT_ID:process.env.NICE_CLIENT_ID,
        NICE_CLIENT_SECRET:process.env.NICE_CLIENT_SECRET,
        NICE_PRODUCT_CODE:process.env.NICE_PRODUCT_CODE,
        NICE_ACCESS_TOKEN:process.env.NICE_ACCESS_TOKEN,
        AWS_BUCKET_NAME:process.env.AWS_BUCKET_NAME,
        DEV_DEVICE_ADMIN:process.env.DEV_DEVICE_ADMIN,
        DEV_APP_ADMIN:process.env.DEV_APP_ADMIN,
        DEV_SEVER_ADMIN:process.env.DEV_SEVER_ADMIN,
        DEV_CEO_ADMIN:process.env.DEV_CEO_ADMIN,
        AWS_DOORBELL_NAME:process.env.AWS_DOORBELL_NAME,
        DEV_FRONT_ADMIN:process.env.DEV_FRONT_ADMIN,
        AWS_LAMBDA_SIGNUP:process.env.AWS_LAMBDA_SIGNUP,
        AWS_CLOUD_FRONT:process.env.AWS_CLOUD_FRONT,
        AWS_TOKEN:process.env.AWS_TOKEN,
        NODEMAILER_USER:process.env.NODEMAILER_USER,
        NODEMAILER_PASS:process.env.NODEMAILER_PASS,
        NODEMAILER_SERVICE:process.env.NODEMAILER_SERVICE,
        NODEMAILER_HOST:process.env.NODEMAILER_HOST,
    }
}

module.exports = applyDotenv

