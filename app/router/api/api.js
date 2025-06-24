const express = require('express')
const app = express();
const Api = require('../../service/api/api')
const Management = require('../../service/api/management')
const multer = require('multer');
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
var storage = multer.memoryStorage()
var upload = multer({storage: storage});
const moment = require("moment-timezone");
const db = require("../../DataBase")
const semiDate = require("../../service/Data/date")
const AWSAPI = require("../AWS");


const {
    AWS_SECRET, AWS_ACCESS, AWS_REGION,AWS_DOORBELL_NAME
} = applyDotenv(dotenv)

const ClientId = AWS_SECRET
const ClientSecret = AWS_ACCESS
const Bucket_name = AWS_DOORBELL_NAME

const s3 = new AWS.S3({
    accessKeyId: ClientId,
    secretAccessKey: ClientSecret,
    region: AWS_REGION
});

const Log = db.logs


setInterval(()=>{
    s3.listObjects({Bucket:Bucket_name}).promise().then((list)=>{
        const listData = list.Contents
        const filterTime = moment().tz('Asia/Seoul')
        let beforeTime = filterTime.subtract(3,'d').format('YYYY-MM-DD kk:mm:ss')
        //let testTime = filterTime.subtract(1,'minutes').format('YYYY-MM-DD kk:mm:ss')
        listData.map(e=>{
            if(e.Key.split('/')[2] !== undefined){
                const splitData = new Date(e.LastModified)
                const year = splitData.getFullYear()
                let month = ('0' + (splitData.getMonth() +  1 )).slice(-2);
                let date = ('0' + splitData.getDate()).slice(-2);
                let hour = ('0' + splitData.getHours()).slice(-2);
                let minutes = ('0' + splitData.getMinutes()).slice(-2);
                let seconds = ('0' + splitData.getSeconds()).slice(-2);
                let checkTime = `${year}-${month}-${date} ${hour}:${minutes}:${seconds}`
                //console.log(moment(checkTime).isBefore(testTime))
                if(moment(checkTime).isBefore(beforeTime) === true){
                    const params = {
                        Bucket:Bucket_name,
                        Key:e.Key
                    }
                    s3.deleteObject(params,function (err,delPoint){
                        if(err){
                            console.log(err)
                        }else{
                            let saveData = {
                                log:`Automatically delete video files 3 days ago:${Bucket_name}:${e.Key}:VideoSaveTime_${checkTime}:StandardTime_${beforeTime}`,
                                date:semiDate.logDate()
                            }
                            new Log(saveData).save()
                                .then(r=>console.log(saveData.log))
                                .catch(err=>console.log(err))
                        }
                    })
                }
            }
        })
    })
},1000*60*60*24)





