const dotenv = require('dotenv');
const admin = require('firebase-admin');

console.log('--- Kiem tra cau hinh local ---');
const result = dotenv.config();

if (result.error) {
    console.error('Loi khi doc file .env:', result.error.message);
    process.exit(1);
}

const firebaseSvc = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!firebaseSvc) {
    console.error('Loi: Khong tim thay bien FIREBASE_SERVICE_ACCOUNT trong .env');
    process.exit(1);
}

console.log('1. Da tim thay bien FIREBASE_SERVICE_ACCOUNT');

try {
    // Thu parse JSON
    // Neu co dau nhay don, chung ta can loai bo chung
    let jsonStr = firebaseSvc.trim();
    if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
        console.log('Phat hien dau nhay don du thua, dang loai bo...');
        jsonStr = jsonStr.slice(1, -1);
    }
    
    const serviceAccount = JSON.parse(jsonStr);
    console.log('2. Parse JSON thanh cong (Project ID:', serviceAccount.project_id + ')');
    
    // Thu khoi tao Firebase Admin
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('3. Khoi tao Firebase Admin thanh cong!');
    
    console.log('\n=> Ket luan: Cau hinh cua ban HOP LE.');
} catch (error) {
    console.error('\n=> Loi nghiem trong:', error.message);
    if (error.message.includes('Unexpected token')) {
        console.log('Goi y: Co the file .env dang bi sai dinh dang (du dau nhay hoac ky tu la).');
    }
    process.exit(1);
}
