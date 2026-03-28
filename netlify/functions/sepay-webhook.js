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
        // Kiểm tra Chữ ký bảo mật do SePay gửi (chống Hacker)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const sepayApiKey = process.env.SEPAY_API_KEY; // Lấy từ Biến môi trường Netlify

        if (sepayApiKey && authHeader !== `Apikey ${sepayApiKey}`) {
            return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Sai thong tin xac thuc' }) };
        }

        const body = JSON.parse(event.body);

        // Nơi SePay lưu Nội dung (HBA-XXX) và Số tiền
        const { content, transferAmount } = body;

        if (!content) {
            return { statusCode: 400, body: 'Missing content field' };
        }

        // Tìm Mã Phiếu (Ví dụ: HBA-20231024-1234) trong dãy nội dung CK
        // Lưu ý: Hệ thống mã VietQR tự động xóa dấu gạch ngang (-) nên cần Regex hỗ trợ cả 2 chuẩn
        const regex = /HBA\-?\d{8}\-?\d{4}/i;
        const match = content.match(regex);
        
        if (!match) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Khong tim thay ma phieu trong tin nhan' }) };
        }

        // Tái tạo lại đúng định dạng gốc HBA-YYYYMMDD-XXXX đang lưu trên Firebase
        let rawId = match[0].toUpperCase().replace(/-/g, ''); 
        const invoiceId = `HBA-${rawId.slice(3, 11)}-${rawId.slice(11, 15)}`;

        const db = admin.firestore();
        // Tìm transaction dựa vào trường id
        const snapshot = await db.collection('transactions').where('id', '==', invoiceId).get();

        if (snapshot.empty) {
            // Document chưa được tạo do thu ngân chưa bấm "In Phiếu"
            // Ta tạo trước một record nháp trạng thái 'paid'
            const docRef = db.collection('transactions').doc(invoiceId);
            await docRef.set({
                id: invoiceId,
                status: 'paid',
                prePaid: true,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                transferAmount: transferAmount,
                paymentMethod: 'Chuyển khoản SePay',
                customerName: 'Khách (Thanh toán QR)'
            });
            
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Da tao phieu tra truoc cho phieu ' + invoiceId }) };
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