app.get('/get/personal/policy',async (req, res) => {
    // ✅ HTML 내용
    const htmlContent = `<!DOCTYPE html><html lang="en" class=""><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:0;padding:20px;background-color:#f4f4f4}.container{max-width:800px;margin:auto;padding:20px;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}h1,h2,h3{color:#333}h1{text-align:center}p{margin:10px 0}</style></head><body><div class="container"><h1>Terms of Service</h1><p><em>Last updated: May 08, 2025</em></p><p>Welcome to Eagle Safes</p><p>These terms of service ("Terms", "Agreement") are an agreement between Eagle Safes ("Eagle Safes", "we", "us" or "our") and you ("User", "you" or "your"). This Agreement sets forth the general terms and conditions of your use of the Eagle Safes mobile application and any of its products or services (collectively, "Mobile Application" or "Services").</p><h2>1. Accounts and Membership</h2><h3>1.1.</h3><p>You must be at least 13 years old to use this Mobile Application. By using this Mobile Application and by agreeing to this Agreement, you warrant and represent that you are at least 13 years of age.</p><h3>1.2.</h3><p>If you create an account in the Mobile Application, you are responsible for maintaining the security of your account and you are fully responsible for all activities that occur under the account and any other actions taken in connection with it. We may, but have no obligation to, monitor and review new accounts before you may sign in and use our Services.</p><h3>1.3.</h3><p>Providing false contact information of any kind may result in the termination of your account. You must immediately notify us of any unauthorized uses of your account or any other breaches of security. We will not be liable for any acts or omissions by you, including any damages of any kind incurred as a result of such acts or omissions.</p><h2>2. User Content</h2><h3>2.1.</h3><p>We do not own any data, information, or material (collectively, "Content") that you submit in the Mobile Application in the course of using the Service. You shall have sole responsibility for the accuracy, quality, integrity, legality, reliability, appropriateness, and intellectual property ownership or right to use of all submitted Content.</p><h3>2.2.</h3><p>We may, but have no obligation to, monitor and review Content in the Mobile Application submitted or created using our Services by you. Unless specifically permitted by you, your use of the Mobile Application does not grant us the license to use, reproduce, adapt, modify, publish, or distribute the Content created by you or stored in your user account for commercial, marketing, or any similar purpose.</p><h3>2.3.</h3><p>You grant us permission to access, copy, distribute, store, transmit, reformat, display, and perform the Content of your user account solely as required for the purpose of providing the Services to you.</p><h2>3. Prohibited Uses</h2><h3>3.1.</h3><p>In addition to other terms as set forth in the Agreement, you are prohibited from using the Mobile Application or its Content:</p><ul><li>(a) for any unlawful purpose;</li><li>(b) to solicit others to perform or participate in any unlawful acts;</li><li>(c) to violate any international, federal, provincial or state regulations, rules, laws, or local ordinances;</li><li>(d) to infringe upon or violate our intellectual property rights or the intellectual property rights of others;</li><li>(e) to harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability;</li><li>(f) to submit false or misleading information;</li><li>(g) to upload or transmit viruses or any other type of malicious code that will or may be used in any way that will affect the functionality or operation of the Service or of any related mobile application, other mobile applications, or the Internet;</li><li>(h) to collect or track the personal information of others;</li><li>(i) to spam, phish, pharm, pretext, spider, crawl, or scrape;</li><li>(j) for any obscene or immoral purpose; or</li><li>(k) to interfere with or circumvent the security features of the Service or any related mobile application, other mobile applications, or the Internet.</li></ul><h3>3.2.</h3><p>We reserve the right to terminate your use of the Service or any related mobile application for violating any of the prohibited uses.</p><h2>4. Intellectual Property Rights</h2><h3>4.1.</h3><p>This Agreement does not transfer to you any intellectual property owned by Eagle Safes or third parties, and all rights, titles, and interests in and to such property will remain (as between the parties) solely with Eagle Safes.</p><h3>4.2.</h3><p>All trademarks, service marks, graphics and logos used in connection with our Mobile Application or Services, are trademarks or registered trademarks of Eagle Safes or Eagle Safes licensors.</p><h2>5. Limitation of Liability</h2><h3>5.1.</h3><p>To the fullest extent permitted by applicable law, in no event will Eagle Safes its affiliates, officers, directors, employees, agents, suppliers, or licensors be liable to any person for:</p><ul><li>(a) any indirect, incidental, special, punitive, cover or consequential damages (including, without limitation, damages for lost profits, revenue, sales, goodwill, use of content, impact on business, business interruption, loss of anticipated savings, loss of business opportunity) however caused, under any theory of liability, including, without limitation, contract, tort, warranty, breach of statutory duty, negligence or otherwise, even if Eagle Safes has been advised as to the possibility of such damages or could have foreseen such damages.</li></ul><h2>6. Changes and Amendments</h2><h3>6.1.</h3><p>We reserve the right to modify this Agreement or its policies relating to the Mobile Application or Services at any time, effective upon posting of an updated version of this Agreement in the Mobile Application. When we do, we will post a notification in the Mobile Application. Continued use of the Mobile Application after any such changes shall constitute your consent to such changes.</p><h2>7. Acceptance of These Terms</h2><h3>7.1.</h3><p>You acknowledge that you have read this Agreement and agree to all its terms and conditions. By using the Mobile Application or its Services you agree to be bound by this Agreement. If you do not agree to abide by the terms of this Agreement, you are not authorized to use or access the Mobile Application and its Services.</p><h2>8. Contacting Us</h2><h3>8.1.</h3><p>If you have any questions about this Agreement, please contact us at [Contact Information].</p></div>

 



 

<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy for Eagle Safes</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:0;padding:20px;background-color:#f4f4f4}.container{max-width:800px;margin:auto;padding:20px;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}h1,h2,h3{color:#333}h1{text-align:center}p{margin:10px 0}</style><div class="container"><h1>Private Usage Agreement</h1><p>
    This Privacy Policy applies to the mobile application <strong>"Eagle Safes"</strong>,
    developed and operated by <strong>(주)블라우비트</strong>.
    We are committed to protecting your privacy.
  </p>
<h2>1. Overview</h2><p>This Privacy Policy (the "Policy") is designed to inform you about how (Company Name) ("we," "us," or "our") collects, uses, and discloses your personal information when you use our services (the "Services"). We take your privacy very seriously and are committed to protecting your personal information. This Policy explains how we do that.</p><h2>2. Collection and Use of Personal Information</h2><h3>2.1 Personal Information We Collect</h3><p>We collect the following personal information from you when you use our Services:</p><p><strong>Required Personal Information:</strong></p><ul><li>Name</li><li>Email address</li><li>Phone number</li><li>Login information (ID, password)</li></ul><p><strong>Optional Personal Information:</strong></p><ul><li>Date of birth</li><li>Gender</li><li>Address</li><li>Profile picture</li><li>Service usage history</li><li>Cookies and device information</li></ul><h3>2.2 Purposes of Using Personal Information</h3><p>We use the personal information we collect for the following purposes:</p><p><strong>Providing the Services:</strong></p><ul><li>Registering and managing your account</li><li>Verifying your service usage</li><li>Responding to your inquiries</li><li>Improving and developing our Services</li></ul><p><strong>Marketing:</strong></p><ul><li>Providing you with personalized advertisements and event information</li><li>Analyzing service usage and generating statistics</li></ul><p><strong>Other:</strong></p><ul><li>Complying with laws</li><li>Resolving disputes</li></ul><h3>2.3 Retention Period</h3><p>We retain your personal information for the following periods:</p><p><strong>Required Personal Information:</strong></p><ul><li>For as long as you use our Services</li><li>For any period required by law</li></ul><p><strong>Optional Personal Information:</strong></p><ul><li>Until you withdraw your consent or terminate your use of the Services</li></ul><h2>3. Sharing and Disclosure of Personal Information</h2><p>We do not share or disclose your personal information with third parties without your consent. However, we may share your personal information in the following limited circumstances:</p><ul><li>When required by law</li><li>When you have given us your express consent</li><li>In connection with a corporate reorganization, such as a merger, acquisition, or sale of assets</li><li>When we share your personal information in an aggregated and anonymized manner, so that it does not identify you</li></ul><h2>4. Data Security</h2><p>We use the following technical and administrative safeguards to protect your personal information:</p><p><strong>Technical Safeguards:</strong></p><ul><li>Encryption</li><li>Access controls</li><li>Firewalls</li><li>Regular security audits and vulnerability assessments</li></ul><p><strong>Administrative Safeguards:</strong></p><ul><li>Training and education for employees on personal information handling</li><li>Supervision and management of personal information processing activities</li><li>Policies and procedures for personal information handling</li></ul><h2>5. Your Rights</h2><p>You have the following rights with respect to your personal information:</p><p><strong>Access and Correction:</strong></p><ul><li>You have the right to access your personal information and to have it corrected if it is inaccurate.</li></ul><p><strong>Restriction and Deletion:</strong></p><ul><li>You have the right to restrict or delete your personal information.</li></ul><p><strong>Data Portability:</strong></p><ul><li>You have the right to receive your personal information in a structured, commonly used, and machine-readable format and to have it transferred to another controller.</li></ul><p><strong>Withdrawal of Consent:</strong></p><ul><li>You have the right to withdraw your consent to the processing of your personal information at any time.</li></ul><h2>6. Changes to this Policy</h2><p>We may change this Policy from time to time to reflect changes in the law, our Services, or our practices. We will notify you of any material changes by posting the revised Policy on our Services or by sending you an email notification.</p><h2>7. Contact Us</h2><p>If you have any questions about this Policy or your personal information, please contact us at:</p><p>bjkim@blauhealthcare.com</p></div>

 </body></html>`;

    // ✅ HTML 콘텐츠 전송
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);

})
app.get('/get/picture', upload.single('file'),(req,res)=>{
    AWSAPI.getPicture(req,res);
})
app.post('/upload/picture', upload.single('file'),(req,res)=>{
    AWSAPI.uploadPicture(req,res);
})
app.delete('/delete/picture', upload.single('file'),(req,res)=>{
    AWSAPI.deletePicture(req,res);
})


