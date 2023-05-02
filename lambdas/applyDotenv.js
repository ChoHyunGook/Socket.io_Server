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
        admin_db_name:process.env.admin_db_name
    }
}

module.exports = applyDotenv

