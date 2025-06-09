// readDoorbell(req, res) {
//     let adminClient;  // 👉 Admin DB Client
//     let sunilClient;  // 👉 Sunil DB Client
//
//     const adminDb = ConnectMongo(MONGO_URI,ADMIN_DB_NAME,"tables").find().toArray()
//
//     Client.connect(MONGO_URI)
//         .then(client => {
//             adminClient = client;  // 👉 저장
//             const adminDb = client.db(ADMIN_DB_NAME).collection("tables");
//
//             return adminDb.find().toArray()
//                 .then(findAdmin => {
//                     // company가 "Sunil"인 데이터만 필터링
//                     const filteredAdmins = findAdmin.filter(admin => admin.company === "Sunil");
//
//                     // ✅ 첫 번째 DB 연결 종료 (여기서 닫아야 함)
//                     console.log("✅ Admin DB connection closed.");
//                     adminClient.close();
//
//                     return Client.connect(SUNIL_MONGO_URI)
//                         .then(client => {
//                             sunilClient = client;  // 👉 저장
//                             const sunilDb = client.db("Sunil-Doorbell").collection("users");
//
//                             return sunilDb.find().toArray()
//                                 .then(findSunil => {
//                                     const sunilIds = findSunil.map(user => user.id);
//
//                                     const filteredAdminsWithoutSunilIds = filteredAdmins.filter(admin => !sunilIds.includes(admin.id));
//
//                                     let saveData = [];
//                                     const saveTime = moment().tz('Asia/Seoul');
//
//                                     filteredAdminsWithoutSunilIds.map(item => {
//                                         const pushData = {
//                                             overseas: true,
//                                             id: item.id,
//                                             addr: {
//                                                 location: {},
//                                                 address: "overseas",
//                                                 road_address: "overseas",
//                                                 zone_code: "overseas",
//                                                 detail: "overseas",
//                                                 full_address: "overseas"
//                                             },
//                                             email: item.email,
//                                             name: item.name,
//                                             open: "O",
//                                             serviceDate: saveTime.format('YYYY-MM-DD kk:mm:ss'),
//                                             items: item.device_id !== undefined ? [
//                                                 {
//                                                     classification: "overseas",
//                                                     name: "overseas",
//                                                     koType: {
//                                                         category: "overseas",
//                                                         detail: "overseas",
//                                                         name: "overseas"
//                                                     },
//                                                     serial: "overseas",
//                                                     device_id: item.device_id,
//                                                     price: "overseas",
//                                                     orderNum: "overseas",
//                                                     orderDate: "overseas",
//                                                     saleNote: "overseas",
//                                                     discountType: "overseas",
//                                                     discountPrice: "overseas"
//                                                 }
//                                             ] : [],
//                                             discount: {
//                                                 point: 0,
//                                                 coupon: []
//                                             },
//                                             bookmark: [],
//                                             user_key: item.user_key !== undefined ? item.user_key : null,
//                                         };
//                                         saveData.push(pushData);
//                                     });
//
//                                     if (saveData.length > 0) {
//                                         return sunilDb.insertMany(saveData)
//                                             .then(result => {
//                                                 console.log(`${result.insertedCount} documents were inserted.`);
//                                                 res.status(200).json(result);
//                                             })
//                                             .finally(() => {
//                                                 // ✅ 두 번째 DB 연결 종료
//                                                 console.log("✅ Sunil DB connection closed.");
//                                                 sunilClient.close();
//                                             });
//                                     } else {
//                                         // ✅ 두 번째 DB 연결 종료
//                                         console.log("✅ Sunil DB connection closed.");
//                                         sunilClient.close();
//                                         console.log("No data to save.");
//                                     }
//                                     console.log(saveData);
//                                 });
//                         });
//                 });
//         })
//         .catch(error => {
//             console.error('Error connecting to MongoDB:', error);
//             res.status(500).json({ error: 'Database connection error' });
//             if (adminClient) adminClient.close();
//             if (sunilClient) sunilClient.close();
//         });
// },

// checkDeivceId(req,res){
//   const data = req.body
//     Client.connect(MONGO_URI)
//         .then(tableFind=>{
//             tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
//                 .then(contracts=>{
//                     // 각 계약의 device_id 필드에서 MAC 주소를 확인
//                     const exists = contracts.some(contract => {
//                         // device_id가 null일 경우 빈 배열로 처리
//                         const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
//                         return deviceIds.includes(data.device_id.toLowerCase());
//                     });
//                     res.status(200).send(exists)
//                     tableFind.close()
//                 })
//         })
// },


