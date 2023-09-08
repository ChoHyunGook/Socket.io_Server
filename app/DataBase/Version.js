const version = function (mongoose){
    const versionSchema = new mongoose.Schema({
        access_id:{type:String, trim:true},
        access_name:{type:String, trim: true},
        department:{type:String,trim:true},
        contents:{type:String,trim:true},
        date:{type:String,trim:true}
    },{ versionKey : false })
    return mongoose.model('version',versionSchema)
}

module.exports = version