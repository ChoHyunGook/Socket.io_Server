const history = function (mongoose){
    const historySchema = new mongoose.Schema({
        his:String
    },{ versionKey : false })
    return mongoose.model('history',historySchema)
}

module.exports = history