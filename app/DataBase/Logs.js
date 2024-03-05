const Log = function (mongoose){
    const logSchema = new mongoose.Schema({
        log: {type:String, expires:15552000},//6달(180일)
        date:{type:String}
    },{ versionKey : false })
    return mongoose.model('logs',logSchema)
}

module.exports = Log