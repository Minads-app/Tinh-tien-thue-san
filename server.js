/**
 * server.js - Express Server cho du an Quan ly Thue San
 * Chay tren VPS, thay the Netlify Functions
 *
 * Nhiem vu:
 *  1. Phuc vu file tinh (index.html, script.js, style.css) cho trinh duyet
 *  2. Nhan Webhook thanh toan tu SePay -> cap nhat Firebase Firestore
 */

const express = require('express');
const path    = require('path');
const dotenv  = require('dotenv');
const admin   = require('firebase-admin');

// Load bien moi truong tu file .env
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// Cho phep doc JSON body tu request
app.use(express.json());

// ── 1. KHOI TAO FIREBASE ADMIN SDK ──────────────────────────────────────────
if (!admin.apps.length) {
    try {
        let jsonStr = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
        if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
            jsonStr = jsonStr.slice(1, -1);
        }
        const serviceAccount = JSON.parse(jsonStr);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin khoi tao thanh cong (Project:', serviceAccount.project_id + ')');
    } catch (err) {
        console.error('Loi khoi tao Firebase Admin:', err.message);
    }
}

// ── 2. API WEBHOOK – NHAN THANH TOAN TU SEPAY ───────────────────────────────
app.post('/api/sepay-webhook', async (req, res) => {
    console.log('=== WEBHOOK TRIGGERED tu SePay ===');
    console.log('Method:', req.method);

    try {
        // Xac thuc API Key do SePay gui kem (chong gia mao)
        const authHeader   = req.headers.authorization || req.headers.Authorization || '';
        const sepayApiKey  = process.env.SEPAY_API_KEY;

        if (sepayApiKey && authHeader && authHeader !== 'Apikey ' + sepayApiKey) {
            console.error('Sai API Key SePay!');
            return res.status(401).json({ success: false, message: 'Sai thong tin xac thuc' });
        }

        const body = req.body;
        console.log('Body nhan duoc:', JSON.stringify(body, null, 2));

        // Lay Noi dung chuyen khoan va So tien
        const content        = body.content || body.transactionContent || body.description || '';
        const transferAmount = parseInt(body.transferAmount || body.amountIn || body.amount || 0, 10);

        if (!content) {
            console.warn('Khong tim thay noi dung chuyen khoan trong body!');
            return res.status(200).send('Missing content field but ignored to prevent retry');
        }

        // Tim Ma Phieu HBA trong noi dung CK (VD: HBA-20261001-0042)
        const regex = /HBA\-?\d{8}\-?\d{4}/i;
        const match = content.match(regex);

        if (!match) {
            console.warn('Khong tim thay ma phieu HBA trong noi dung:', content);
            return res.status(200).json({
                success: false,
                message: 'Khong tim thay ma phieu trong tin nhan, content: ' + content
            });
        }

        // Chuan hoa lai thanh dinh dang HBA-YYYYMMDD-XXXX
        let rawId     = match[0].toUpperCase().replace(/-/g, '');
        const invoiceId = 'HBA-' + rawId.slice(3, 11) + '-' + rawId.slice(11, 15);
        console.log('Ma phieu:', invoiceId, '| So tien:', transferAmount);

        // Truy van Firestore
        const db      = admin.firestore();
        const docRef  = db.collection('transactions').doc(invoiceId);
        const docSnap = await docRef.get();

        const paymentRecord = {
            amount:             transferAmount,
            paidAt:             admin.firestore.FieldValue.serverTimestamp(),
            sepayTransactionId: String(body.id || body.referenceCode || '')
        };

        // Truong hop 1: Phieu chua ton tai (Khach thanh toan truoc)
        if (!docSnap.exists) {
            console.log('Phieu chua ton tai → Tao phieu tra truoc...');
            await docRef.set({
                id:              invoiceId,
                status:          'paid',
                prePaid:         true,
                paidAt:          admin.firestore.FieldValue.serverTimestamp(),
                createdAt:       admin.firestore.FieldValue.serverTimestamp(),
                totalAmount:     transferAmount,
                paidAmount:      transferAmount,
                remainingAmount: 0,
                paymentMethod:   'Chuyen khoan SePay',
                customerName:    'Khach (Thanh toan QR)'
            });
            await docRef.collection('payments').add(paymentRecord);
            return res.status(200).json({
                success: true,
                message: 'Da tao phieu tra truoc cho phieu ' + invoiceId
            });
        }

        // Truong hop 2: Phieu da ton tai → Cap nhat so tien
        const data        = docSnap.data();
        let currentPaid   = parseInt(data.paidAmount) || 0;
        const totalAmount = parseInt(data.totalAmount) || parseInt(data.transferAmount) || 0;

        if (currentPaid === 0 && data.transferAmount && data.status === 'paid') {
            currentPaid = parseInt(data.transferAmount) || 0;
        }

        const newPaid   = currentPaid + transferAmount;
        const remaining = totalAmount - newPaid;

        let newStatus;
        if (remaining < 0)      newStatus = 'overpaid';
        else if (remaining > 0) newStatus = 'partial';
        else                    newStatus = 'paid';

        console.log('Cap nhat phieu', invoiceId + ': da tra', newPaid, '/', totalAmount, '→', newStatus);

        const batch = db.batch();
        batch.update(docRef, {
            paidAmount:      newPaid,
            remainingAmount: Math.max(0, remaining),
            status:          newStatus,
            paidAt:          admin.firestore.FieldValue.serverTimestamp()
        });
        batch.set(docRef.collection('payments').doc(), paymentRecord);
        await batch.commit();

        console.log('Cap nhat Firestore thanh cong!');
        return res.status(200).json({
            success: true,
            message: 'Da vao so cho phieu ' + invoiceId,
            data:    { paidAmount: newPaid, remainingAmount: Math.max(0, remaining), status: newStatus }
        });

    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ── 3. HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status:  'ok',
        project: 'thue-san-hba',
        time:    new Date().toISOString()
    });
});

// ── 4. PHUC VU FILE TINH (HTML / CSS / JS) ───────────────────────────────────
// Phai dat CUOI CUNG de khong ghi de cac route API
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── KHOI DONG SERVER ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('===========================================');
    console.log('Server dang chay tai http://localhost:' + PORT);
    console.log('  → Webhook SePay: /api/sepay-webhook');
    console.log('  → Health check:  /health');
    console.log('===========================================');
});
