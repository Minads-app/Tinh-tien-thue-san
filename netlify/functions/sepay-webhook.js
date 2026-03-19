const admin = require('firebase-admin');

// 1. Khởi tạo Firebase Admin (Chỉ chạy 1 lần khi container init)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Init Error:", error);
    }
}

exports.handler = async (event, context) => {
    // Chỉ nhận POST request từ Webhook
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // SePay cấu hình Header chứng thực (Nâng cao: Có thể kiểm tra thêm ở đây)
        // Hiện tại chỉ parsing nội dung gửi tới
        const body = JSON.parse(event.body);

        // SePay gửi payload có dạng:
        // { gateway: 'MoMo', transactionDate: '...', accountNum: '...', content: 'HBA-XXX...', transferAmount: 100000, referenceCode: '...' }
        const { content, transferAmount } = body;

        if (!content) {
            return { statusCode: 400, body: 'Missing content field' };
        }

        // Tìm Mã Phiếu (Ví dụ: HBA-20231024-1234) trong dãy nội dung CK
        const regex = /HBA\-\d{8}\-\d{4}/i;
        const match = content.match(regex);
        
        if (!match) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Khong tim thay ma phieu trong tin nhan' }) };
        }

        const invoiceId = match[0].toUpperCase();

        const db = admin.firestore();
        // Tìm transaction dựa vào trường id
        const snapshot = await db.collection('transactions').where('id', '==', invoiceId).get();

        if (snapshot.empty) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Ma phieu khong ton tai tren he thong' }) };
        }

        // Cập nhật trạng thái thành paid cho toàn bộ result (đề phòng)
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            const docRef = db.collection('transactions').doc(doc.id);
            // Có thể kiểm tra thêm điều kiện số tiền (transferAmount >= doc.data().totalAmount)
            batch.update(docRef, { status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp() });
        });

        await batch.commit();

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Da vao so cho phieu ${invoiceId}` })
        };

    } catch (e) {
        console.error("Webhook Error:", e);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: e.message })
        };
    }
};
