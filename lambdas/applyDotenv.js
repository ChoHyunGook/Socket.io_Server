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
        AWS_REGION:process.env.AWS_REGION
    }
}

module.exports = applyDotenv

