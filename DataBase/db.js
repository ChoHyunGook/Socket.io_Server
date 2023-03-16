const logs = function (mongoose){
    const logSchema = new mongoose.Schema({
        log: {type:String, expires:15552000}//6달(180일)
    },{ versionKey : false })
    return mongoose.model('Logs',logSchema)
}

module.exports = logs