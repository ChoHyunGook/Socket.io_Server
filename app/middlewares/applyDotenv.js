const applyDotenv = dotenv => {
    dotenv.config()
    return {
        MONGO_URI:process.env.MONGO_URI,
        PORT:process.env.PORT,
        SOCKET_DB_NAME:process.env.SOCKET_DB_NAME,
        ADMIN_DB_NAME:process.env.ADMIN_DB_NAME,
        GROUP_DB_NAME:process.env.GROUP_DB_NAME,
        AWS_ACCESS:process.env.AWS_ACCESS,
        AWS_SECRET:process.env.AWS_SECRET,
        AWS_REGION:process.env.AWS_REGION,
        AWS_BUCKET_NAME:process.env.AWS_BUCKET_NAME,
        AWS_TOKEN:process.env.AWS_TOKEN,
        NODEMAILER_USER:process.env.NODEMAILER_USER,
        NODEMAILER_PASS:process.env.NODEMAILER_PASS,
        NODEMAILER_SERVICE:process.env.NODEMAILER_SERVICE,
        NODEMAILER_HOST:process.env.NODEMAILER_HOST
    }
}

module.exports = applyDotenv