// allDeleteDevices(req,res){
//     const data = req.body
//     const lowerDeviceId = data.device_id.toLowerCase()
//
//     Client.connect(MONGO_URI)
//         .then(async tableFind => {
//             try {
//                 const result = {
//                     Mongo: { admin: "", history: "" },
//                     Dynamo: { Device_Table: "", Record_Table: "" },
//                     S3: ""
//                 };
//
//                 // MongoDB에서 device_id로 문서 찾기
//                 const findKey = await tableFind.db(ADMIN_DB_NAME).collection("tables")
//                     .findOne({ device_id: { $regex: lowerDeviceId, $options: 'i' } });
//
//                 if (!findKey) {
//                     result.Mongo.admin = "삭제할 데이터 없음"; // MongoDB에서 삭제할 데이터 없음
//                 } else {
//                     // MongoDB 데이터 업데이트
//                     const deviceIds = findKey.device_id ? findKey.device_id.split(',') : [];
//                     const updatedDeviceIds = deviceIds.filter(id => id.trim() !== lowerDeviceId);
//                     const newDeviceId = updatedDeviceIds.length > 0 ? updatedDeviceIds.join(',') : null;
//
//                     // 업데이트 수행
//                     await tableFind.db(ADMIN_DB_NAME).collection("tables").updateOne(
//                         { _id: findKey._id },
//                         { $set: { device_id: newDeviceId } }
//                     );
//
//                     result.Mongo.admin = "삭제 성공"; // MongoDB 데이터 삭제 성공
//                 }
//
//                 // History에서 기록 삭제
//                 const historyResult = await History.deleteMany({ device_id: lowerDeviceId });
//                 result.Mongo.history = historyResult.deletedCount > 0 ? "삭제 성공" : "삭제할 데이터 없음"; // History 삭제 결과
//
//                 // DEVICE_TABLE에서 user_key 가져오기
//                 const deviceKeyResult = await dynamoDB.query({
//                     TableName: "DEVICE_TABLE",
//                     KeyConditionExpression: "device_id = :device_id",
//                     ExpressionAttributeValues: {
//                         ":device_id": lowerDeviceId
//                     }
//                 }).promise();
//
//                 if (deviceKeyResult.Items && deviceKeyResult.Items.length > 0) {
//                     const user_key = deviceKeyResult.Items[0].user_key; // 첫 번째 문서에서 user_key 가져오기
//
//                     // DEVICE_TABLE에서 데이터 삭제
//                     const deviceDeleteParams = {
//                         TableName: "DEVICE_TABLE",
//                         Key: {
//                             "device_id": lowerDeviceId,
//                             "user_key": user_key
//                         }
//                     };
//
//                     await dynamoDB.delete(deviceDeleteParams).promise();
//                     result.Dynamo.Device_Table = "삭제 성공"; // 삭제 성공
//                 } else {
//                     result.Dynamo.Device_Table = "삭제할 데이터 없음"; // DEVICE_TABLE에서 삭제할 데이터 없음
//                 }
//
//                 // RECORD_TABLE에서 데이터 삭제
//                 const recordDeleteResult = await deleteFromRecordTable(lowerDeviceId);
//                 result.Dynamo.Record_Table = recordDeleteResult ? "삭제 성공" : "삭제할 데이터 없음";
//
//                 // S3에서 객체 삭제
//                 const s3DeleteResult = await deleteFromS3(lowerDeviceId);
//                 result.S3 = s3DeleteResult ? "삭제 성공" : "삭제할 데이터 없음";
//
//                 // 최종 응답
//                 res.status(200).json(result);
//             } catch (error) {
//                 console.error('Error during deletion process:', error);
//                 res.status(500).json({ error: 'Internal Server Error' });
//             } finally {
//                 tableFind.close();
//             }
//         })
//         .catch(error => {
//             console.error('Error connecting to MongoDB:', error);
//             res.status(500).json({ error: 'Internal Server Error' });
//         });
//
//     // RECORD_TABLE에서 데이터 삭제 함수
//     async function deleteFromRecordTable(lowerDeviceId) {
//         const queryParams = {
//             TableName: "RECORD_TABLE",
//             KeyConditionExpression: "device_id = :device_id",
//             ExpressionAttributeValues: {
//                 ":device_id": lowerDeviceId
//             }
//         };
//
//         try {
//             const result = await dynamoDB.query(queryParams).promise();
//             if (result.Items && result.Items.length > 0) {
//                 for (const record of result.Items) {
//                     const deleteParams = {
//                         TableName: "RECORD_TABLE",
//                         Key: {
//                             "device_id": record.device_id,
//                             "file_location": record.file_location
//                         }
//                     };
//                     await dynamoDB.delete(deleteParams).promise();
//                     console.log(`Deleted item from RECORD_TABLE with device_id: ${lowerDeviceId}, file_location: ${record.file_location}`);
//                 }
//                 return true; // 삭제 성공
//             } else {
//                 console.log(`No items found in RECORD_TABLE for device_id: ${lowerDeviceId}`);
//                 return false; // 삭제할 데이터 없음
//             }
//         } catch (error) {
//             console.error(`Failed to delete items from RECORD_TABLE:`, error);
//             return false; // 삭제 실패
//         }
//     }
//
//     // S3에서 객체 삭제 함수
//     async function deleteFromS3(lowerDeviceId) {
//         const s3 = new AWS.S3();
//         const bucketName = "doorbell-video"
//         const directoryKey = lowerDeviceId.replace(/:/g, '_')+"/";
//         console.log(directoryKey);
//
//         // 디렉토리 내 객체 목록 가져오기
//         const listParams = {
//             Bucket: bucketName,
//             Prefix: directoryKey // 삭제할 디렉토리의 Prefix
//         };
//
//         try {
//             const listData = await s3.listObjectsV2(listParams).promise();
//
//             // 삭제할 객체가 있는지 확인
//             if (listData.Contents.length === 0) {
//                 console.log(`No objects found in directory: ${directoryKey}`);
//                 return; // 삭제할 객체가 없음
//             }
//
//             // 객체 삭제
//             const deleteParams = {
//                 Bucket: bucketName,
//                 Delete: {
//                     Objects: listData.Contents.map(obj => ({ Key: obj.Key }))
//                 }
//             };
//
//             await s3.deleteObjects(deleteParams).promise();
//             console.log(`Deleted all objects in directory: ${directoryKey}`);
//
//         } catch (error) {
//             console.error(`Failed to delete objects from S3:`, error);
//         }
//     }
// },