app.post('/get/aws/table',(req,res)=>{
    Api().awsFindData(req,res)
})

app.get('/update/admin',(req,res)=>{
    Api().readDoorbell(req,res)
})


app.get('/findLog',(req,res)=>{
    Api().findLog(req,res)
})

app.post('/faceRegister',(req,res)=>{
    Api().face_register(req,res)
})

app.post('/sendSms',(req,res)=>{
    Api().sendSms(req,res)
})

app.get('/awslog',(req,res)=>{
    Api().getAwsLogHistory(req,res)
})
app.post('/AWSlogs',(req,res)=>{
    Api().getAWSLogs(req,res)
})
app.post('/getHistory',(req,res)=>{
    Api().getHistory(req,res)
})

app.post('/startUpInfo',(req,res)=>{
    Api().start_up(req,res)
})

app.post('/niceApi',(req,res)=>{
    Api().niceApi(req,res)
})

app.post('/send/email',(req,res)=>{
    Api().sendEmail(req,res)
})

app.post('/send/findService/email',(req,res)=>{
    Api().sendFindServiceEmail(req,res)
})
app.post('/check/findService/auth',(req,res)=>{
    Api().checkFindAuth(req,res)
})

app.post('/check/auth',(req,res)=>{
    Api().checkAuthNum(req,res)
})

