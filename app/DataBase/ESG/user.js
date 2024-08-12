

//회원테이블
const User = function (mongoose){
    const UserSchema = new mongoose.Schema({
        company:{type:String,required:true},
        id:{type:String,required:true},
        name:{type:String,required:true},
        tel:{type:String,required:true},
        password:{type:String,required:true},
        admin:{type:Boolean,required:true},
    },{ versionKey : false })
    return mongoose.model('User',UserSchema)
}

module.exports = User

//자료테이블
const Data = function (mongoose){
    const DataSchema = new mongoose.Schema({
        name:{type:String,required:true},
        universal:{type:String,required:true},
        data:{type:Object,required:true},
        date:{type:Date,required:true},
    },{ versionKey : false })
    return mongoose.model('Data',DataSchema)
}

module.exports = Data
//평가테이블
const Evaluation = function (mongoose){
    const EvaluationSchema = new mongoose.Schema({
        id:{type:String,required:true},
        company:{type:String,required:true},
        indexNum:{type:Number,required:true},
        question:{type:String,required:true},
        answer:{type:String,required:true},
        date:{type:Date,required:true},
    },{ versionKey : false })
    return mongoose.model('Evaluation',EvaluationSchema)
}

module.exports = Evaluation
//경영평가테이블
const ManagementEvaluation = function (mongoose){
    const ManagementEvaluationSchema = new mongoose.Schema({
        id:{type:String,required:true},
        name:{type:String,required:true},
        types:{type:String},
        data:{type:Object,required:true},
    },{ versionKey : false })
    return mongoose.model('ManagementEvaluation',ManagementEvaluationSchema)
}

module.exports = ManagementEvaluation

const ManagementEvaluation = function (mongoose){
    const ManagementEvaluationSchema = new mongoose.Schema({
        id:{type:String,required:true},
        name:{type:String,required:true},
        types:{type:String},
        data:{type:Object,required:true},
    },{ versionKey : false })
    return mongoose.model('ManagementEvaluation',ManagementEvaluationSchema)
}

module.exports = ManagementEvaluation

//교육프로그램
const EducationalEvaluation = function (mongoose){
    const EducationalEvaluationSchema = new mongoose.Schema({
        date:{type:Date,required:true},
        kind:{type:String,required:true},
        Application:{type:[{
                id:String,
                name:String,
                tel:String,
                approve:Boolean
            }]},
    },{ versionKey : false })
    return mongoose.model('EducationalEvaluation',EducationalEvaluationSchema)
}

module.exports = EducationalEvaluation