// deleteTarget: async (req, res) => {
//     const data = req.body
//     const DEVICE_TABLE = 'DEVICE_TABLE'; // 실제 테이블 이름으로 변경
//     const RECORD_TABLE = 'RECORD_TABLE'; // 실제 테이블 이름으로 변경
//     const USER_TABLE = 'USER_TABLE'; // 사용자 정보 테이블 이름
//     const BUCKET_NAME = 'doorbell-video'; // S3 버킷 이름
//     // 메시지 저장
//     const responseMsg = {
//         DEVICE_TABLE: {},
//         RECORD_TABLE: {},
//         USER_TABLE: {},
//         S3: {},
//         MongoAdmin:{},
//         MongoHistory:{}
//     };
//     const lowerDeviceId = data.device_id.toLowerCase();
//     const client = await Client.connect(MONGO_URI);
//     const collection = client.db(ADMIN_DB_NAME).collection("tables");
//     const findUsers = await collection.findOne({ user_key: data.user_key });
//     responseMsg.MongoHistory.complete = findUsers.device_id
//     let updatedDeviceIds = findUsers.device_id !== null ? findUsers.device_id.split(',').filter(id => id !== lowerDeviceId).join(','):null;
//     if (updatedDeviceIds === '') {
//         updatedDeviceIds = null;
//     }
//     // MongoDB 어드민 서버 테이블 업데이트
//     await collection.updateOne({ _id: findUsers._id }, { $set: { device_id: updatedDeviceIds } });
//
//     // MongoDB 소켓 서버 히스토리 삭제
//     const delHistory = await History.deleteMany({ device_id: lowerDeviceId });
//     responseMsg.MongoHistory.complete = delHistory.deletedCount
//
//     // 비동기 작업을 병렬로 실행
//     await Promise.all([
//         AWSAPI().delDynamoUserFcm(USER_TABLE, data.user_key, responseMsg),
//         AWSAPI().delDynamoDeviceTable(DEVICE_TABLE, lowerDeviceId, data.user_key, responseMsg),
//         AWSAPI().delDynamoRecord(RECORD_TABLE, lowerDeviceId, responseMsg),
//         AWSAPI().delS3(BUCKET_NAME, lowerDeviceId, responseMsg)
//     ]);
//     const lastData = await collection.findOne({ user_key: data.user_key });
//
//     res.status(200).json({
//         msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: id:${lastData.id} - name:${lastData.name}`,
//         responseMsg: responseMsg
//     });
// },

// testAPI(req,res){
//     const data = req.body
//     const token = jwt.sign({user_key:data.user_key},AWS_TOKEN)
//     axios.post("https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push/others",{
//         user_key: data.user_key,
//         fcm_token: data.fcm_token,
//         title:data.title,
//         message:data.message,
//     },{
//         headers: {
//             'x-access-token': token // x-access-token 헤더 추가
//         }
//     }
//     ).then(resp=>{
//         console.log(resp)
//         res.status(200).json(resp.data)
//     })
// },

// async renewalDeleteDeviceId(req, res) {
//     const data = req.body;
//     console.log(data)
//     const lowerDeviceId = data.device_id.toLowerCase();
//     const token = req.headers['token'];
//     const DEVICE_TABLE = 'DEVICE_TABLE'; // 실제 테이블 이름으로 변경
//     const RECORD_TABLE = 'RECORD_TABLE'; // 실제 테이블 이름으로 변경
//     const USER_TABLE = 'USER_TABLE'; // 사용자 정보 테이블 이름
//     const BUCKET_NAME = 'doorbell-video'; // S3 버킷 이름
//
//     // if (data.device_id === undefined && data.fcm_token === undefined) {
//     //     return res.status(400).json({ error: 'There are no device_id and fcm_token inside the body.' });
//     // }
//     if (data.fcm_token === undefined) {
//         console.log('There is no fcm_token inside the body.')
//         return res.status(400).json({ error: 'There is no fcm_token inside the body.' });
//     }
//     if (data.device_id === undefined) {
//         console.log('There is no device_id inside the body.')
//         return res.status(400).json({ error: 'There is no device_id inside the body.' });
//     }
//     if (token === undefined) {
//         console.log('Token not found.')
//         return res.status(400).send('Token not found.');
//     }
//
//
//     const verify = jwt.verify(token, process.env.AWS_TOKEN);
//
//     const sendFcmMessage = await axios.post(
//         "https://l122dwssje.execute-api.ap-northeast-2.amazonaws.com/Prod/push/others",
//         {
//             user_key: verify.user_key,
//             fcm_token: data.fcm_token,
//             title:"[Re-login Request] Change User Information",
//             message:"Your user information has been changed. Please log in again.",
//         },{
//             headers: {
//                 'x-access-token': token // x-access-token 헤더 추가
//             }
//         }
//     )
//     if(sendFcmMessage.data.resultcode !== "00"){
//         console.log('sendFcmMessage failed')
//         return res.status(400).send('sendFcmMessage failed');
//     }
//     console.log(sendFcmMessage.data)
//
//     const client = await Client.connect(MONGO_URI);
//     const collection = client.db(ADMIN_DB_NAME).collection("tables");
//     const findUsers = await collection.findOne({ user_key: verify.user_key });
//
//     let updatedDeviceIds = findUsers.device_id !== null ? findUsers.device_id.split(',').filter(id => id !== lowerDeviceId).join(','):null;
//     if (updatedDeviceIds === '') {
//         updatedDeviceIds = null;
//     }
//
//     // MongoDB 어드민 서버 테이블 업데이트
//     await collection.updateOne({ _id: findUsers._id }, { $set: { device_id: updatedDeviceIds } });
//
//     // MongoDB 소켓 서버 히스토리 삭제
//     await History.deleteMany({ device_id: lowerDeviceId });
//
//     // 메시지 저장
//     const responseMsg = {
//         DEVICE_TABLE: {},
//         RECORD_TABLE: {},
//         USER_TABLE: {},
//         S3: {}
//     };
//
//     // 비동기 작업을 병렬로 실행
//     await Promise.all([
//         AWSAPI().delDynamoUserFcm(USER_TABLE, verify.user_key, responseMsg),
//         AWSAPI().delDynamoDeviceTable(DEVICE_TABLE, lowerDeviceId, verify.user_key, responseMsg),
//         AWSAPI().delDynamoRecord(RECORD_TABLE, lowerDeviceId, responseMsg),
//         AWSAPI().delS3(BUCKET_NAME, lowerDeviceId, responseMsg)
//     ]);
//
//     console.log(responseMsg);
//
//     const lastData = await collection.findOne({ user_key: verify.user_key });
//
//     res.status(200).json({
//         msg: `Deleted (MongoDB, DynamoDB, S3 Video-Data) device_id: ${lastData.id}-${lastData.name}`,
//         changeData: lastData
//     });
// },