app.get('/find/deviceInfo',(req,res)=>{
    Api().findDeviceInfo(req,res)
})

app.get('/', (req,res)=>{
    Api().getService(req,res)
})

app.get('/date',(req,res)=>{
    Api().userKeyTest(req,res)
})

app.post('/find/user',(req,res)=>{
    Api().findOverseasUser(req,res)
})
app.post('/update/pw',(req,res)=>{
    Api().updateOverseasUser(req,res)
})

app.post('/delete/history',(req,res)=>{
    Api().deleteHistory(req,res)
})

app.get('/check/pairing',(req,res)=>{
    Api().checkPairing(req,res)
})

app.post('/add/deviceId',(req,res)=>{
    Api().addDeviceId(req,res)
})
app.post('/signOut',(req,res)=>{
    Api().signOut(req,res)
})
app.post('/record',(req,res)=>{
    Api().record(req,res)
})
app.post('/force/del/deviceId',(req,res)=>{
    Api().allDeleteDevices(req,res)
})
app.get('/del/all/record',(req,res)=>{
    Api().allDeleteRecord(req,res)
})
app.post('/delete/deviceId',(req,res)=>{
    Api().renewalDeleteDeviceId(req,res)
})
app.post('/del/target/deviceId',(req,res)=>{
    Api().deleteTarget(req,res)
})
app.post('/check/deviceId',(req,res)=>{
    Api().checkDeivceId(req,res)
})
app.post('/signup/overseas',(req,res)=>{
    Api().overseasSignup(req,res)
})
app.get('/find/overseas',(req,res)=>{
    Api().findAWS(req,res)
})
app.post('/find/test',(req,res)=>{
    Api().testToken(req,res)
})
app.post('/save/userKey',(req,res)=>{
    Api().saveUserKey(req,res)
})
app.post('/save/deviceId',(req,res)=>{
    Api().saveDeivceId(req,res)
})
app.post('/update/deviceInfo',(req,res)=>{
    Api().saveDeviceInfo(req,res)
})



app.get('/deviceVersion/download',(req,res,next)=>{
    Management().deviceVersionDownload(req,res)
})
app.get('/blaubit/doorbellsquare/apk/download',(req,res)=>{
    Management().apkDownload(req,res)
})
app.get('/version/dev/file/Management',(req,res)=>{
    Management().fileManagement(req,res)
})
app.post('/uploadS3File', upload.single('file'), function (req,res){
    Management().deviceS3Upload(req,res)
});
app.post('/department/version/download',(req,res)=>{
    Management().departVersionDownload(req,res)
})
app.post('/department/version/delete/file',(req,res)=>{
    Management().departmentVersionDelete(req,res)
})
app.post('/management/history/log',(req,res)=>{
    Management().versionLogFind(req,res)
})
app.post('/management/documents/file/download',(req,res)=>{
    Management().documentsDownload(req,res)
})
app.post('/history/logs/deleted',(req,res)=>{
    Management().deleteLog(req,res)
})
app.post('/history/search/table',(req,res)=>{
    Management().searchTable(req,res)
})






module.exports = app