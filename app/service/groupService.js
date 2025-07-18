const applyDotenv = require('../middlewares/applyDotenv')
const dotenv =require('dotenv')
const { ConnectMongo } = require('../utils/connectMongo');
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');


// 환경변수 적용
const env = applyDotenv(dotenv);

class GroupService {
    constructor() {
        this.MONGO_URI = env.MONGO_URI;
        this.ADMIN_DB_NAME = env.ADMIN_DB_NAME;
        this.GROUP_DB_NAME = env.GROUP_DB_NAME;
        this.AWS_REGION = env.AWS_REGION;
        this.DEVICE_TABLE = 'DEVICE_TABLE';

        // 다이나모 클라이언트
        this.dynamoClient = new DynamoDBClient({
            region: this.AWS_REGION,
            credentials: {
                accessKeyId: env.AWS_ACCESS,
                secretAccessKey: env.AWS_SECRET,
            },
        });
    }

    // DynamoDB에서 device_name 가져오기
    async getDeviceNameFromDynamo(device_id, user_key) {
        const command = new GetItemCommand({
            TableName: this.DEVICE_TABLE,
            Key: {
                device_id: { S: device_id },
                user_key: { S: user_key }
            },
            ProjectionExpression: 'device_name'
        });
        const res = await this.dynamoClient.send(command);
        return res.Item && res.Item.device_name ? res.Item.device_name.S : '';
    }

    // 그룹 자동 생성 (다이나모 device_name 적용)
    async migrateTablesToGroups() {
        const { collection: tablesCol } = await ConnectMongo(this.MONGO_URI, this.ADMIN_DB_NAME, 'tables');
        const { collection: groupsCol } = await ConnectMongo(this.MONGO_URI, this.GROUP_DB_NAME, 'groups');

        const cursor = tablesCol.find({ user_key: { $exists: true, $nin: [null, ''] } });
        let createdCount = 0;
        while (await cursor.hasNext()) {
            const masterInfo = await cursor.next();
            const userKey = masterInfo.user_key;

            // 이미 그룹이 있으면 skip
            const exists = await groupsCol.findOne({ user_key: userKey });
            if (exists) continue;

            // device_info 생성: 각 device_id 별로 다이나모에서 device_name 조회
            const deviceIds = (masterInfo.device_id || '').split(',').map(id => id.trim()).filter(Boolean);

            const device_info = [];
            for (const device_id of deviceIds) {
                let device_name = '';
                try {
                    device_name = await this.getDeviceNameFromDynamo(device_id, userKey);
                } catch (e) {
                    // 조회 실패 시 무시하고 빈값
                }
                device_info.push({
                    device_id,
                    device_name,
                    privacy: false
                });
            }

            // 그룹 문서 생성
            const groupDoc = {
                group_name: `${masterInfo.name || masterInfo.id || '알수없음'}의 그룹`,
                user_key: userKey,
                unit: [
                    {
                        user_key: userKey,
                        user_name: masterInfo.name || '',
                        email: masterInfo.email || '',
                        device_info,
                        token: null,
                        auth: true,
                        state: 'ACTIVE',
                        join_at: new Date(),
                    }
                ],
                created_at: new Date()
            };

            await groupsCol.insertOne(groupDoc);
            createdCount++;
        }
        return { createdCount };
    }


    async getGroupInfo() {
        const { collection: groupsCol } = await ConnectMongo(this.MONGO_URI, this.GROUP_DB_NAME, 'groups');
        const result = await groupsCol.find({}).toArray();
        return result;
    }
}

module.exports = GroupService;
