const express =require('express')
const app = express();
const Groups = require('../../service/Groups');
const xlsx = require('xlsx');
const path = require('path');
const {ConnectMongo} = require("../../service/ConnectMongo");

 // "pt_id": 0,
 //  "protocol": "K0xAL-GMP",
 //  "title": "[{}] 기기 권한 변경",
 //  "message": "알림: [{}] 그룹의 기기 권한이 변경되었습니다.",
 //  "bypass": false

// "pt_id": 1,
//   "protocol": "K0xAL-GMR",
//   "title": "[{}] 그룹 초기화",
//   "message": "알림: 그룹 [{}]이 초기화되어 더 이상 소속되어 있지 않습니다.",
//   "bypass": false

// "pt_id": 2,
//   "protocol": "K0xAL-GMD",
//   "title": "[{}] 그룹 연결 해제",
//   "message": "알림: [{}] 그룹에서 연결이 해제되었습니다. 더 이상 알림을 받지 않습니다.",
//   "bypass": false

// "pt_id": 3,
//   "protocol": "K0xAL-GUL",
//   "title": "[{}] 그룹원 [{}] 탈퇴",
//   "message": "알림: 그룹 [{}]에서 그룹원[{}]{이/가}  탈퇴하였습니다. ",
//   "bypass": false

// app.get('/bulk/fcm', async (req, res) => {
//     const {collection: groupsCol} = await ConnectMongo("mongodb+srv://serverManager:7r4Hi9PNoHlRVh3E@blaubitcluster.h7wua3o.mongodb.net/",
//         "Groups",
//         'fcmprotocols');
//     try {
//         const workbook = xlsx.readFile(path.join(__dirname, 'protocol.xlsx'));
//         const sheet = workbook.Sheets[workbook.SheetNames[0]];
//         const rows = xlsx.utils.sheet_to_json(sheet);
//
//         const docs = rows.map(row => ({
//             pt_id: Number(row.pt_id),
//             protocol: row.protocol,
//             title: row.title,
//             message: row.message,
//             bypass: row.bypass === 'true' || row.bypass === true,
//             created_at: new Date(),
//             updated_at: new Date()
//         }));
//
//         await groupsCol.insertMany(docs,{ordered:false});
//         res.status(200).json({ message: 'Bulk insert successful', insertedCount: docs.length });
//
//     }catch(err) {
//         console.log(err);
//         res.status(500).json({ message: 'Bulk insert failed', error: err.message });
//     }
// })


app.get('/alarms/info', (req, res) => {
    Groups().getAlarms(req,res)
})

app.patch('/alarms/master/privacy',(req,res)=>{
    Groups().patchMasterPrivacy(req,res)
})

app.get('/latest_device_id', (req,res)=>{
    Groups().latestDeviceId(req,res)
})

app.patch('/latest_device_id',(req,res)=>{
    Groups().patchLatestDeviceId(req,res)
})

// /group/protocol
app.post('/protocol',(req,res)=>{
    Groups().checkFcm(req,res)
})

//http://socket.doorbellsquare.com:8080


module.exports = app;