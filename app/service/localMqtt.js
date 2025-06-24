const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const certDir = '/Users/danielcho/Downloads/mqtt_package';
const infoFilePath = path.join(certDir, 'info.txt');

// ✅ info.txt 읽기
const infoContent = fs.readFileSync(infoFilePath, 'utf-8');

// ✅ 라벨 기반 값 파싱
const getField = (label) => {
    const regex = new RegExp(`${label}:\\s*(.+)`);
    const match = infoContent.match(regex);
    return match ? match[1].trim() : null;
};

// ✅ 인증서 파일 목록 파싱
const getCertFiles = () => {
    const lines = infoContent.split('\n');
    const certLines = lines.filter(line => line.trim().startsWith('- '));
    const files = certLines.map(line => line.replace('- ', '').trim());

    const cert = files.find(f => f.endsWith('.crt') && f !== 'ca.crt');
    const key = files.find(f => f.endsWith('.key'));
    const ca = files.find(f => f === 'ca.crt');

    return { cert, key, ca };
};

// ✅ MQTT 연결 정보 추출
const brokerUrl = getField('주소');
const clientId = getField('클라이언트 ID');
const password = getField('비밀번호');
const { cert, key, ca } = getCertFiles();

// ✅ MQTT 연결
const client = mqtt.connect(brokerUrl, {
    clientId,
    username: clientId,
    password,
    key: fs.readFileSync(path.join(certDir, key)),
    cert: fs.readFileSync(path.join(certDir, cert)),
    ca: fs.readFileSync(path.join(certDir, ca)),
    rejectUnauthorized: false
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