// signOut(req,res){
//     const data = req.body
//     Client.connect(MONGO_URI)
//         .then(tableFind=>{
//             tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({user_key:data.user_key})
//                 .then(async findData => {
//                     const s3 = new AWS.S3();
//                     const DEVICE_TABLE = 'DEVICE_TABLE';
//                     const RECORD_TABLE = "RECORD_TABLE"
//                     const BUCKET_NAME = 'doorbell-video';
//
//                     const deviceIds = findData.device_id ? findData.device_id.split(",") : [];
//                     let deviceTableResults = [];
//                     let recordTableResults = [];
//                     let s3Results = [];
//
//                     for (const deviceId of deviceIds) {
//                         const trimmedDeviceId = deviceId.trim();
//
//                         // 1. DEVICE_TABLE에서 삭제
//                         const deviceDeleteParams = {
//                             TableName: DEVICE_TABLE,
//                             Key: {
//                                 device_id: trimmedDeviceId,
//                                 user_key: findData.user_key
//                             }
//                         };
//
//                         try {
//                             const deviceScanParams = {
//                                 TableName: DEVICE_TABLE,
//                                 KeyConditionExpression: 'device_id = :device_id and user_key = :user_key',
//                                 ExpressionAttributeValues: {
//                                     ':device_id': trimmedDeviceId,
//                                     ':user_key': findData.user_key
//                                 }
//                             };
//
//                             const deviceScanResult = await dynamoDB.query(deviceScanParams).promise();
//
//                             if (deviceScanResult.Items.length > 0) {
//                                 await dynamoDB.delete(deviceDeleteParams).promise();
//                                 deviceTableResults.push(`DEVICE_TABLE: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
//                             } else {
//                                 deviceTableResults.push(`DEVICE_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
//                             }
//                         } catch (error) {
//                             console.error(`Error deleting from DEVICE_TABLE:`, error);
//                             deviceTableResults.push(`DEVICE_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
//                         }
//
//                         // 2. RECORD_TABLE에서 삭제
//                         const scanParams = {
//                             TableName: RECORD_TABLE,
//                             FilterExpression: 'device_id = :device_id',
//                             ExpressionAttributeValues: {
//                                 ':device_id': trimmedDeviceId
//                             }
//                         };
//
//                         try {
//                             const scanResult = await dynamoDB.scan(scanParams).promise();
//
//                             if (scanResult.Items.length > 0) {
//                                 const deletePromises = scanResult.Items.map(record => {
//                                     const deleteParams = {
//                                         TableName: RECORD_TABLE,
//                                         Key: {
//                                             device_id: record.device_id,
//                                             file_location: record.file_location // 정렬 키
//                                         }
//                                     };
//                                     return dynamoDB.delete(deleteParams).promise().then(() => {
//                                         recordTableResults.push(`RECORD_TABLE: 삭제성공 삭제된 deviceId: ${record.device_id}`);
//                                     });
//                                 });
//
//                                 await Promise.all(deletePromises);
//                             } else {
//                                 recordTableResults.push(`RECORD_TABLE: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
//                             }
//                         } catch (error) {
//                             console.error(`Error deleting from RECORD_TABLE:`, error);
//                             recordTableResults.push(`RECORD_TABLE: 삭제 실패 deviceId: ${trimmedDeviceId}`);
//                         }
//
//                         // 3. S3에서 객체 삭제
//                         const s3ObjectPrefix = trimmedDeviceId.split(':').join('_') + '/';
//                         try {
//                             const listParams = {
//                                 Bucket: BUCKET_NAME,
//                                 Prefix: s3ObjectPrefix
//                             };
//
//                             const listedObjects = await s3.listObjectsV2(listParams).promise();
//
//                             if (listedObjects.Contents.length > 0) {
//                                 const deleteParams = {
//                                     Bucket: BUCKET_NAME,
//                                     Delete: {
//                                         Objects: listedObjects.Contents.map(object => ({ Key: object.Key })),
//                                     },
//                                 };
//
//                                 await s3.deleteObjects(deleteParams).promise();
//                                 s3Results.push(`S3: 삭제성공 삭제된 deviceId: ${trimmedDeviceId}`);
//                             } else {
//                                 s3Results.push(`S3: 삭제할 데이터 없음 deviceId: ${trimmedDeviceId}`);
//                             }
//                         } catch (error) {
//                             console.error(`Error deleting objects from S3:`, error);
//                             s3Results.push(`S3: 삭제 실패 deviceId: ${trimmedDeviceId}`);
//                         }
//                     }
//                     try {
//                         const suc = await tableFind.db(ADMIN_DB_NAME).collection('tables').deleteMany({ id: findData.id });
//
//                         // deviceIds => 디바이스 아이디들
//                         const result = await History.deleteMany({ device_id: { $in: deviceIds } });
//
//                         const sunilClient = await MongoClient.connect(SUNIL_MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//                         const sunilDb = sunilClient.db("Sunil-Doorbell");
//                         const users = sunilDb.collection("users");
//
//                         const sucSunil = await users.deleteMany({ id: findData.id });
//
//                         // 최종 결과 출력
//                         deviceTableResults.forEach(result => console.log(result));
//                         recordTableResults.forEach(result => console.log(result));
//                         s3Results.forEach(result => console.log(result));
//
//                         console.log(`Deleted ${sucSunil.deletedCount} documents from users.`);
//                         console.log(`Deleted ${suc.deletedCount} documents from MongoDB for user_key=${findData.user_key}`);
//                         console.log(`History Deleted Count = ${result.deletedCount}`);
//                         console.log(`${findData.id}-${findData.name} 회원탈퇴 성공`);
//
//                         res.status(200).send(`${findData.id}-${findData.name} 회원탈퇴 성공`);
//                     } catch (err) {
//                         console.error(err);
//                         res.status(500).send("회원탈퇴 처리 중 오류가 발생했습니다.");
//                     } finally {
//                         // tableFind 연결 종료
//                         tableFind.close();
//                     }
//                 })
//                 .catch(err=>{
//                     console.log(err)
//                     tableFind.close()
//                 })
//
//         })
// },

