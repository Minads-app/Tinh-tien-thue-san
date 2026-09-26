const admin = require('firebase-admin');
const crypto = require('crypto');
require('dotenv').config();

let jsonStr = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) jsonStr = jsonStr.slice(1, -1);

try {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(jsonStr)) });
} catch (e) {
    console.error("Init error:", e.message);
    process.exit(1);
}

const db = admin.firestore();

function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(salt + password).digest('hex');
}

// 41 default permissions (all true for admin)
const ALL_PERMISSIONS = {
    // 1. Tạo Phiếu (8)
    booking_view: true,
    booking_create: true,
    booking_edit: true,
    booking_edit_full: true,
    booking_discount: true,
    booking_vat_toggle: true,
    booking_schedule_edit: true,
    booking_save: true,
    // 2. Bảng Giá (5)
    config_view: true,
    config_create: true,
    config_edit: true,
    config_delete: true,
    config_backup: true,
    // 3. Báo Cáo (7)
    reports_view: true,
    reports_view_summary: true,
    reports_view_detail: true,
    reports_edit_bill: true,
    reports_delete_bill: true,
    reports_manual_payment: true,
    reports_renew: true,
    // 4. Khách Hàng (10)
    customers_view: true,
    customers_create: true,
    customers_edit: true,
    customers_delete: true,
    customers_view_profile: true,
    customers_export_vat: true,
    customers_vat_status: true,
    customers_comp_manage: true,
    customers_comp_complete: true,
    customers_comp_delete: true,
    // 5. Cài Đặt (4)
    settings_view: true,
    settings_edit_venue: true,
    settings_edit_bank_personal: true,
    settings_edit_bank_company: true,
    // 6. Quản Lý Nhân Sự (6)
    staff_view: true,
    staff_create: true,
    staff_edit: true,
    staff_toggle_active: true,
    staff_delete: true,
    staff_reset_password: true
};

async function seedAdmin() {
    const usersSnap = await db.collection('users').where('username', '==', 'admin').get();
    if (!usersSnap.empty) {
        console.log('Tài khoản admin đã tồn tại!');
        return;
    }

    const salt = 'hba_' + crypto.randomBytes(8).toString('hex');
    const passwordHash = hashPassword('admin123', salt);

    const adminUser = {
        username: 'admin',
        email: 'admin@hba.vn',
        displayName: 'Quản Trị Viên (Admin)',
        phone: '0901234567',
        role: 'admin',
        roleLabel: 'Quản trị viên',
        salt: salt,
        passwordHash: passwordHash,
        isActive: true,
        permissions: ALL_PERMISSIONS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: null
    };

    const docRef = await db.collection('users').add(adminUser);
    console.log('Đã tạo tài khoản Admin mặc định thành công! Doc ID:', docRef.id);
    console.log('Username: admin');
    console.log('Password: admin123');
}

seedAdmin().catch(console.error);
