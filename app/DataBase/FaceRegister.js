
const FaceRegister = function (mongoose){
    const FaceRegisterSchema = new mongoose.Schema({
        device_id:{type:String, trim:true, required:true},
        name:{type:String, trim:true, required:true, unique:true},
        phone:{type:String, trim:true, required:true},
        index:{type:Number, trim:true, required:true},
        date:{type:String, trim:true, required:true}
    },{ versionKey : false })
    return mongoose.model('face_register',FaceRegisterSchema)
}

module.exports = FaceRegister