//findOverseasUser(req, res) {
//     const data = req.body;
//
//     // 검색 조건 설정
//     let params = { email: data.user_email };
//
//     if (data.user_id !== undefined) {
//         params['id'] = data.user_id;
//     }
//
//     let client;  // 👉 클라이언트 객체를 외부에 저장
//
//     Client.connect(MONGO_URI)
//         .then(tableFind => {
//             client = tableFind;
//             const collection = tableFind.db(ADMIN_DB_NAME).collection('tables');
//
//             return collection.findOne(params);
//         })
//         .then(findData => {
//             if (findData) {
//                 if (data.user_id !== undefined) {
//                     res.status(200).send('ok');
//                 } else {
//                     res.status(200).send(findData.id);
//                 }
//             } else {
//                 res.status(404).send('User not found');
//             }
//         })
//         .catch(err => {
//             console.error('Error fetching user:', err);
//             res.status(500).send('Database error');
//         })
//         .finally(() => {
//             if (client) {
//                 console.log("✅ DB Connection closed.");
//                 client.close(); // ✅ 항상 종료
//             }
//         });
// },



//updateOverseasUser(req, res) {
//     const data = req.body;
//     let client; // 👉 클라이언트 객체를 외부에 저장
//
//     Client.connect(MONGO_URI)
//         .then(tableFind => {
//             client = tableFind;
//             return tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({
//                 id: data.user_id,
//                 email: data.user_email
//             });
//         })
//         .then(findData => {
//             if (findData) {
//                 const tableName = 'USER_TABLE';
//                 const scanParams = {
//                     TableName: tableName,
//                     FilterExpression: 'user_id = :user_id',
//                     ExpressionAttributeValues: {
//                         ':user_id': data.user_id
//                     }
//                 };
//
//                 dynamoDB.scan(scanParams, (err, scanResult) => {
//                     if (err) {
//                         console.error('Error scanning table:', err);
//                         res.status(500).json({ error: 'Could not scan table' });
//                         return;
//                     }
//
//                     if (scanResult.Items.length === 0) {
//                         res.status(404).json({ error: 'User not found' });
//                         return;
//                     }
//
//                     const encryptedPassword = bcrypt.hashSync(data.user_pw, 5);
//                     const userKey = scanResult.Items[0].user_key;
//
//                     const updateParams = {
//                         TableName: tableName,
//                         Key: {
//                             user_key: userKey
//                         },
//                         UpdateExpression: 'set user_pw = :user_pw',
//                         ExpressionAttributeValues: {
//                             ':user_pw': encryptedPassword
//                         },
//                         ReturnValues: 'ALL_NEW'
//                     };
//
//                     dynamoDB.update(updateParams, (err, result) => {
//                         if (err) {
//                             console.error('Error updating password:', err);
//                             res.status(500).json({ error: 'Could not update password' });
//                         } else {
//                             res.status(200).send('Password updated successfully');
//                         }
//                     });
//                 });
//             } else {
//                 res.status(404).send('User not found');
//             }
//         })
//         .catch(error => {
//             console.error('Error connecting to MongoDB:', error);
//             res.status(500).send('Database connection error');
//         })
//         .finally(() => {
//             if (client) {
//                 console.log("✅ DB Connection closed.");
//                 client.close(); // ✅ 무조건 종료
//             }
//         });
// },


