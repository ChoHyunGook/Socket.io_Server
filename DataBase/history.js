const history = function (mongoose){
    const historySchema = new mongoose.Schema({
        dev:{type:String,trim:true},
        ip_addr:{type:String,trim:true},
        memberNum:{type:String,trim:true},
        push_title:{type:String,trim:true},
        push_message:{type:String,trim:true},
        battery:{type:String,trim:true},
        file_name:{type:String,trim:true},
        file_size:{type:String,trim:true},
        date:{type:String,trim:true}
    },{ versionKey : false })
    return mongoose.model('history',historySchema)
}

module.exports = history