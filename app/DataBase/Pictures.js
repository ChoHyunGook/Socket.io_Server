const Pictures = function (mongoose){
    const picturesSchema = new mongoose.Schema({
        file_name:{type:String},
        aws_url:{type:String},
        aws_key:{type:String},
        created_at:{type:Date},
    },{ versionKey : false })
    return mongoose.model('pictures',picturesSchema)
}

module.exports = Pictures