// eaglesSafesOverseasSave(target, data) {
//     const saveTime = moment().tz('Asia/Seoul');
//
//     if (target === "signUp") {
//         const saveData = {
//             overseas: true,
//             id: data.id,
//             addr: {
//                 location: {},
//                 address: "overseas",
//                 road_address: "overseas",
//                 zone_code: "overseas",
//                 detail: "overseas",
//                 full_address: "overseas"
//             },
//             email: data.email,
//             name: data.name,
//             open: "O",
//             serviceDate: saveTime.format('YYYY-MM-DD kk:mm:ss'),
//             items: [],
//             discount: {
//                 point: 0,
//                 coupon: []
//             },
//             bookmark: []
//         };
//
//         let client;  // 👉 클라이언트 객체를 외부에 저장
//
//         Client.connect(SUNIL_MONGO_URI)
//             .then(tableFind => {
//                 client = tableFind;
//                 tableFind.db("Sunil-Doorbell").collection('users').insertOne(saveData)
//                     .then(suc => {
//                         tableFind.db("Sunil-Doorbell").collection('users').findOne({ id: data.id })
//                             .then(findData => {
//                                 console.log(suc);
//                                 console.log(findData);
//                             })
//                             .catch(err => {
//                                 console.log(err);
//                             });
//                     })
//                     .catch(err => {
//                         console.log(err);
//                     })
//                     .finally(() => {
//                         if (client) {
//                             console.log("✅ Sunil-Doorbell DB Connection closed.");
//                             client.close(); // ✅ 무조건 종료
//                         }
//                     });
//             })
//             .catch(err => {
//                 console.log(err);
//             });
//     }
//
//     if (target === "saveUserKey") {
//         let client;  // 👉 클라이언트 객체를 외부에 저장
//
//         Client.connect(SUNIL_MONGO_URI)
//             .then(tableFind => {
//                 client = tableFind;
//                 tableFind.db("Sunil-Doorbell").collection('users').findOneAndUpdate(
//                     { id: data.id },
//                     { $set: { user_key: data.user_key } }
//                 )
//                     .then(suc => {
//                         console.log(suc);
//                     })
//                     .catch(err => {
//                         console.log(err);
//                     })
//                     .finally(() => {
//                         if (client) {
//                             console.log("✅ Sunil-Doorbell DB Connection closed.");
//                             client.close(); // ✅ 무조건 종료
//                         }
//                     });
//             })
//             .catch(err => {
//                 console.log(err);
//             });
//     }
// },


// overseasSignup(req,res){
//     const data = req.body;
//     const saveTime = moment().tz('Asia/Seoul');
//     console.log(data);
//
//     Client.connect(MONGO_URI)
//         .then(tableFind => {
//             tableFind.db(ADMIN_DB_NAME).collection('tables').find({ company: "Sunil" }).toArray()
//                 .then(allData => {
//                     let maxContractNumObj = allData
//                         .filter(item => item.contract_num && item.contract_num.startsWith('Sunil-overseas-')) // contract_num이 존재하는지 확인
//                         .reduce((max, item) => {
//                             const num = parseInt(item.contract_num.split('Sunil-overseas-')[1], 10);
//                             return (num > parseInt(max.contract_num.split('Sunil-overseas-')[1], 10)) ? item : max;
//                         });
//
//                     // maxContractNumObj가 존재하는지 확인
//                     const maxContractNum = maxContractNumObj ? parseInt(maxContractNumObj.contract_num.split('Sunil-overseas-')[1], 10) : 0;
//
//                     // user_id, user_pw, name, tel, addr(국가), company(회사)
//                     let key = data.user_id;
//                     let tel = "00000000000";
//                     let addr = "sunilOverseas";
//                     let saveAwsData = {
//                         user_id: key,
//                         user_pw: data.user_pw,
//                         name: key,
//                         tel: tel,
//                         addr: addr,
//                         company: "Sunil",
//                     };
//
//                     let mongoData = {
//                         name: key,
//                         tel: tel,
//                         addr: addr,
//                         email: data.user_email,
//                         contract_num: `Sunil-overseas-${Number(maxContractNum) + 1}`, // 데이터 조회 후 +1씩 증가
//                         device_id: null,
//                         company: "Sunil",
//                         contract_service: '주계약자',
//                         id: data.user_id,
//                         communication: 'O',
//                         service_name: "SunilService",
//                         service_start: saveTime.format('YYYY-MM-DD'),
//                         service_end: "9999-12-30",
//                         start_up: 'O',
//                         user_key: null,
//                     };
//
//                     tableFind.db(ADMIN_DB_NAME).collection('tables').find({ id: data.user_id }).toArray()
//                         .then(findData => {
//                             if (findData.length !== 0) {
//                                 console.log('Duplicate UserId');
//                                 res.status(400).send('Duplicate UserId');
//                                 tableFind.close();
//                             } else {
//                                 tableFind.db(ADMIN_DB_NAME).collection('tables').insertOne(mongoData)
//                                     .then(suc => {
//                                         console.log(suc);
//                                         tableFind.db(ADMIN_DB_NAME).collection('tables').find({ id: data.user_id }).toArray()
//                                             .then(sendData => {
//                                                 axios.post(AWS_LAMBDA_SIGNUP, saveAwsData)
//                                                     .then(awsResponse => {
//                                                         console.log('success SignUp');
//                                                         this.eaglesSafesOverseasSave("signUp", mongoData);
//                                                         res.status(200).json({ msg: 'Success Signup', checkData: sendData[0], awsResponse: awsResponse.data });
//                                                         tableFind.close();
//                                                     })
//                                                     .catch(err => {
//                                                         console.log(err);
//                                                         res.status(400).send(err);
//                                                         tableFind.close();
//                                                     });
//                                             });
//                                     })
//                                     .catch(err => {
//                                         console.log('save Fail');
//                                         console.log(err);
//                                         tableFind.close();
//                                     });
//                             }
//                         });
//                 })
//                 .catch(err => {
//                     console.log(err);
//                     tableFind.close();
//                 });
//         })
//         .catch(err => {
//             console.log(err);
//         });
//
//
// },


