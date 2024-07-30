


const AuthNum = function (mongoose){
    const AuthNumSchema = new mongoose.Schema({
        email:{type:String},
        user_id:{type:String},
        num:{type:String},
        expires:{type:Date},
    },{ versionKey : false })
    AuthNumSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
    return mongoose.model('AuthNum',AuthNumSchema)
}

module.exports = AuthNum