const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const certDir = '/Users/danielcho/Documents/mqtt/client_1';

const client = mqtt.connect('mqtts://192.168.1.3:8883', {
    clientId: 'blaubit1', // 변경 가능
    username: 'blaubit1',
    password: 'blaubitt123',
    key: fs.readFileSync(path.join(certDir, 'client1.key')),
    cert: fs.readFileSync(path.join(certDir, 'client1.crt')),
    ca: fs.readFileSync(path.join(certDir, 'ca.crt')),
    rejectUnauthorized: true
});

client.on('connect', () => {
    console.log('✅ 연결 성공!');
    client.subscribe('test/topic', err => {
        if (!err) {
            console.log('✅ test/topic 구독 완료');
            client.publish('test/topic', 'hello mqtt');
        }
    });
});

client.on('message', (topic, message) => {
    console.log(`📩 메시지 수신 [${topic}]: ${message.toString()}`);
});

client.on('error', (err) => {
    console.error('❌ 연결 에러:', err);
});