// addDeviceId(req,res){
//     const data  = req.body
//     const token = req.headers['token']
//
//     Client.connect(MONGO_URI)
//         .then(tableFind => {
//             return tableFind.db(ADMIN_DB_NAME).collection("tables").find().toArray()
//                 .then(contracts => {
//                     const tokenVerify = jwt.verify(token, AWS_TOKEN);
//
//                     const exists = contracts.some(contract => {
//                         const deviceIds = contract.device_id ? contract.device_id.split(',') : [];
//                         return deviceIds.includes(data.device_id.toLowerCase());
//                     });
//
//                     if (exists) {
//                         console.log('Duplicate device_id');
//                         res.status(400).send('Duplicate device_id');
//                         return; // early return
//                     }
//
//                     return tableFind.db(ADMIN_DB_NAME).collection("tables").findOne({ user_key: tokenVerify.user_key })
//                         .then(findData => {
//                             if (!findData) {
//                                 console.log('No data found for user_key');
//                                 res.status(404).send('User data not found');
//                                 return; // early return
//                             }
//
//                             return tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
//                                 { user_key: tokenVerify.user_key },
//                                 {
//                                     $set: {
//                                         device_id: findData.device_id ? findData.device_id + "," + data.device_id.toLowerCase() :
//                                             data.device_id.toLowerCase()
//                                     }
//                                 },
//                                 { returnDocument: 'after' } // 업데이트 후의 문서를 반환하도록 설정
//                             ).then(updatedData => {
//                                 // 업데이트된 데이터가 없으면 처리
//                                 if (!updatedData.value) {
//                                     res.status(404).json({ msg: 'Data not found after update' });
//                                     return;
//                                 }
//
//                                 res.status(200).json({
//                                     msg: `Add a device_id saved Success`,
//                                     target: {
//                                         id: updatedData.value.id, // 업데이트된 데이터에서 id 가져오기
//                                         name: updatedData.value.name, // 업데이트된 데이터에서 name 가져오기
//                                         device_id: data.device_id.toLowerCase(),
//                                     },
//                                     checkData: updatedData.value // 업데이트된 데이터를 바로 사용
//                                 });
//                             });
//                         });
//                 })
//                 .finally(() => {
//                     tableFind.close(); // 모든 작업 완료 후 연결 종료
//                 });
//         })
//         .catch(error => {
//             console.error('Error occurred:', error);
//             res.status(500).send('Internal Server Error');
//         });
// },


// saveDeivceId(req, res) {
//     const data = req.body;
//     Client.connect(MONGO_URI)
//         .then(tableFind => {
//             tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({
//                 user_key: data.user_key
//             })
//                 .then(findData => {
//                     // findData.device_id가 null인 경우 처리
//                     if (!findData.device_id || findData.device_id === "") {
//                         // device_id가 null이면 새 device_id를 저장
//                         tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
//                             { user_key: data.user_key },
//                             { $set: { device_id: data.device_id.toLowerCase() } }
//                         )
//                             .then(suc => {
//                                 console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`);
//                                 res.status(200).send('success');
//                                 tableFind.close();
//                             })
//                             .catch(err => {
//                                 console.error('Error updating device_id:', err);
//                                 res.status(500).send('Error updating device_id');
//                             });
//                     } else {
//                         const dataArray = findData.device_id.toLowerCase().split(',');
//                         if (dataArray.includes(data.device_id.toLowerCase())) {
//                             res.status(200).send(`device_id:${data.device_id.toLowerCase()} - This is already saved device_id`);
//                         } else {
//                             tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate(
//                                 { user_key: data.user_key },
//                                 { $set: { device_id: findData.device_id + "," + data.device_id.toLowerCase() } }
//                             )
//                                 .then(suc => {
//                                     console.log(`${findData.id}-${findData.name}-${data.device_id.toLowerCase()} saved`);
//                                     res.status(200).send('success');
//                                     tableFind.close();
//                                 })
//                                 .catch(err => {
//                                     console.error('Error updating device_id:', err);
//                                     res.status(500).send('Error updating device_id');
//                                 });
//                         }
//                     }
//                 })
//                 .catch(err => {
//                     console.error('Error finding data:', err);
//                     res.status(500).send('Error finding data');
//                 });
//         })
//         .catch(err => {
//             console.error('Error connecting to MongoDB:', err);
//             res.status(500).send('Error connecting to MongoDB');
//         });
// },


// saveUserKey(req,res){
//     const data = req.body
//     //데이터 유저키,아이디 등등 없을때 에러 저장 로직 추가하기
//     const bodyData = data.bodyData
//     const userData = data.userData
//
//     new AwsLogin({...bodyData,id:bodyData.user_id,up_key:bodyData.upKey}).save()
//         .then(suc=>{
//             console.log(`${bodyData.user_id} - Login-log Save Success`)
//         })
//         .catch(err=>{
//             console.log(err)
//             console.log(`${bodyData.user_id} - Login-log Save Fail`)
//         })
//
//     Client.connect(MONGO_URI)
//         .then(tableFind=> {
//             tableFind.db(ADMIN_DB_NAME).collection('tables').findOne({id:bodyData.user_id})
//                 .then(findData=>{
//                     if(findData.user_key === null){
//                             tableFind.db(ADMIN_DB_NAME).collection('tables').findOneAndUpdate({id:bodyData.user_id},
//                                 {$set:{
//                                         user_key:userData.user_key
//                                     }})
//                                 .then(findsData=>{
//                                     let eaglesSave= {
//                                         id:bodyData.user_id,
//                                         user_key:userData.user_key
//                                     }
//
//                                     this.eaglesSafesOverseasSave("saveUserKey",eaglesSave)
//                                     console.log(`Login-id:${bodyData.user_id}- user_key Save Success`)
//                                     res.status(200).send('success')
//                                     tableFind.close()
//                                 })
//                                 .catch(err=>{
//                                     console.log(err)
//                                     res.status(400).send(err)
//                                     tableFind.close()
//                                 })
//                     }else{
//                             console.log(`Login-id:${bodyData.user_id}- This is already saved user_key`)
//                             res.status(200).send('Saved user_key')
//                         tableFind.close()
//                     }
//                 })
//                 .catch(err=>{
//                     console.log(err)
//                     res.status(400).send(err)
//                     tableFind.close()
//                 })
//
//
//         })
//         .catch(err=>{
//             res.status(400).send(err)
//         })
// },


