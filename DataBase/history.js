const history = function (mongoose){
    const historySchema = new mongoose.Schema({
        title:{type:String, trim:true},
        body:{type:String, trim:true},
        token:{type:String, trim:true},
        date:{type:String, trim:true},
        createAt:{type:Date, index:{expires:10}},
        expiresAt:{type:Date}
    },{ versionKey : false })
    return mongoose.model('history',historySchema)
}

module.exports = history