// start_up(req, res) {
//     const data = req.body
//     let client; // 👉 클라이언트 객체를 외부에 저장
//     Client.connect(MONGO_URI)
//         .then(dbs => {
//             client = dbs;  // 👉 클라이언트 저장
//
//             let database = dbs.db(ADMIN_DB_NAME)
//             database.collection('tables').find({id: data.id, tel: data.tel}).toArray().then(data => {
//                 if (data.length === 0) {
//                     res.status(400).send('해당하는 가입정보가 없습니다. 개통 완료 후 이용해주세요.')
//                 } else {
//                     res.status(200).send(data)
//                 }
//             })
//         })
//         .catch(error => {
//             console.error('Error fetching data:', error);
//             res.status(500).send('Database error');
//         })
//         .finally(() => {
//             if (client) {
//                 console.log("✅ DB Connection closed.");
//                 client.close(); // ✅ 무조건 종료
//             }
//         });
// },


// async sendFindServiceEmail(req, res) {
//     const data = req.body;
//
//     const sendMailPromise = (transporter, mailOptions) => {
//         return new Promise((resolve, reject) => {
//             transporter.sendMail(mailOptions, (error, info) => {
//                 if (error) {
//                     console.error("Email send error:", error);
//                     return reject(error.message);
//                 } else {
//                     console.log("Email sent:", info.response);
//                     return resolve(info.response);
//                 }
//             });
//         });
//     };
//
//     if (!["id", "pw"].includes(data.service)) {
//         return res.status(400).send('Invalid service type');
//     }
//
//     const client = await Client.connect(MONGO_URI);
//
//     try {
//         const db = client.db(ADMIN_DB_NAME);
//         const query = data.service === "id" ? { email: data.email } : { id: data.user_id, email: data.email };
//
//         const findData = await db.collection("tables").findOne(query);
//         if (!findData) {
//             return res.status(404).send('Not Found Data');
//         }
//
//         const findAuth = await AuthNumDB.findOne({ email: data.email });
//         if (findAuth) {
//             return res.status(400).send('Email already requested for authentication');
//         }
//
//         const transporter = nodemailer.createTransport({
//             service: NODEMAILER_SERVICE,
//             host: NODEMAILER_HOST,
//             port: 587,
//             secure: false,
//             auth: {
//                 user: NODEMAILER_USER,
//                 pass: NODEMAILER_PASS
//             }
//         });
//
//         const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
//
//         const mailOptions = {
//             from: `MyLucell`,
//             to: data.email,
//             subject: `[MyLucell] This is an email authentication number service.`,
//             text: `Hello, please check the authentication number below to complete the authentication of your email address.\nAuthentication number: ${authNum} \nThis authentication number is valid for 3 minutes.`
//         };
//
//         // ✅ sendMail이 끝날 때까지 기다림
//         await sendMailPromise(transporter, mailOptions);
//
//         // ✅ 인증 정보를 DB에 저장
//         await new AuthNumDB({
//             email: data.email,
//             user_id: data.service === "id" ? findData.id : data.user_id,
//             num: authNum,
//             expires: new Date(new Date().getTime() + 3 * 60 * 1000)
//         }).save();
//
//         res.send('ok');
//
//     } catch (error) {
//         console.error("Error in sendFindServiceEmail:", error);
//         res.status(500).send('Internal Server Error');
//     } finally {
//         // ✅ 모든 처리가 완료된 후에만 DB 연결을 닫음
//         await client.close();
//     }
// },


// async sendEmail(req, res) {
//     const data = req.body;
//     let client;
//
//     try {
//         client = await Client.connect(MONGO_URI);
//         const db = client.db(ADMIN_DB_NAME).collection("tables");
//
//         const findUser = await db.findOne({ id: data.user_id });
//         if (findUser) {
//             return res.status(400).send('Duplicate user_id');
//         }
//
//         const findEmail = await db.findOne({ email: data.email });
//         if (findEmail) {
//             return res.status(400).send('Duplicate email address');
//         }
//
//         const findEmails = await AuthNumDB.findOne({ email: data.email });
//         if (findEmails) {
//             return res.status(400).send('email requested for authentication');
//         }
//
//         const findUserIds = await AuthNumDB.findOne({ user_id: data.user_id });
//         if (findUserIds) {
//             return res.status(400).send('user_id requested for authentication');
//         }
//
//         const authNum = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
//
//         const transporter = nodemailer.createTransport({
//             service: NODEMAILER_SERVICE,
//             host: NODEMAILER_HOST,
//             port: 587,
//             secure: false,
//             auth: {
//                 user: NODEMAILER_USER,
//                 pass: NODEMAILER_PASS
//             }
//         });
//
//         const mailOptions = {
//             from: `MyRucell`,
//             to: data.email,
//             subject: `[MyRucell] This is an email authentication number service.`,
//             text: `Hello, please check the authentication number below to complete the authentication of your email address.\nAuthentication number: ${authNum} \nThis authentication number is valid for 3 minutes.`
//         };
//
//         transporter.sendMail(mailOptions, async (error, info) => {
//             if (error) {
//                 return res.status(400).send(error);
//             }
//
//             await new AuthNumDB({
//                 email: data.email,
//                 user_id: data.user_id,
//                 num: authNum,
//                 expires: new Date(new Date().getTime() + 3 * 60 * 1000)
//             }).save();
//
//             res.send('ok');
//         });
//
//     } catch (error) {
//         console.error('Error in sendEmail:', error);
//         res.status(500).send('Server Error');
//     } finally {
//         if (client) {
//             console.log("✅ DB Connection closed.");
//             client.close(); // ✅ 여기서만 닫기
//         }
//     }
// },

