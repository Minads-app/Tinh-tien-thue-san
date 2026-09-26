// ==========================================
// 1. DATA INITIALIZATION & CONFIG
// ==========================================

// BANK_INFO is now dynamic, loaded from Firebase settings
let unsubscribeReports = null;
let knownTransactions = {};
let cachedTransactions = [];

function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/[đĐ]/g, 'd');
    return str.trim();
}

let siteSettings = {
    venueName: '',
    venueSub: '',
    venueAddress: '',
    bankPersonal: { name: '', accName: '', accNum: '', qrString: '' },
    bankCompany: { name: '', accName: '', accNum: '', qrString: '' }
};

const COURT_MAP = {
    'Hồ bơi': ['Hồ bơi'],
    'Bóng đá': ['Sân bóng đá'],
    'Cầu lông': ['Sân cầu lông 1', 'Sân cầu lông 2', 'Sân cầu lông 3', 'Sân cầu lông 4'],
    'Bóng rổ Full': ['Bóng rổ 1', 'Bóng rổ 2'],
    'Bóng rổ 1/2': ['BR 1A', 'BR 1B', 'BR 2A', 'BR 2B', 'Bóng rổ 3'],
    'Khác': ['Sân mặc định']
};

// Dữ liệu ngày lễ mẫu
const CURRENT_YEAR = new Date().getFullYear();
const HOLIDAYS_DATA = [
    { date: `01/01/${CURRENT_YEAR}`, name: `Tết Dương Lịch` },
    { date: `30/04/${CURRENT_YEAR}`, name: `Giải phóng Miền Nam` },
    { date: `01/05/${CURRENT_YEAR}`, name: `Quốc tế Lao động` },
    { date: `02/09/${CURRENT_YEAR}`, name: `Quốc khánh Việt Nam` },
    { date: "17/02/2026", name: "Mùng 1 Tết Âm Lịch 2026" },
    { date: "18/02/2026", name: "Mùng 2 Tết Âm Lịch 2026" },
    { date: "19/02/2026", name: "Mùng 3 Tết Âm Lịch 2026" },
    { date: "20/02/2026", name: "Mùng 4 Tết Âm Lịch 2026" },
    { date: "21/02/2026", name: "Mùng 5 Tết Âm Lịch 2026" }
];

const DEFAULT_RULES = [
    { id: 1, group: 'Cầu lông', name: 'Sáng/Chiều T2-T6', days: [1,2,3,4,5], start: '06:00', end: '17:30', price: 220000 },
    { id: 2, group: 'Cầu lông', name: 'Tối T2-T6', days: [1,2,3,4,5], start: '17:30', end: '22:00', price: 220000 },
    { id: 3, group: 'Cầu lông', name: 'Cuối tuần', days: [6,0], start: '06:00', end: '22:00', price: 220000 },
    { id: 4, group: 'Bóng rổ 1/2', name: 'T2-T6', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 240000 },
    { id: 5, group: 'Bóng rổ 1/2', name: 'Cuối tuần', days: [6,0], start: '06:00', end: '22:00', price: 270000 },
    { id: 6, group: 'Bóng rổ Full', name: 'T2-T6', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 450000 },
    { id: 7, group: 'Bóng rổ Full', name: 'Cuối tuần', days: [6,0], start: '06:00', end: '22:00', price: 500000 },
    { id: 8, group: 'Bóng đá', name: 'Sáng', days: [0,1,2,3,4,5,6], start: '06:00', end: '17:00', price: 450000 },
    { id: 9, group: 'Bóng đá', name: 'Tối', days: [0,1,2,3,4,5,6], start: '17:00', end: '22:00', price: 550000 },
    { id: 10, group: 'Hồ bơi', name: 'Mặc định', days: [0,1,2,3,4,5,6], start: '06:00', end: '22:00', price: 50000 }
];

let pricingRules = JSON.parse(localStorage.getItem('pricingRules')) || DEFAULT_RULES;
let billItems = [];
let excludeDatePicker; // Flatpickr Instance
let currentInvoiceId = ''; // Biến toàn cục lưu trữ mã phiếu hiện tại

function generateNewInvoiceId() {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
    const randomStr = Math.floor(1000 + Math.random() * 9000);
    currentInvoiceId = `HBA-${dateStr}-${randomStr}`;
    if (document.getElementById('inv-id')) {
        document.getElementById('inv-id').textContent = currentInvoiceId;
    }
}

// ==========================================
// FIREBASE FIRESTORE CONFIG & INIT
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCyFjrLfYvVywaWKRaepTtw9E2N1M6XN38",
  authDomain: "thue-san-hba.firebaseapp.com",
  projectId: "thue-san-hba",
  storageBucket: "thue-san-hba.firebasestorage.app",
  messagingSenderId: "717366693396",
  appId: "1:717366693396:web:19d983ae835072ba74e101"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (e) {
    console.error("Firebase Init Error:", e);
}

// ==========================================
// 1.1 AUTHENTICATION & PERMISSIONS ENGINE
// ==========================================

let auth = null;
try {
    if (firebase.auth) {
        auth = firebase.auth();
    }
} catch (e) {
    console.warn("Firebase Auth not loaded or enabled:", e);
}

let currentUser = null;
let cachedStaffList = [];
let unsubscribeStaff = null;

// 41 MÃ PHÂN QUYỀN TRÊN 6 MÔ-ĐUN
const ALL_PERMISSION_KEYS = [
    // Module 1: Tạo Phiếu / Tính Tiền (8)
    'booking_view', 'booking_create', 'booking_edit', 'booking_edit_full',
    'booking_discount', 'booking_vat_toggle', 'booking_schedule_edit', 'booking_save',
    // Module 2: Cấu Hình Bảng Giá (5)
    'config_view', 'config_create', 'config_edit', 'config_delete', 'config_backup',
    // Module 3: Báo Cáo Thu / Chi & Quản Lý Phiếu (7)
    'reports_view', 'reports_view_summary', 'reports_view_detail', 'reports_edit_bill',
    'reports_delete_bill', 'reports_manual_payment', 'reports_renew',
    // Module 4: Quản Lý Khách Hàng (10)
    'customers_view', 'customers_create', 'customers_edit', 'customers_delete',
    'customers_view_profile', 'customers_export_vat', 'customers_vat_status',
    'customers_comp_manage', 'customers_comp_complete', 'customers_comp_delete',
    // Module 5: Cài Đặt Hệ Thống (4)
    'settings_view', 'settings_edit_venue', 'settings_edit_bank_personal', 'settings_edit_bank_company',
    // Module 6: Quản Lý Nhân Sự (6)
    'staff_view', 'staff_create', 'staff_edit', 'staff_toggle_active', 'staff_delete', 'staff_reset_password'
];

const ROLE_TEMPLATES = {
    admin: {
        label: 'Quản trị viên',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        badgeIcon: '👑',
        permissions: ALL_PERMISSION_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {})
    },
    quan_ly: {
        label: 'Quản lý',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        badgeIcon: '💼',
        permissions: {
            booking_view: true, booking_create: true, booking_edit: true, booking_edit_full: true,
            booking_discount: true, booking_vat_toggle: true, booking_schedule_edit: true, booking_save: true,
            config_view: true, config_create: true, config_edit: true, config_delete: false, config_backup: false,
            reports_view: true, reports_view_summary: true, reports_view_detail: true, reports_edit_bill: true,
            reports_delete_bill: false, reports_manual_payment: true, reports_renew: true,
            customers_view: true, customers_create: true, customers_edit: true, customers_delete: false,
            customers_view_profile: true, customers_export_vat: true, customers_vat_status: true,
            customers_comp_manage: true, customers_comp_complete: true, customers_comp_delete: false,
            settings_view: true, settings_edit_venue: false, settings_edit_bank_personal: false, settings_edit_bank_company: false,
            staff_view: false, staff_create: false, staff_edit: false, staff_toggle_active: false, staff_delete: false, staff_reset_password: false
        }
    },
    thu_ngan: {
        label: 'Thu ngân',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        badgeIcon: '💰',
        permissions: {
            booking_view: true, booking_create: true, booking_edit: true, booking_edit_full: false,
            booking_discount: false, booking_vat_toggle: false, booking_schedule_edit: true, booking_save: true,
            config_view: false, config_create: false, config_edit: false, config_delete: false, config_backup: false,
            reports_view: true, reports_view_summary: false, reports_view_detail: true, reports_edit_bill: false,
            reports_delete_bill: false, reports_manual_payment: true, reports_renew: true,
            customers_view: true, customers_create: true, customers_edit: false, customers_delete: false,
            customers_view_profile: true, customers_export_vat: false, customers_vat_status: false,
            customers_comp_manage: true, customers_comp_complete: true, customers_comp_delete: false,
            settings_view: false, settings_edit_venue: false, settings_edit_bank_personal: false, settings_edit_bank_company: false,
            staff_view: false, staff_create: false, staff_edit: false, staff_toggle_active: false, staff_delete: false, staff_reset_password: false
        }
    },
    ke_toan: {
        label: 'Kế toán',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        badgeIcon: '📊',
        permissions: {
            booking_view: false, booking_create: false, booking_edit: false, booking_edit_full: false,
            booking_discount: false, booking_vat_toggle: true, booking_schedule_edit: false, booking_save: false,
            config_view: false, config_create: false, config_edit: false, config_delete: false, config_backup: false,
            reports_view: true, reports_view_summary: true, reports_view_detail: true, reports_edit_bill: false,
            reports_delete_bill: false, reports_manual_payment: false, reports_renew: false,
            customers_view: true, customers_create: false, customers_edit: false, customers_delete: false,
            customers_view_profile: true, customers_export_vat: true, customers_vat_status: true,
            customers_comp_manage: false, customers_comp_complete: false, customers_comp_delete: false,
            settings_view: false, settings_edit_venue: false, settings_edit_bank_personal: false, settings_edit_bank_company: false,
            staff_view: false, staff_create: false, staff_edit: false, staff_toggle_active: false, staff_delete: false, staff_reset_password: false
        }
    },
    nhan_vien: {
        label: 'Nhân viên',
        badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
        badgeIcon: '👷',
        permissions: {
            booking_view: false, booking_create: false, booking_edit: false, booking_edit_full: false,
            booking_discount: false, booking_vat_toggle: false, booking_schedule_edit: false, booking_save: false,
            config_view: false, config_create: false, config_edit: false, config_delete: false, config_backup: false,
            reports_view: true, reports_view_summary: false, reports_view_detail: true, reports_edit_bill: false,
            reports_delete_bill: false, reports_manual_payment: false, reports_renew: false,
            customers_view: true, customers_create: false, customers_edit: false, customers_delete: false,
            customers_view_profile: false, customers_export_vat: false, customers_vat_status: false,
            customers_comp_manage: false, customers_comp_complete: false, customers_comp_delete: false,
            settings_view: false, settings_edit_venue: false, settings_edit_bank_personal: false, settings_edit_bank_company: false,
            staff_view: false, staff_create: false, staff_edit: false, staff_toggle_active: false, staff_delete: false, staff_reset_password: false
        }
    },
    custom: {
        label: 'Tùy chỉnh',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        badgeIcon: '⚙️',
        permissions: {}
    }
};

// Web Crypto API helpers
async function sha256Hash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
    return 'hba_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function hasPermission(code) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return !!(currentUser.permissions && currentUser.permissions[code]);
}

async function initAuth() {
    let savedUser = null;
    try {
        const rawLocal = localStorage.getItem('hba_auth_user');
        const rawSession = sessionStorage.getItem('hba_auth_user');
        if (rawLocal) savedUser = JSON.parse(rawLocal);
        else if (rawSession) savedUser = JSON.parse(rawSession);
    } catch (e) {
        console.warn("Lỗi đọc session auth:", e);
    }

    if (savedUser && savedUser.id) {
        if (db) {
            try {
                const userDoc = await db.collection('users').doc(savedUser.id).get();
                if (userDoc.exists && userDoc.data().isActive !== false) {
                    const data = userDoc.data();
                    setCurrentUser(data, userDoc.id, !!localStorage.getItem('hba_auth_user'));
                    showAppUI();
                    startAppSession();
                    return;
                }
            } catch (err) {
                console.warn("Không thể tải realtime user data, dùng cache phiên:", err);
                setCurrentUser(savedUser, savedUser.id, !!localStorage.getItem('hba_auth_user'));
                showAppUI();
                startAppSession();
                return;
            }
        } else {
            setCurrentUser(savedUser, savedUser.id, false);
            showAppUI();
            startAppSession();
            return;
        }
    }

    showLoginUI();
}

function showLoginUI() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
}

function showAppUI() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
}

function setCurrentUser(userData, docId, remember = true) {
    currentUser = {
        id: docId,
        username: userData.username || '',
        displayName: userData.displayName || userData.username || 'Người dùng',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'nhan_vien',
        roleLabel: ROLE_TEMPLATES[userData.role]?.label || userData.role || 'Nhân viên',
        permissions: userData.permissions || (ROLE_TEMPLATES[userData.role]?.permissions) || {},
        isActive: userData.isActive !== false
    };

    const sessionData = JSON.stringify(currentUser);
    if (remember) {
        localStorage.setItem('hba_auth_user', sessionData);
        sessionStorage.removeItem('hba_auth_user');
    } else {
        sessionStorage.setItem('hba_auth_user', sessionData);
        localStorage.removeItem('hba_auth_user');
    }
}

function startAppSession() {
    // 1. Tải danh sách cấu hình và dữ liệu
    fetchPricingRules();
    fetchReports();
    fetchSettings();
    fetchCustomers();
    fetchStaffUsers();

    // 2. Cập nhật thông tin Navbar
    updateNavUserDisplay();

    // 3. Thực thi phân quyền UI
    applyPermissions();
}

function updateNavUserDisplay() {
    if (!currentUser) return;
    const nameEl = document.getElementById('nav-user-name');
    const roleBadgeEl = document.getElementById('nav-user-role-badge');
    const avatarEl = document.getElementById('nav-user-avatar-text');
    const nameMobileEl = document.getElementById('nav-user-name-mobile');
    const roleMobileEl = document.getElementById('nav-user-role-mobile');

    const roleInfo = ROLE_TEMPLATES[currentUser.role] || {
        label: currentUser.role,
        badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
        badgeIcon: '👤'
    };

    if (nameEl) nameEl.innerHTML = `<span>${currentUser.displayName}</span>`;
    if (roleBadgeEl) {
        roleBadgeEl.className = `px-2 py-0.5 text-[10px] font-bold rounded-full border ${roleInfo.badgeClass}`;
        roleBadgeEl.textContent = `${roleInfo.badgeIcon} ${roleInfo.label}`;
    }
    if (avatarEl) {
        const firstLetter = (currentUser.displayName || currentUser.username || 'A').trim().charAt(0).toUpperCase();
        avatarEl.textContent = firstLetter;
    }
    if (nameMobileEl) nameMobileEl.textContent = currentUser.displayName;
    if (roleMobileEl) roleMobileEl.textContent = `${roleInfo.badgeIcon} ${roleInfo.label}`;
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('nav-user-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

// Đóng dropdown khi nhấp ra ngoài
document.addEventListener('click', (e) => {
    const btn = document.getElementById('nav-user-btn');
    const dropdown = document.getElementById('nav-user-dropdown');
    if (!btn || !dropdown) return;
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function togglePasswordVisibility(inputId, eyeIconId) {
    const input = document.getElementById(inputId);
    const eye = document.getElementById(eyeIconId);
    if (!input || !eye) return;
    if (input.type === 'password') {
        input.type = 'text';
        eye.className = 'fa-solid fa-eye-slash text-sm';
    } else {
        input.type = 'password';
        eye.className = 'fa-solid fa-eye text-sm';
    }
}

function applyPermissions() {
    if (!currentUser) return;

    // 1. Phân quyền hiển thị các tab điều hướng
    const tabPermMap = {
        'tab-btn-booking': 'booking_view',
        'tab-btn-config': 'config_view',
        'tab-btn-reports': 'reports_view',
        'tab-btn-customers': 'customers_view',
        'tab-btn-settings': 'settings_view',
        'tab-btn-staff': 'staff_view'
    };

    for (const [btnId, permCode] of Object.entries(tabPermMap)) {
        const el = document.getElementById(btnId);
        if (el) {
            if (hasPermission(permCode)) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    }

    const navStaffLink = document.getElementById('nav-item-staff-link');
    if (navStaffLink) {
        if (hasPermission('staff_view')) navStaffLink.classList.remove('hidden');
        else navStaffLink.classList.add('hidden');
    }

    // 2. Phân quyền chi tiết trong các module
    const btnDiscount = document.getElementById('btn-discount-toggle');
    if (btnDiscount) btnDiscount.style.display = hasPermission('booking_discount') ? '' : 'none';

    const btnAddRule = document.querySelector('button[onclick="openModal()"]');
    if (btnAddRule) btnAddRule.style.display = hasPermission('config_create') ? '' : 'none';

    const btnBackup = document.querySelector('button[onclick="backupData()"]');
    if (btnBackup) btnBackup.style.display = hasPermission('config_backup') ? '' : 'none';

    const btnRestore = document.querySelector('input[onchange="restoreData(this)"]')?.parentElement;
    if (btnRestore) btnRestore.style.display = hasPermission('config_backup') ? '' : 'none';

    const reportsSummary = document.getElementById('reports-summary-cards');
    if (reportsSummary) reportsSummary.style.display = hasPermission('reports_view_summary') ? '' : 'none';

    const btnAddCust = document.querySelector('button[onclick="openCustomerModal()"]');
    if (btnAddCust) btnAddCust.style.display = hasPermission('customers_create') ? '' : 'none';

    const btnAddStaff = document.getElementById('btn-add-staff');
    if (btnAddStaff) btnAddStaff.style.display = hasPermission('staff_create') ? '' : 'none';

    // 3. Tự động chuyển về tab được phép nếu tab hiện tại không có quyền
    const activeTab = getCurrentlyActiveTab();
    if (activeTab) {
        const moduleToPerm = {
            'booking': 'booking_view',
            'config': 'config_view',
            'reports': 'reports_view',
            'customers': 'customers_view',
            'settings': 'settings_view',
            'staff': 'staff_view'
        };
        const currentReq = moduleToPerm[activeTab];
        if (currentReq && !hasPermission(currentReq)) {
            const tabsOrder = ['booking', 'reports', 'customers', 'config', 'settings', 'staff'];
            const allowedTab = tabsOrder.find(t => hasPermission(moduleToPerm[t]));
            if (allowedTab) {
                switchTab(allowedTab);
            }
        }
    }
}

function getCurrentlyActiveTab() {
    const tabs = ['booking', 'config', 'reports', 'customers', 'settings', 'staff'];
    for (const t of tabs) {
        const el = document.getElementById(`tab-${t}`);
        if (el && !el.classList.contains('hidden')) return t;
    }
    return 'booking';
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-login-submit');
    const btnText = document.getElementById('btn-login-text');
    const usernameInput = (document.getElementById('login-username')?.value || '').trim();
    const passwordInput = document.getElementById('login-password')?.value || '';
    const rememberMe = document.getElementById('login-remember')?.checked;

    if (!usernameInput || !passwordInput) {
        return Swal.fire('Thông báo', 'Vui lòng nhập tên đăng nhập và mật khẩu!', 'warning');
    }

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang đăng nhập...';

    try {
        if (!db) {
            throw new Error("Không thể kết nối cơ sở dữ liệu Firestore!");
        }

        // Tìm user theo username hoặc email
        let querySnapshot = await db.collection('users').where('username', '==', usernameInput.toLowerCase()).get();
        if (querySnapshot.empty) {
            querySnapshot = await db.collection('users').where('email', '==', usernameInput).get();
        }

        if (querySnapshot.empty) {
            if (btnSubmit) btnSubmit.disabled = false;
            if (btnText) btnText.innerHTML = 'ĐĂNG NHẬP HỆ THỐNG';
            return Swal.fire({
                icon: 'error',
                title: 'Tài khoản không tồn tại',
                text: 'Không tìm thấy người dùng với thông tin này! Vui lòng kiểm tra lại.',
                confirmButtonColor: '#4f46e5'
            });
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Kiểm tra trạng thái khóa
        if (userData.isActive === false) {
            if (btnSubmit) btnSubmit.disabled = false;
            if (btnText) btnText.innerHTML = 'ĐĂNG NHẬP HỆ THỐNG';
            return Swal.fire({
                icon: 'error',
                title: 'Tài khoản bị vô hiệu hóa',
                text: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên! Vui lòng liên hệ ban quản lý.',
                confirmButtonColor: '#ef4444'
            });
        }

        // Kiểm tra mật khẩu
        const inputHash = await sha256Hash((userData.salt || '') + passwordInput);
        if (inputHash !== userData.passwordHash) {
            if (btnSubmit) btnSubmit.disabled = false;
            if (btnText) btnText.innerHTML = 'ĐĂNG NHẬP HỆ THỐNG';
            return Swal.fire({
                icon: 'error',
                title: 'Mật khẩu không chính xác',
                text: 'Mật khẩu bạn vừa nhập không đúng. Vui lòng thử lại!',
                confirmButtonColor: '#ef4444'
            });
        }

        // Cập nhật lastLoginAt
        try {
            await db.collection('users').doc(userDoc.id).update({
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {}

        // Đăng nhập thành công!
        setCurrentUser(userData, userDoc.id, rememberMe);
        showAppUI();
        startAppSession();

        Swal.fire({
            icon: 'success',
            title: 'Đăng nhập thành công!',
            text: `Xin chào, ${currentUser.displayName}!`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (err) {
        console.error("Login error:", err);
        Swal.fire('Lỗi đăng nhập', err.message || 'Đã xảy ra sự cố trong quá trình xác thực!', 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.innerHTML = 'ĐĂNG NHẬP HỆ THỐNG';
    }
}

async function handleLogout() {
    const result = await Swal.fire({
        title: 'Đăng xuất?',
        text: 'Bạn có chắc chắn muốn thoát khỏi hệ thống?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-right-from-bracket mr-1"></i> Đăng xuất ngay',
        cancelButtonText: 'Ở lại',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    // Clear state
    localStorage.removeItem('hba_auth_user');
    sessionStorage.removeItem('hba_auth_user');
    currentUser = null;

    // Unsubscribe listeners
    if (unsubscribeReports) { unsubscribeReports(); unsubscribeReports = null; }
    if (unsubscribeRules) { unsubscribeRules(); unsubscribeRules = null; }
    if (unsubscribeStaff) { unsubscribeStaff(); unsubscribeStaff = null; }

    const dropdown = document.getElementById('nav-user-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    showLoginUI();
    Swal.fire({
        icon: 'info',
        title: 'Đã đăng xuất',
        text: 'Hẹn gặp lại bạn lần sau!',
        timer: 1500,
        showConfirmButton: false
    });
}

// ==========================================
// 1.2 QUẢN LÝ NHÂN SỰ (STAFF CRUD)
// ==========================================

function fetchStaffUsers() {
    if (!db) return;
    if (unsubscribeStaff) unsubscribeStaff();
    try {
        unsubscribeStaff = db.collection('users').onSnapshot(snap => {
            cachedStaffList = [];
            snap.forEach(doc => {
                cachedStaffList.push({ id: doc.id, ...doc.data() });
            });
            cachedStaffList.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return (a.displayName || '').localeCompare(b.displayName || '');
            });
            renderStaffTable();
            updateStaffStats();
        }, err => {
            console.warn("Realtime users snapshot error:", err);
            db.collection('users').get().then(snap => {
                cachedStaffList = [];
                snap.forEach(doc => {
                    cachedStaffList.push({ id: doc.id, ...doc.data() });
                });
                renderStaffTable();
                updateStaffStats();
            });
        });
    } catch (e) {
        console.error("fetchStaffUsers error:", e);
    }
}

function updateStaffStats() {
    const totalEl = document.getElementById('staff-stat-total');
    const activeEl = document.getElementById('staff-stat-active');
    const lockedEl = document.getElementById('staff-stat-locked');
    if (!totalEl) return;

    const total = cachedStaffList.length;
    const active = cachedStaffList.filter(u => u.isActive !== false).length;
    const locked = total - active;

    totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (lockedEl) lockedEl.textContent = locked;
}

function renderStaffTable() {
    const tbody = document.getElementById('staff-table-body');
    const emptyState = document.getElementById('staff-empty-state');
    if (!tbody) return;

    const searchTxt = removeVietnameseTones(document.getElementById('staff-search-input')?.value || '');
    const filterRole = document.getElementById('staff-filter-role')?.value || '';
    const filterStatus = document.getElementById('staff-filter-status')?.value || '';

    const filtered = cachedStaffList.filter(u => {
        if (filterRole && u.role !== filterRole) return false;
        if (filterStatus === 'active' && u.isActive === false) return false;
        if (filterStatus === 'inactive' && u.isActive !== false) return false;
        if (searchTxt) {
            const combined = removeVietnameseTones(`${u.displayName || ''} ${u.username || ''} ${u.phone || ''} ${u.email || ''}`);
            if (!combined.includes(searchTxt)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filtered.map((u, idx) => {
        const isSelf = currentUser && currentUser.id === u.id;
        const roleInfo = ROLE_TEMPLATES[u.role] || {
            label: u.role || 'Chưa định nghĩa',
            badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
            badgeIcon: '👤'
        };
        const isActive = u.isActive !== false;
        const firstLetter = (u.displayName || u.username || 'U').trim().charAt(0).toUpperCase();

        let lastLoginStr = 'Chưa đăng nhập';
        if (u.lastLoginAt) {
            try {
                const dateObj = u.lastLoginAt.toDate ? u.lastLoginAt.toDate() : new Date(u.lastLoginAt);
                lastLoginStr = dateObj.toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch(e) {}
        }

        const canEdit = hasPermission('staff_edit');
        const canToggleActive = hasPermission('staff_toggle_active') && !isSelf;
        const canDelete = hasPermission('staff_delete') && !isSelf && u.username !== 'admin';
        const canResetPwd = hasPermission('staff_reset_password');

        return `
            <tr class="hover:bg-gray-50/80 transition ${!isActive ? 'opacity-60 bg-gray-50/40' : ''}">
                <td class="p-3.5 text-center font-medium text-gray-500">${idx + 1}</td>
                <td class="p-3.5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                            ${firstLetter}
                        </div>
                        <div>
                            <div class="font-bold text-gray-900 flex items-center gap-1.5">
                                <span>${u.displayName || 'Chưa có tên'}</span>
                                ${isSelf ? '<span class="px-1.5 py-0.2 text-[9px] bg-indigo-100 text-indigo-700 font-bold rounded">Bạn</span>' : ''}
                            </div>
                            <div class="text-[11px] text-gray-400">ID: ${u.id.slice(0, 8)}...</div>
                        </div>
                    </div>
                </td>
                <td class="p-3.5 font-mono font-medium text-gray-700">@${u.username || '---'}</td>
                <td class="p-3.5">
                    <div class="text-gray-800 font-medium">${u.phone || '---'}</div>
                    <div class="text-gray-400 text-[11px]">${u.email || ''}</div>
                </td>
                <td class="p-3.5 text-center">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${roleInfo.badgeClass}">
                        <span>${roleInfo.badgeIcon}</span>
                        <span>${roleInfo.label}</span>
                    </span>
                </td>
                <td class="p-3.5 text-center">
                    ${isActive
                        ? '<span class="inline-flex items-center gap-1 text-emerald-700 font-semibold"><i class="fa-solid fa-circle text-[8px] text-emerald-500 animate-pulse"></i> Hoạt động</span>'
                        : '<span class="inline-flex items-center gap-1 text-red-600 font-semibold"><i class="fa-solid fa-circle text-[8px] text-red-500"></i> Đã khóa</span>'
                    }
                </td>
                <td class="p-3.5 text-center text-gray-500 text-[11px]">${lastLoginStr}</td>
                <td class="p-3.5 text-right">
                    <div class="flex items-center justify-end gap-1">
                        ${canEdit ? `
                            <button onclick="openStaffModal('${u.id}')" title="Chỉnh sửa thông tin & phân quyền"
                                class="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition cursor-pointer">
                                <i class="fa-solid fa-pen-to-square text-sm"></i>
                            </button>
                        ` : ''}
                        ${canResetPwd ? `
                            <button onclick="openResetPasswordModal('${u.id}', '${u.displayName || u.username}')" title="Đặt lại mật khẩu"
                                class="p-1.5 text-amber-600 hover:text-amber-900 hover:bg-amber-50 rounded-md transition cursor-pointer">
                                <i class="fa-solid fa-key text-sm"></i>
                            </button>
                        ` : ''}
                        ${canToggleActive ? `
                            <button onclick="toggleStaffStatus('${u.id}', ${isActive})" title="${isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}"
                                class="p-1.5 ${isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'} rounded-md transition cursor-pointer">
                                <i class="fa-solid ${isActive ? 'fa-lock' : 'fa-lock-open'} text-sm"></i>
                            </button>
                        ` : ''}
                        ${canDelete ? `
                            <button onclick="deleteStaffUser('${u.id}', '${u.displayName || u.username}')" title="Xóa tài khoản"
                                class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition cursor-pointer">
                                <i class="fa-solid fa-trash text-sm"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterStaffTable() {
    renderStaffTable();
}

function openStaffModal(staffId = null) {
    const modal = document.getElementById('staff-modal');
    const modalTitle = document.getElementById('staff-modal-title');
    const editIdInput = document.getElementById('staff-edit-id');
    const displayNameInput = document.getElementById('staff-displayname');
    const usernameInput = document.getElementById('staff-username');
    const phoneInput = document.getElementById('staff-phone');
    const emailInput = document.getElementById('staff-email');
    const passwordInput = document.getElementById('staff-password');
    const passwordReqMark = document.getElementById('staff-password-required-mark');
    const passwordHint = document.getElementById('staff-password-hint');
    const roleSelect = document.getElementById('staff-role');
    const isActiveCheck = document.getElementById('staff-is-active');

    if (!modal) return;

    if (staffId) {
        const staff = cachedStaffList.find(s => s.id === staffId);
        if (!staff) return Swal.fire('Lỗi', 'Không tìm thấy thông tin nhân viên!', 'error');

        modalTitle.textContent = `Chỉnh Sửa Nhân Viên: ${staff.displayName || staff.username}`;
        editIdInput.value = staff.id;
        displayNameInput.value = staff.displayName || '';
        usernameInput.value = staff.username || '';
        usernameInput.disabled = (staff.username === 'admin');
        phoneInput.value = staff.phone || '';
        emailInput.value = staff.email || '';
        passwordInput.value = '';
        passwordInput.required = false;
        if (passwordReqMark) passwordReqMark.classList.add('hidden');
        if (passwordHint) passwordHint.classList.remove('hidden');
        roleSelect.value = staff.role || 'custom';
        isActiveCheck.checked = (staff.isActive !== false);

        const perms = staff.permissions || (ROLE_TEMPLATES[staff.role]?.permissions) || {};
        document.querySelectorAll('#staff-modal .perm-check').forEach(cb => {
            const key = cb.getAttribute('data-perm');
            cb.checked = !!perms[key];
        });
    } else {
        modalTitle.textContent = 'Thêm Nhân Viên Mới';
        editIdInput.value = '';
        displayNameInput.value = '';
        usernameInput.value = '';
        usernameInput.disabled = false;
        phoneInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        passwordInput.required = true;
        if (passwordReqMark) passwordReqMark.classList.remove('hidden');
        if (passwordHint) passwordHint.classList.add('hidden');
        roleSelect.value = 'thu_ngan';
        isActiveCheck.checked = true;

        applyTemplateToCheckboxes('thu_ngan');
    }

    modal.classList.remove('hidden');
}

function closeStaffModal() {
    const modal = document.getElementById('staff-modal');
    if (modal) modal.classList.add('hidden');
}

function onStaffRoleSelectChange() {
    const roleSelect = document.getElementById('staff-role');
    const role = roleSelect?.value;
    if (role && role !== 'custom') {
        applyTemplateToCheckboxes(role);
    }
}

function onPermCheckboxChanged() {
    const roleSelect = document.getElementById('staff-role');
    if (roleSelect && roleSelect.value !== 'custom') {
        roleSelect.value = 'custom';
    }
}

function applyTemplateToCheckboxes(role) {
    const template = ROLE_TEMPLATES[role]?.permissions || {};
    document.querySelectorAll('#staff-modal .perm-check').forEach(cb => {
        const key = cb.getAttribute('data-perm');
        cb.checked = !!template[key];
    });
}

function applyRolePermissionsTemplate() {
    const roleSelect = document.getElementById('staff-role');
    const role = roleSelect?.value;
    if (role && role !== 'custom') {
        applyTemplateToCheckboxes(role);
        Swal.fire({
            icon: 'info',
            title: 'Đã áp dụng mẫu quyền',
            text: `Đã áp dụng các quyền theo vai trò ${ROLE_TEMPLATES[role]?.label || role}`,
            timer: 1200,
            showConfirmButton: false
        });
    } else {
        Swal.fire('Thông báo', 'Vui lòng chọn một vai trò cụ thể để áp dụng mẫu quyền!', 'info');
    }
}

function toggleAllPermissions(checked) {
    document.querySelectorAll('#staff-modal .perm-check').forEach(cb => {
        cb.checked = checked;
    });
    const roleSelect = document.getElementById('staff-role');
    if (roleSelect) roleSelect.value = checked ? 'admin' : 'custom';
}

async function handleStaffFormSubmit(e) {
    e.preventDefault();
    if (!hasPermission('staff_create') && !hasPermission('staff_edit')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền thực hiện thao tác này!', 'error');
    }

    const editId = document.getElementById('staff-edit-id')?.value.trim();
    const displayName = document.getElementById('staff-displayname')?.value.trim();
    const username = document.getElementById('staff-username')?.value.trim().toLowerCase();
    const phone = document.getElementById('staff-phone')?.value.trim();
    const email = document.getElementById('staff-email')?.value.trim();
    const password = document.getElementById('staff-password')?.value;
    const role = document.getElementById('staff-role')?.value || 'custom';
    const isActive = document.getElementById('staff-is-active')?.checked;

    if (!displayName || !username) {
        return Swal.fire('Thông báo', 'Vui lòng điền đầy đủ họ tên và tên đăng nhập!', 'warning');
    }

    const usernameRegex = /^[a-zA-Z0-9_\-\.]+$/;
    if (!usernameRegex.test(username)) {
        return Swal.fire('Lỗi', 'Tên đăng nhập chỉ được chứa chữ cái không dấu, chữ số, dấu gạch nối hoặc dấu chấm!', 'warning');
    }

    const duplicate = cachedStaffList.find(s => s.username === username && s.id !== editId);
    if (duplicate) {
        return Swal.fire('Lỗi trùng lặp', 'Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác!', 'error');
    }

    const permissions = {};
    document.querySelectorAll('#staff-modal .perm-check').forEach(cb => {
        const key = cb.getAttribute('data-perm');
        if (key) permissions[key] = cb.checked;
    });

    const btnSave = document.getElementById('btn-save-staff');
    if (btnSave) btnSave.disabled = true;

    try {
        if (!db) throw new Error("Mất kết nối với cơ sở dữ liệu!");

        if (editId) {
            const updateData = {
                displayName,
                phone: phone || '',
                email: email || '',
                role,
                roleLabel: ROLE_TEMPLATES[role]?.label || role,
                isActive,
                permissions,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (username !== 'admin') {
                updateData.username = username;
            }

            if (password && password.length >= 6) {
                const salt = generateSalt();
                updateData.salt = salt;
                updateData.passwordHash = await sha256Hash(salt + password);
            }

            await db.collection('users').doc(editId).update(updateData);

            if (currentUser && currentUser.id === editId) {
                setCurrentUser({ ...currentUser, ...updateData }, editId);
                updateNavUserDisplay();
                applyPermissions();
            }

            closeStaffModal();
            Swal.fire('Thành công', 'Đã cập nhật thông tin nhân viên!', 'success');

        } else {
            if (!password || password.length < 6) {
                if (btnSave) btnSave.disabled = false;
                return Swal.fire('Lỗi', 'Vui lòng nhập mật khẩu tối thiểu 6 ký tự cho nhân viên mới!', 'warning');
            }

            const salt = generateSalt();
            const passwordHash = await sha256Hash(salt + password);

            const newStaff = {
                username,
                displayName,
                phone: phone || '',
                email: email || '',
                role,
                roleLabel: ROLE_TEMPLATES[role]?.label || role,
                salt,
                passwordHash,
                isActive,
                permissions,
                createdBy: currentUser ? currentUser.id : 'system',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: null
            };

            await db.collection('users').add(newStaff);
            closeStaffModal();
            Swal.fire('Thành công', `Đã tạo tài khoản cho nhân viên ${displayName}!`, 'success');
        }

    } catch (err) {
        console.error("Save staff error:", err);
        Swal.fire('Lỗi', err.message || 'Không thể lưu thông tin nhân viên!', 'error');
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

async function toggleStaffStatus(staffId, currentStatus) {
    if (!hasPermission('staff_toggle_active')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền khóa hoặc mở khóa tài khoản!', 'error');
    }
    if (currentUser && currentUser.id === staffId) {
        return Swal.fire('Cảnh báo', 'Bạn không thể tự khóa tài khoản của chính mình!', 'warning');
    }

    const staff = cachedStaffList.find(s => s.id === staffId);
    const actionText = currentStatus ? 'khóa' : 'mở khóa';

    const result = await Swal.fire({
        title: `Xác nhận ${actionText}?`,
        html: `Bạn có chắc chắn muốn ${actionText} tài khoản <b class="text-indigo-600">${staff?.displayName || staff?.username}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: currentStatus ? '#ef4444' : '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: `<i class="fa-solid fa-check mr-1"></i> Đồng ý ${actionText}`,
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        await db.collection('users').doc(staffId).update({
            isActive: !currentStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire('Thành công', `Đã ${actionText} tài khoản!`, 'success');
    } catch (err) {
        Swal.fire('Lỗi', err.message, 'error');
    }
}

async function deleteStaffUser(staffId, staffName) {
    if (!hasPermission('staff_delete')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền xóa tài khoản nhân viên!', 'error');
    }
    if (currentUser && currentUser.id === staffId) {
        return Swal.fire('Cảnh báo', 'Bạn không thể tự xóa tài khoản của chính mình!', 'warning');
    }

    const result = await Swal.fire({
        title: 'Xóa tài khoản nhân viên?',
        html: `Tài khoản <b class="text-red-600">${staffName}</b> sẽ bị xóa hoàn toàn khỏi hệ thống!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-trash mr-1"></i> Xóa vĩnh viễn',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        await db.collection('users').doc(staffId).delete();
        Swal.fire('Đã xóa', `Tài khoản ${staffName} đã được gỡ bỏ khỏi hệ thống!`, 'success');
    } catch (err) {
        Swal.fire('Lỗi', err.message, 'error');
    }
}

function openResetPasswordModal(staffId, staffName) {
    const modal = document.getElementById('reset-password-modal');
    const idInput = document.getElementById('rp-user-id');
    const displayEl = document.getElementById('rp-user-display');
    const pwdInput = document.getElementById('rp-new-password');

    if (!modal) return;
    if (idInput) idInput.value = staffId;
    if (displayEl) displayEl.textContent = staffName;
    if (pwdInput) pwdInput.value = '';

    modal.classList.remove('hidden');
}

function closeResetPasswordModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    if (!hasPermission('staff_reset_password')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền đặt lại mật khẩu!', 'error');
    }

    const userId = document.getElementById('rp-user-id')?.value;
    const newPwd = document.getElementById('rp-new-password')?.value;

    if (!newPwd || newPwd.length < 6) {
        return Swal.fire('Lỗi', 'Mật khẩu mới phải có tối thiểu 6 ký tự!', 'warning');
    }

    try {
        const salt = generateSalt();
        const passwordHash = await sha256Hash(salt + newPwd);

        await db.collection('users').doc(userId).update({
            salt,
            passwordHash,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeResetPasswordModal();
        Swal.fire('Thành công', 'Đã đặt lại mật khẩu mới cho nhân viên!', 'success');
    } catch (err) {
        Swal.fire('Lỗi', err.message, 'error');
    }
}

function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    document.getElementById('cp-current-password').value = '';
    document.getElementById('cp-new-password').value = '';
    document.getElementById('cp-confirm-password').value = '';
    modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const currentPwd = document.getElementById('cp-current-password')?.value;
    const newPwd = document.getElementById('cp-new-password')?.value;
    const confirmPwd = document.getElementById('cp-confirm-password')?.value;

    if (newPwd !== confirmPwd) {
        return Swal.fire('Lỗi', 'Mật khẩu mới và xác nhận mật khẩu không khớp nhau!', 'warning');
    }
    if (newPwd.length < 6) {
        return Swal.fire('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
    }

    try {
        const userDoc = await db.collection('users').doc(currentUser.id).get();
        if (!userDoc.exists) throw new Error("Không tìm thấy thông tin tài khoản trên máy chủ!");

        const userData = userDoc.data();
        const currentHash = await sha256Hash((userData.salt || '') + currentPwd);

        if (currentHash !== userData.passwordHash) {
            return Swal.fire('Lỗi', 'Mật khẩu hiện tại không đúng!', 'error');
        }

        const newSalt = generateSalt();
        const newHash = await sha256Hash(newSalt + newPwd);

        await db.collection('users').doc(currentUser.id).update({
            salt: newSalt,
            passwordHash: newHash,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeChangePasswordModal();
        Swal.fire('Thành công', 'Đã đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.', 'success');
    } catch (err) {
        Swal.fire('Lỗi', err.message, 'error');
    }
}

let unsubscribeRules = null;
async function fetchPricingRules() {
    // 1. Luôn load từ máy tính (localStorage) trước để có dữ liệu dùng ngay
    const localData = localStorage.getItem('pricingRules');
    if (localData) {
        try { pricingRules = JSON.parse(localData); } catch(e) {}
    } else {
        pricingRules = DEFAULT_RULES;
    }

    // 2. Nếu có mạng và Firebase, Lắng nghe dữ liệu mới nhất (Realtime)
    if (db) {
        if (unsubscribeRules) {
            unsubscribeRules();
        }
        try {
            unsubscribeRules = db.collection('config').doc('pricing').onSnapshot(docRef => {
                if (docRef.exists) {
                    pricingRules = docRef.data().rules || pricingRules;
                    localStorage.setItem('pricingRules', JSON.stringify(pricingRules)); 
                    renderConfigTable();
                } else {
                    // Nếu trên mạng chưa có, đẩy dữ liệu hiện tại lên
                    db.collection('config').doc('pricing').set({ rules: pricingRules });
                }
            });
        } catch (e) {
            console.warn("Lỗi mạng, đang dùng dữ liệu lưu trong máy:", e);
            renderConfigTable();
        }
    } else {
        renderConfigTable();
    }
}

async function syncRulesToFirebase() {
    // 1. LUÔN LUÔN lưu vào máy tính (localStorage) trước để đảm bảo an toàn
    localStorage.setItem('pricingRules', JSON.stringify(pricingRules)); 

    // 2. Chạy ngầm đẩy lên Firebase nếu có mạng
    if (!db) return;
    try {
        await db.collection('config').doc('pricing').set({ rules: pricingRules });
    } catch (e) {
        console.error("Lỗi đồng bộ lên Firebase (có thể do rớt mạng):", e);
    }
}

// ==========================================
// 2. UTILITIES
// ==========================================

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function calculateHours(start, end) {
    if(!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 + m2/60) - (h1 + m1/60);
    return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
}

function formatDate(d) { return `${d.getDate()}/${d.getMonth()+1}`; }
function formatDateFull(d) { return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; }
function getDayName(d) { return d === 0 ? 'CN' : 'T' + (d + 1); }

function getDayOfWeekString(dateStr) {
    const [d, m, y] = dateStr.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[date.getDay()];
}

function timeStringToFloat(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
}

function floatToTimeString(floatTime) {
    const h = Math.floor(floatTime);
    const m = Math.round((floatTime - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getSegmentsForTimeRange(group, dayOfWeek, startTimeStr, endTimeStr) {
    const candidates = pricingRules.filter(r => r.group === group && r.days.includes(dayOfWeek));
    const startVal = timeStringToFloat(startTimeStr);
    const endVal = timeStringToFloat(endTimeStr);
    
    let segments = [];
    
    candidates.forEach(r => {
        let rStartVal = timeStringToFloat(r.start);
        let rEndVal = timeStringToFloat(r.end);
        
        let overlapStart = Math.max(startVal, rStartVal);
        let overlapEnd = Math.min(endVal, rEndVal);
        
        if (overlapStart < overlapEnd) {
            let duration = parseFloat((overlapEnd - overlapStart).toFixed(2));
            segments.push({
                startStr: floatToTimeString(overlapStart),
                endStr: floatToTimeString(overlapEnd),
                pricePerHour: r.price,
                duration: duration,
                total: duration * r.price,
                ruleName: r.name
            });
        }
    });
    
    segments.sort((a, b) => timeStringToFloat(a.startStr) - timeStringToFloat(b.startStr));
    return segments;
}

// ==========================================
// 3. MAIN LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    renderWeekdays('weekday-container', []);

    // Tải danh sách ngân hàng
    fetchBankList();

    // Khởi tạo Hệ thống Xác thực & Phân quyền
    initAuth();
    setupAutocomplete();
    initModalManager();

    // INIT FLATPICKR
    excludeDatePicker = flatpickr("#exclude-dates", {
        mode: "multiple",
        dateFormat: "d/m/Y",
        locale: "vn"
    });

    const datePresetSelect = document.getElementById('filter-date-preset');
    if(datePresetSelect) {
        datePresetSelect.addEventListener('change', (e) => {
            const customDates = document.getElementById('filter-custom-dates');
            if(e.target.value === 'custom') {
                customDates.classList.remove('hidden');
            } else {
                customDates.classList.add('hidden');
            }
        });
    }

    ['filter-cust-name', 'filter-cust-phone'].forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    fetchReports();
                }
            });
        }
    });

    // Listeners cho Modal Gia Hạn
    const renewMonthSelect = document.getElementById('rn-month-select');
    if (renewMonthSelect) {
        renewMonthSelect.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                const [s, end] = e.target.value.split('|');
                document.getElementById('rn-start-date').value = s;
                document.getElementById('rn-end-date').value = end;
            }
            renderRenewPreview();
        });
    }

    ['rn-start-date', 'rn-end-date'].forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('change', () => {
                const monthSelect = document.getElementById('rn-month-select');
                if (monthSelect) monthSelect.value = 'custom';
                renderRenewPreview();
            });
        }
    });

    const today = new Date();
    document.getElementById('inv-date').textContent = formatDateFull(today);
    generateNewInvoiceId();
    document.getElementById('start-date').valueAsDate = today;
    document.getElementById('end-date').valueAsDate = today;

    // Listeners
    ['cust-name', 'cust-phone', 'cust-company', 'cust-gender', 'cust-team', 'cust-tax-code', 'cust-tax-address'].forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                document.getElementById('display-name').textContent = document.getElementById('cust-name').value || '---';
                document.getElementById('display-phone').textContent = document.getElementById('cust-phone').value || '---';
                
                const teamVal = document.getElementById('cust-team') ? document.getElementById('cust-team').value.trim() : '';
                const compVal = document.getElementById('cust-company') ? document.getElementById('cust-company').value.trim() : '';
                const taxCodeVal = document.getElementById('cust-tax-code') ? document.getElementById('cust-tax-code').value.trim() : '';
                const taxAddrVal = document.getElementById('cust-tax-address') ? document.getElementById('cust-tax-address').value.trim() : '';
                
                const displayTeam = document.getElementById('display-team');
                if (displayTeam) {
                    displayTeam.textContent = teamVal ? `Đội: ${teamVal}` : '';
                }
                
                const displayComp = document.getElementById('display-company');
                if (displayComp) {
                    displayComp.textContent = compVal ? `Công ty: ${compVal}` : '';
                }
                
                const displayTax = document.getElementById('display-tax-code');
                if (displayTax) {
                    displayTax.textContent = taxCodeVal ? `MST: ${taxCodeVal}` : '';
                }
                
                const displayAddr = document.getElementById('display-tax-address');
                if (displayAddr) {
                    displayAddr.textContent = taxAddrVal ? `Đ/C: ${taxAddrVal}` : '';
                }
                
                const gender = document.getElementById('cust-gender').value;
                document.getElementById('display-gender').textContent = gender ? `(${gender})` : '';
            });
        }
    });

    document.getElementById('sport-select').addEventListener('change', function() {
        const container = document.getElementById('court-select-container');
        container.innerHTML = '';
        const group = this.value;
        if(group && COURT_MAP[group]) {
            COURT_MAP[group].forEach(court => {
                const label = document.createElement('label');
                label.className = "flex items-center space-x-2 p-1 hover:bg-gray-50 cursor-pointer rounded";
                label.innerHTML = `<input type="checkbox" name="court-checkbox" value="${court}" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                                   <span class="text-sm font-medium text-gray-700">${court}</span>`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = '<div class="text-gray-400 italic text-xs">-- Chọn môn trước --</div>';
        }
        updateEstimatedPrice();
    });

    document.getElementById('time-start').addEventListener('change', () => { updateDuration(); updateEstimatedPrice(); });
    document.getElementById('time-end').addEventListener('change', () => { updateDuration(); updateEstimatedPrice(); });

    document.getElementById('add-to-bill-btn').addEventListener('click', addToBill);
    document.getElementById('discount-val').addEventListener('input', renderInvoice);
    document.getElementById('discount-type').addEventListener('change', renderInvoice);
    document.getElementById('vat-check').addEventListener('change', renderInvoice);

    // Khi chọn TK ngân hàng, cập nhật QR ngay
    document.querySelectorAll('input[name="bank-select"]').forEach(radio => {
        radio.addEventListener('change', renderInvoice);
    });

    // Khi đổi hình thức thanh toán, cập nhật print-pay-method ngay
    document.querySelectorAll('input[name="pay-method"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const val = document.querySelector('input[name="pay-method"]:checked').value;
            document.getElementById('print-pay-method').textContent = val;
        });
    });
    
    renderInvoice(); 

    document.getElementById('print-btn').addEventListener('click', async () => {
        if(billItems.length === 0) {
            Swal.fire('Tính tiền thất bại', 'Không có dịch vụ nào trong phiếu!', 'error');
            return;
        }

        const note = document.getElementById('inv-note').value;
        document.getElementById('print-note').textContent = note;
        const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
        document.getElementById('print-pay-method').textContent = payMethod;

        const customerName = (document.getElementById('cust-name').value || 'Khách Vãng Lai').trim();
        const customerPhone = (document.getElementById('cust-phone').value || '').trim();
        
        const finalTotalStr = document.getElementById('final-total').textContent.replace(/[^0-9]/g, '');
        const finalTotalNum = parseInt(finalTotalStr) || 0;

        const subTotalStr = document.getElementById('sub-total').textContent.replace(/[^0-9]/g, '');
        const subTotalNum = parseInt(subTotalStr) || 0;

        const vatAmountStr = document.getElementById('vat-amount').textContent.replace(/[^0-9]/g, '');
        const vatAmountNum = document.getElementById('vat-check').checked ? (parseInt(vatAmountStr) || 0) : 0;

        const discountStr = document.getElementById('print-discount') ? document.getElementById('print-discount').textContent.replace(/[^0-9]/g, '') : '';
        const discountNum = parseInt(discountStr) || Math.max(0, subTotalNum - (finalTotalNum - vatAmountNum));

        const startDateVal = document.getElementById('start-date').value || '';
        const endDateVal = document.getElementById('end-date').value || '';

        // Tự động tính min startDate và max endDate từ toàn bộ billItems (tránh bị lệch khi thêm nhiều dịch vụ)
        let finalStartDate = startDateVal;
        let finalEndDate = endDateVal;
        if (billItems && billItems.length > 0) {
            let minD = null, maxD = null;
            billItems.forEach(it => {
                const r = getItemDateRange(it);
                if (r && r.start && r.end) {
                    if (!minD || r.start < minD) minD = r.start;
                    if (!maxD || r.end > maxD) maxD = r.end;
                }
            });
            if (minD && maxD) {
                const pad = (n) => String(n).padStart(2, '0');
                finalStartDate = `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`;
                finalEndDate = `${maxD.getFullYear()}-${pad(maxD.getMonth() + 1)}-${pad(maxD.getDate())}`;
            }
        }
        
        // Dùng mã phiếu hiện tại đã cấp
        const invoiceId = currentInvoiceId;

        // Cập nhật tự động thông tin Khách hàng vào kho dữ liệu mới
        const team = document.getElementById('cust-team') ? document.getElementById('cust-team').value.trim() : '';
        const comp = document.getElementById('cust-company') ? document.getElementById('cust-company').value.trim() : '';
        const taxCode = document.getElementById('cust-tax-code') ? document.getElementById('cust-tax-code').value.trim() : '';
        const taxAddress = document.getElementById('cust-tax-address') ? document.getElementById('cust-tax-address').value.trim() : '';

        if (customerPhone && db) {
            const cRef = db.collection('customers').doc(customerPhone);
            cRef.get().then(docSnap => {
                const gender = document.getElementById('cust-gender') ? document.getElementById('cust-gender').value : 'Anh';
                if (docSnap.exists) {
                    const updatePayload = {
                        name: customerName,
                        gender: gender,
                        totalSpent: firebase.firestore.FieldValue.increment(finalTotalNum),
                        ticketCount: firebase.firestore.FieldValue.increment(1),
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    if (comp) updatePayload.company = comp;
                    if (taxCode) updatePayload.taxCode = taxCode;
                    if (taxAddress) updatePayload.taxAddress = taxAddress;
                    if (team) updatePayload.team = team;
                    cRef.update(updatePayload);
                } else {
                    const code = 'KH' + Math.floor(1000 + Math.random() * 9000);
                    cRef.set({
                        customerCode: code,
                        name: customerName,
                        gender: gender,
                        team: team,
                        company: comp,
                        taxCode: taxCode,
                        taxAddress: taxAddress,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
                        totalSpent: finalTotalNum,
                        ticketCount: 1
                    });
                }
            }).catch(e => console.error(e));
        }

        // Giữ trạng thái 'paid' nếu webhook đã gọi trước đó
        const currentStatus = knownTransactions[invoiceId] === 'paid' ? 'paid' : 'unpaid';

        const transactionData = {
            id: invoiceId,
            status: currentStatus,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            customerName: customerName,
            customerPhone: customerPhone,
            team: team,
            company: comp,
            taxCode: taxCode,
            taxAddress: taxAddress,
            paymentMethod: payMethod,
            note: note,
            subTotal: subTotalNum,
            discountAmount: discountNum,
            vatAmount: vatAmountNum,
            totalAmount: finalTotalNum,
            startDate: finalStartDate,
            endDate: finalEndDate,
            items: billItems
        };

        if (db) {
            try {
                // Show loading
                Swal.fire({
                    title: 'Đang lưu lên hệ thống...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
                
                const docRef = db.collection('transactions').doc(invoiceId);
                const docSnap = await docRef.get();
                
                if (!docSnap.exists) {
                    transactionData.paidAmount = 0;
                    transactionData.remainingAmount = finalTotalNum;
                    transactionData.status = 'unpaid';
                } else {
                    const data = docSnap.data();
                    transactionData.paidAmount = data.paidAmount || 0;
                    if (transactionData.paidAmount === 0 && data.transferAmount && data.status === 'paid') {
                        transactionData.paidAmount = parseInt(data.transferAmount) || 0;
                    }
                    
                    if (transactionData.paidAmount > 0 && finalTotalNum !== (data.totalAmount || 0)) {
                         Swal.close();
                         const warnResult = await Swal.fire({
                             title: 'Cảnh báo tính toán lại',
                             html: `Phiếu này đã ghi nhận khách trả <b>${formatVND(transactionData.paidAmount)}</b>.<br>Tổng tiền mới (<b>${formatVND(finalTotalNum)}</b>) khác với cũ.<br>Hệ thống sẽ giữ số tiền trả và cập nhật lại công nợ. Tiếp tục?`,
                             icon: 'warning',
                             showCancelButton: true,
                             confirmButtonColor: '#ef4444',
                             cancelButtonText: 'Xem lại',
                             confirmButtonText: 'Đồng ý Lưu đè'
                         });
                         if (!warnResult.isConfirmed) return;
                         Swal.fire({ title: 'Đang ghi đè...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
                    }

                    transactionData.remainingAmount = finalTotalNum - transactionData.paidAmount;
                    
                    if (transactionData.remainingAmount === 0 && transactionData.paidAmount > 0) {
                        transactionData.status = 'paid';
                    } else if (transactionData.remainingAmount > 0 && transactionData.paidAmount > 0) {
                        transactionData.status = 'partial';
                    } else if (transactionData.remainingAmount < 0) {
                        transactionData.status = 'overpaid';
                    } else {
                        transactionData.status = 'unpaid';
                    }
                }
                
                // merge: true để không ghi đè mất thông tin từ SePay Webhook
                await docRef.set(transactionData, { merge: true });
                Swal.close();
                fetchReports(); // Refresh báo cáo
                
                // Chụp ảnh phiếu và hiện popup (In / Chia sẻ)
                await captureAndShowReceiptPopup();

                // Xóa giao diện Edit Mode (nếu đang bật)
                if (document.getElementById('cancel-edit-btn')) {
                    document.getElementById('inv-id').parentElement.classList.remove('text-orange-600', 'bg-orange-100', 'p-1', 'px-1.5', 'py-0.5', 'rounded');
                    document.getElementById('cancel-edit-btn').classList.add('hidden');
                    document.getElementById('print-btn-text').textContent = 'Lưu & Xuất Phiếu';
                    document.getElementById('print-btn').classList.replace('bg-orange-600', 'bg-blue-600');
                    document.getElementById('print-btn').classList.replace('hover:bg-orange-700', 'hover:bg-blue-700');
                }

                // Xóa form chuẩn bị cho khách tiếp
                if(document.getElementById('cust-name')) document.getElementById('cust-name').value = '';
                if(document.getElementById('cust-phone')) document.getElementById('cust-phone').value = '';
                if(document.getElementById('cust-company')) document.getElementById('cust-company').value = '';
                if(document.getElementById('inv-note')) document.getElementById('inv-note').value = '';
                if(document.getElementById('discount-val')) document.getElementById('discount-val').value = '';
                if(document.getElementById('vat-check')) document.getElementById('vat-check').checked = false;
                
                billItems = [];
                // Cấp mã phiếu mới sau khi chụp xong
                generateNewInvoiceId();
                renderInvoice(); // Cập nhật lại ảnh QR và xoá Items hiện tại
            } catch (error) {
                console.error("Lỗi khi lưu Firebase:", error);
                Swal.fire('Cảnh báo Mạng', 'Lưu dữ liệu thất bại, phiếu này có thể bị mất sau khi in!', 'warning').then(() => {
                    captureAndShowReceiptPopup();
                });
            }
        } else {
            captureAndShowReceiptPopup();
        }
    });
});

function fillHolidays() {
    let htmlContent = '<div class="text-left space-y-2 max-h-60 overflow-y-auto p-2 border rounded bg-gray-50">';
    
    HOLIDAYS_DATA.forEach((h) => {
        const dayOfWeek = getDayOfWeekString(h.date); 
        const dayClass = (dayOfWeek === 'CN' || dayOfWeek === 'Thứ 7') ? 'text-red-500 font-bold' : 'text-gray-600 font-medium';

        htmlContent += `
            <label class="flex items-center space-x-3 p-2 bg-white border border-gray-200 rounded cursor-pointer hover:bg-indigo-50 transition">
                <input type="checkbox" value="${h.date}" class="holiday-checkbox w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-gray-800">${h.date}</span>
                        <span class="text-xs ${dayClass} border border-gray-200 bg-gray-50 px-1 rounded">${dayOfWeek}</span>
                    </div>
                    <span class="text-xs text-indigo-600 font-medium">${h.name}</span>
                </div>
            </label>
        `;
    });
    htmlContent += '</div>';

    Swal.fire({
        title: 'Gợi ý Ngày Lễ & Tết',
        html: htmlContent,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> Thêm ngày đã chọn',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#4f46e5',
        focusConfirm: false,
        preConfirm: () => {
            const checkboxes = document.querySelectorAll('.holiday-checkbox:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (result.value.length > 0) {
                const currentDates = excludeDatePicker.selectedDates.map(d => flatpickr.formatDate(d, "d/m/Y"));
                const newDates = [...new Set([...currentDates, ...result.value])];
                excludeDatePicker.setDate(newDates);
                Swal.fire({ icon: 'success', title: 'Đã cập nhật', text: `Đã thêm ${result.value.length} ngày vào danh sách.`, timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('Thông báo', 'Bạn chưa chọn ngày nào.', 'info');
            }
        }
    });
}

function initSelectors() {
    const sportSelect = document.getElementById('sport-select');
    sportSelect.innerHTML = '<option value="">-- Chọn Môn Thể Thao --</option>';
    Object.keys(COURT_MAP).forEach(group => {
        const opt = document.createElement('option');
        opt.value = group;
        opt.textContent = group;
        sportSelect.appendChild(opt);
    });
}

function updateDuration() {
    const s = document.getElementById('time-start').value;
    const e = document.getElementById('time-end').value;
    const hours = calculateHours(s, e);
    document.getElementById('calculated-duration').textContent = hours + " giờ";
}

function updateEstimatedPrice() {
    const group = document.getElementById('sport-select').value;
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    if(!group || !startTime || !endTime) {
        document.getElementById('estimated-price').textContent = "---";
        return;
    }
    const todayDay = new Date().getDay();
    const segments = getSegmentsForTimeRange(group, todayDay, startTime, endTime);
    if (segments.length > 0) {
        let total = segments.reduce((sum, seg) => sum + seg.total, 0);
        document.getElementById('estimated-price').textContent = formatVND(total) + " (Hôm nay)";
    } else {
        document.getElementById('estimated-price').textContent = "Chưa có giá";
    }
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function getWeekdayNameVn(dayIndex) {
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return names[dayIndex] || `T${dayIndex + 1}`;
}

function checkCourtConflicts(params) {
    const { group, courts, startDate, endDate, selectedDays, excludeDates, startTime, endTime, ignoreInvoiceId } = params;
    const newStartMin = timeToMinutes(startTime);
    const newEndMin = timeToMinutes(endTime);

    if (newStartMin >= newEndMin) return [];

    // Tạo danh sách các ngày hợp lệ của lịch mới
    const newSessionDates = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
        const dayOfWeek = cur.getDay();
        if (selectedDays.includes(dayOfWeek)) {
            const dateStr = cur.toDateString();
            if (!excludeDates.includes(dateStr)) {
                const y = cur.getFullYear();
                const m = (cur.getMonth() + 1).toString().padStart(2, '0');
                const d = cur.getDate().toString().padStart(2, '0');
                newSessionDates.push({
                    isoDate: `${y}-${m}-${d}`,
                    displayDate: `${d}/${m}/${y}`,
                    dayOfWeek: dayOfWeek,
                    dayName: getWeekdayNameVn(dayOfWeek)
                });
            }
        }
        cur.setDate(cur.getDate() + 1);
    }

    if (newSessionDates.length === 0 || !cachedTransactions || cachedTransactions.length === 0) {
        return [];
    }

    const conflicts = [];
    const recordedConflictKeys = new Set();

    cachedTransactions.forEach(t => {
        const invId = t.id || t.docId || '';
        if (ignoreInvoiceId && (invId === ignoreInvoiceId || t.docId === ignoreInvoiceId)) return;
        if (t.status === 'cancelled') return;
        if (!t.items || !Array.isArray(t.items)) return;

        t.items.forEach(oldItem => {
            const oldName = oldItem.name || '';
            
            // Tìm sân trùng
            courts.forEach(courtName => {
                const isCourtMatch = oldName.includes(`[${courtName}]`) || (oldName.toLowerCase().includes(courtName.toLowerCase()) && oldName.toLowerCase().includes(group.toLowerCase()));
                if (!isCourtMatch) return;

                // Trích xuất giờ của oldItem
                let oldStartMin = 0;
                let oldEndMin = 0;
                let oldTimeStr = '';

                if (oldItem.timeRange && oldItem.timeRange.includes('-')) {
                    const parts = oldItem.timeRange.split('-');
                    oldStartMin = timeToMinutes(parts[0]);
                    oldEndMin = timeToMinutes(parts[1]);
                    oldTimeStr = oldItem.timeRange;
                } else {
                    const matchTime = (oldItem.desc || '').match(/\((\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\)/);
                    if (matchTime) {
                        oldStartMin = timeToMinutes(matchTime[1]);
                        oldEndMin = timeToMinutes(matchTime[2]);
                        oldTimeStr = `${matchTime[1]} - ${matchTime[2]}`;
                    }
                }

                if (oldStartMin === 0 && oldEndMin === 0) return;

                // Kiểm tra giao thoa giờ
                const isTimeOverlap = (newStartMin < oldEndMin) && (newEndMin > oldStartMin);
                if (!isTimeOverlap) return;

                // Kiểm tra dải ngày của oldItem
                let oldStartDate = null;
                let oldEndDate = null;
                if (oldItem.startDateStr) {
                    const [y, m, d] = oldItem.startDateStr.split('-').map(Number);
                    oldStartDate = new Date(y, m - 1, d);
                } else if (t.startDate) {
                    const [y, m, d] = t.startDate.split('-').map(Number);
                    oldStartDate = new Date(y, m - 1, d);
                }

                if (oldItem.endDateStr) {
                    const [y, m, d] = oldItem.endDateStr.split('-').map(Number);
                    oldEndDate = new Date(y, m - 1, d);
                } else if (t.endDate) {
                    const [y, m, d] = t.endDate.split('-').map(Number);
                    oldEndDate = new Date(y, m - 1, d);
                }

                const oldWeekdays = (oldItem.weekdays && Array.isArray(oldItem.weekdays)) ? oldItem.weekdays.map(Number) : null;
                const oldSkipped = (oldItem.skipped && Array.isArray(oldItem.skipped)) ? oldItem.skipped : [];

                // So khớp từng ngày của lịch mới với lịch cũ
                newSessionDates.forEach(session => {
                    const [sy, sm, sd] = session.isoDate.split('-').map(Number);
                    const checkDate = new Date(sy, sm - 1, sd);

                    let isDateMatch = false;
                    if (oldStartDate && oldEndDate) {
                        if (checkDate >= oldStartDate && checkDate <= oldEndDate) {
                            if (oldWeekdays && oldWeekdays.length > 0) {
                                if (oldWeekdays.includes(session.dayOfWeek)) isDateMatch = true;
                            } else {
                                isDateMatch = true;
                            }
                        }
                    } else {
                        // Không có dải ngày, kiểm tra nếu desc có ngày trùng
                        if ((oldItem.desc || '').includes(session.displayDate)) isDateMatch = true;
                    }

                    // Nếu ngày này trong phiếu cũ đã được đánh dấu nghỉ thì không tính trùng
                    if (isDateMatch && (oldSkipped.includes(session.displayDate) || oldSkipped.includes(session.isoDate))) {
                        isDateMatch = false;
                    }

                    if (isDateMatch) {
                        const conflictKey = `${courtName}_${session.isoDate}_${invId}`;
                        if (!recordedConflictKeys.has(conflictKey)) {
                            recordedConflictKeys.add(conflictKey);
                            conflicts.push({
                                court: courtName,
                                date: session.displayDate,
                                dayName: session.dayName,
                                newTime: `${startTime} - ${endTime}`,
                                oldTime: oldTimeStr || `${Math.floor(oldStartMin/60)}:${(oldStartMin%60).toString().padStart(2,'0')} - ${Math.floor(oldEndMin/60)}:${(oldEndMin%60).toString().padStart(2,'0')}`,
                                customerName: t.customerName || 'Khách vãng lai',
                                customerPhone: t.customerPhone || '---',
                                invoiceId: invId
                            });
                        }
                    }
                });
            });
        });
    });

    return conflicts;
}

async function addToBill() {
    const group = document.getElementById('sport-select').value;
    const selectedCourts = Array.from(document.querySelectorAll('input[name="court-checkbox"]:checked')).map(cb => cb.value);
    
    if(!group || selectedCourts.length === 0) { Swal.fire('Lỗi', 'Vui lòng chọn Môn và ít nhất 1 Sân', 'error'); return; }

    const startDateInput = document.getElementById('start-date').value;
    const endDateInput = document.getElementById('end-date').value;
    if (!startDateInput || !endDateInput) {
        Swal.fire('Lỗi', 'Vui lòng chọn Từ ngày và Đến ngày!', 'error');
        return;
    }

    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    
    const excludeDates = (excludeDatePicker && excludeDatePicker.selectedDates) ? excludeDatePicker.selectedDates.map(d => d.toDateString()) : [];

    const duration = calculateHours(startTime, endTime);
    if(duration <= 0) { Swal.fire('Lỗi', 'Giờ kết thúc phải lớn hơn bắt đầu', 'error'); return; }

    const selectedDays = [];
    document.querySelectorAll('input[name="weekday"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
    if(selectedDays.length === 0) { Swal.fire('Lỗi', 'Chọn thứ trong tuần', 'error'); return; }

    // =========================================================================
    // KIỂM TRA TRÙNG SÂN THỜI GIAN THỰC (CONFLICT DETECTION)
    // =========================================================================
    const conflicts = checkCourtConflicts({
        group: group,
        courts: selectedCourts,
        startDate: startDate,
        endDate: endDate,
        selectedDays: selectedDays,
        excludeDates: excludeDates,
        startTime: startTime,
        endTime: endTime,
        ignoreInvoiceId: currentInvoiceId
    });

    if (conflicts.length > 0) {
        let conflictRowsHtml = '';
        conflicts.slice(0, 8).forEach(c => {
            conflictRowsHtml += `
                <tr class="border-b text-xs">
                    <td class="p-2 border-r font-bold text-red-700">${c.court}</td>
                    <td class="p-2 border-r whitespace-nowrap">${c.date} <span class="text-gray-500 font-medium">(${c.dayName})</span></td>
                    <td class="p-2 border-r text-center font-mono font-bold text-blue-700">${c.newTime}</td>
                    <td class="p-2 border-r text-gray-800"><b>${c.customerName}</b> <span class="font-mono text-[11px] text-gray-500">(${c.customerPhone})</span></td>
                    <td class="p-2 font-mono text-center text-orange-700 font-bold">${c.oldTime}</td>
                </tr>
            `;
        });

        if (conflicts.length > 8) {
            conflictRowsHtml += `<tr><td colspan="5" class="p-2 text-center text-gray-500 italic">... và còn ${conflicts.length - 8} buổi trùng khác.</td></tr>`;
        }

        const warnResult = await Swal.fire({
            title: '<span class="text-red-600 flex items-center justify-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i> CẢNH BÁO TRÙNG LỊCH SÂN!</span>',
            html: `
                <div class="text-left text-xs mb-3 text-gray-700">
                    Phát hiện <b class="text-red-600">${conflicts.length} buổi</b> trong khoảng thời gian này đã có khách khác đặt trước:
                </div>
                <div class="border rounded-lg overflow-x-auto max-h-56 text-left">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-red-50 text-red-900 border-b uppercase font-bold text-[11px]">
                                <th class="p-2 border-r">Sân</th>
                                <th class="p-2 border-r">Ngày</th>
                                <th class="p-2 border-r text-center">Giờ Định Đặt</th>
                                <th class="p-2 border-r">Khách Đang Giữ Sân</th>
                                <th class="p-2 text-center">Giờ Trùng Cũ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${conflictRowsHtml}
                        </tbody>
                    </table>
                </div>
                <p class="text-[11px] text-gray-500 italic mt-3 text-center">Bạn có muốn tiếp tục thêm bất chấp cảnh báo trùng sân không?</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d97706',
            cancelButtonColor: '#2563eb',
            confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> Vẫn Thêm (Bỏ qua trùng)',
            cancelButtonText: '<i class="fa-solid fa-arrow-rotate-left mr-1"></i> Quay lại chọn giờ khác',
            reverseButtons: true,
            width: '650px'
        });

        if (!warnResult.isConfirmed) {
            return; // Dừng, không thêm vào giỏ
        }
    }

    let validDaysCount = 0;
    let matchedDaysCount = 0;
    let skippedDates = [];
    let current = new Date(startDate);
    
    let aggregatedSegments = {};

    while(current <= endDate) {
        const currentDayOfWeek = current.getDay();
        if(selectedDays.includes(currentDayOfWeek)) {
            if(excludeDates.includes(current.toDateString())) {
                skippedDates.push(formatDate(current));
            } else {
                validDaysCount++;
                let daySegments = getSegmentsForTimeRange(group, currentDayOfWeek, startTime, endTime);
                if (daySegments.length > 0) {
                    matchedDaysCount++;
                    daySegments.forEach(seg => {
                        let key = `${seg.startStr}-${seg.endStr}-${seg.pricePerHour}`;
                        if (!aggregatedSegments[key]) {
                            aggregatedSegments[key] = {
                                startStr: seg.startStr,
                                endStr: seg.endStr,
                                pricePerHour: seg.pricePerHour,
                                duration: seg.duration,
                                total: 0,
                                count: 0,
                                weekdays: new Set()
                            };
                        }
                        aggregatedSegments[key].count++;
                        aggregatedSegments[key].total += seg.total;
                        aggregatedSegments[key].weekdays.add(currentDayOfWeek);
                    });
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }

    if(validDaysCount === 0 && skippedDates.length === 0) { Swal.fire('Thông báo', 'Không có ngày phù hợp', 'warning'); return; }
    if(matchedDaysCount === 0 && validDaysCount > 0) { Swal.fire('Cảnh báo', 'Không tìm thấy cấu hình giá cho khung giờ này!', 'warning'); return; }

    selectedCourts.forEach(courtName => {
        const itemName = `${group} [${courtName}]`;

        for (let key in aggregatedSegments) {
            let seg = aggregatedSegments[key];
            let weekdaysArray = Array.from(seg.weekdays).sort();
            billItems.push({
                id: Date.now() + Math.random(),
                name: itemName,
                weekdays: weekdaysArray,
                desc: `${formatDate(startDate)} - ${formatDate(endDate)} (${seg.startStr}-${seg.endStr})`,
                startDateStr: document.getElementById('start-date').value,
                endDateStr: document.getElementById('end-date').value,
                originalCount: seg.count + skippedDates.length,
                skipped: [...skippedDates],
                addedDates: [],
                count: seg.count,
                duration: seg.duration,
                price: seg.pricePerHour,
                total: seg.total
            });
        }
    });

    // Uncheck all selected courts after adding to bill for convenience
    document.querySelectorAll('input[name="court-checkbox"]:checked').forEach(cb => cb.checked = false);

    renderInvoice();
    Swal.fire({ icon: 'success', title: 'Đã thêm vào phiếu', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
}


// ==========================================
// CAPTURE & SHOW RECEIPT POPUP (In / Chia sẻ)
// ==========================================
async function captureAndShowReceiptPopup() {
    const invoiceEl = document.getElementById('invoice-area');
    if (!invoiceEl) return;
    
    // Lưu lại mã phiếu trước khi bị reset bởi generateNewInvoiceId()
    const savedInvoiceId = currentInvoiceId;

    // Tạm hiện loading
    Swal.fire({
        title: 'Đang tạo hình phiếu...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    // 1. Kiểm tra xem #tab-booking có đang bị ẩn không (khi user ở tab Báo cáo, Cài đặt, Khách hàng...)
    const tabBooking = document.getElementById('tab-booking');
    const wasBookingHidden = tabBooking && tabBooking.classList.contains('hidden');
    let prevStyle = {};

    if (wasBookingHidden) {
        prevStyle = {
            position: tabBooking.style.position,
            left: tabBooking.style.left,
            top: tabBooking.style.top,
            width: tabBooking.style.width,
            zIndex: tabBooking.style.zIndex,
            visibility: tabBooking.style.visibility,
            display: tabBooking.style.display
        };
        // Tạm đưa tab-booking ra ngoài màn hình nhưng vẫn hiện để trình duyệt layout đầy đủ kích thước
        tabBooking.classList.remove('hidden');
        tabBooking.style.position = 'fixed';
        tabBooking.style.left = '-9999px';
        tabBooking.style.top = '0';
        tabBooking.style.width = '1200px';
        tabBooking.style.zIndex = '-1000';
        tabBooking.style.visibility = 'visible';
    }

    try {
        // Chờ QR image load xong (nếu có)
        const qrImg = document.getElementById('qr-image');
        if (qrImg && qrImg.src && !qrImg.complete) {
            await new Promise((resolve) => {
                qrImg.onload = resolve;
                qrImg.onerror = resolve;
                setTimeout(resolve, 2000);
            });
        }

        // Chụp phiếu bằng html2canvas
        const canvas = await html2canvas(invoiceEl, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            // Ẩn các phần tử no-print khi chụp
            ignoreElements: (el) => {
                return el.classList && el.classList.contains('no-print');
            },
            onclone: (clonedDoc) => {
                const clonedBooking = clonedDoc.getElementById('tab-booking');
                if (clonedBooking) {
                    clonedBooking.classList.remove('hidden');
                    clonedBooking.style.display = 'grid';
                    clonedBooking.style.visibility = 'visible';
                }
                const clonedInvoice = clonedDoc.getElementById('invoice-area');
                if (clonedInvoice) {
                    clonedInvoice.style.display = 'flex';
                    clonedInvoice.style.visibility = 'visible';
                }
                // Hiện các phần tử print-only trong bản clone
                clonedDoc.querySelectorAll('.print-only').forEach(el => {
                    if (el.id === 'print-discount-row') {
                        el.style.display = el.classList.contains('no-discount') ? 'none' : 'flex';
                    } else if (el.id === 'vat-label-print') {
                        el.style.display = el.classList.contains('no-vat') ? 'none' : 'block';
                    } else {
                        el.style.display = 'block';
                    }
                });
            }
        });

        // Khôi phục lại tab-booking ngay sau khi html2canvas đã chụp xong
        if (wasBookingHidden && tabBooking) {
            tabBooking.classList.add('hidden');
            tabBooking.style.position = prevStyle.position || '';
            tabBooking.style.left = prevStyle.left || '';
            tabBooking.style.top = prevStyle.top || '';
            tabBooking.style.width = prevStyle.width || '';
            tabBooking.style.zIndex = prevStyle.zIndex || '';
            tabBooking.style.visibility = prevStyle.visibility || '';
            tabBooking.style.display = prevStyle.display || '';
        }

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error(`Kích thước hình phiếu không hợp lệ (${canvas?.width}x${canvas?.height})`);
        }

        let imgDataUrl = '';
        try {
            imgDataUrl = canvas.toDataURL('image/png');
        } catch (e) {
            console.error("toDataURL lỗi:", e);
        }

        if (!imgDataUrl || imgDataUrl === 'data:,' || imgDataUrl.length < 50) {
            throw new Error("Không thể chuyển đổi canvas thành dữ liệu ảnh hợp lệ");
        }

        // Lưu blob để dùng cho copy clipboard
        let imgBlob = null;
        try {
            imgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        } catch (e) {
            console.warn("toBlob lỗi:", e);
        }

        await Swal.fire({
            title: `<span class="text-base font-bold text-gray-700"><i class="fa-solid fa-file-invoice mr-1.5 text-indigo-600"></i>Phiếu #${savedInvoiceId}</span>`,
            html: `
                <div class="space-y-3">
                    <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                        <img src="${imgDataUrl}" alt="Phiếu thanh toán" class="w-full h-auto" style="max-height: 60vh; object-fit: contain;">
                    </div>
                    <div class="flex justify-center gap-3 pt-1">
                        <button id="popup-print-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md inline-flex items-center gap-2 transition cursor-pointer">
                            <i class="fa-solid fa-print"></i> In Phiếu
                        </button>
                        <button id="popup-share-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md inline-flex items-center gap-2 transition cursor-pointer">
                            <i class="fa-solid fa-share-from-square"></i> Chia Sẻ
                        </button>
                    </div>
                    <p class="text-[11px] text-gray-400 text-center">Bấm <b>Chia Sẻ</b> để copy hình phiếu vào bộ nhớ tạm → Dán vào Zalo, Messenger...</p>
                </div>
            `,
            width: 600,
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                popup: 'rounded-xl'
            },
            didOpen: () => {
                // Nút In Phiếu
                document.getElementById('popup-print-btn').addEventListener('click', () => {
                    const printWin = window.open('', '_blank', 'width=800,height=1000');
                    printWin.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>In Phiếu ${savedInvoiceId}</title>
                            <style>
                                body { margin: 0; padding: 0; display: flex; justify-content: center; }
                                img { max-width: 100%; height: auto; }
                                @media print {
                                    body { margin: 0; }
                                    img { width: 100%; }
                                }
                            </style>
                        </head>
                        <body>
                            <img src="${imgDataUrl}" onload="setTimeout(function(){ window.print(); window.close(); }, 300);">
                        </body>
                        </html>
                    `);
                    printWin.document.close();
                });

                // Nút Chia Sẻ (Copy ảnh vào clipboard)
                document.getElementById('popup-share-btn').addEventListener('click', async () => {
                    const shareBtn = document.getElementById('popup-share-btn');
                    const originalHtml = shareBtn.innerHTML;

                    try {
                        // Thử dùng Clipboard API (modern browsers)
                        if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && imgBlob) {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': imgBlob })
                            ]);
                            shareBtn.innerHTML = '<i class="fa-solid fa-check"></i> Đã copy!';
                            shareBtn.classList.replace('bg-emerald-600', 'bg-green-500');
                            setTimeout(() => {
                                shareBtn.innerHTML = originalHtml;
                                shareBtn.classList.replace('bg-green-500', 'bg-emerald-600');
                            }, 2000);
                        } else {
                            // Fallback: tải ảnh về
                            const a = document.createElement('a');
                            a.href = imgDataUrl;
                            a.download = `Phieu-${savedInvoiceId}.png`;
                            a.click();
                            shareBtn.innerHTML = '<i class="fa-solid fa-download"></i> Đã tải!';
                            setTimeout(() => { shareBtn.innerHTML = originalHtml; }, 2000);
                        }
                    } catch (err) {
                        console.error('Lỗi copy ảnh:', err);
                        // Fallback: tải ảnh về
                        const a = document.createElement('a');
                        a.href = imgDataUrl;
                        a.download = `Phieu-${savedInvoiceId}.png`;
                        a.click();
                        shareBtn.innerHTML = '<i class="fa-solid fa-download"></i> Đã tải ảnh!';
                        setTimeout(() => { shareBtn.innerHTML = originalHtml; }, 2000);
                    }
                });
            }
        });

    } catch (err) {
        // Đảm bảo luôn khôi phục lại tab-booking nếu có lỗi xảy ra
        if (wasBookingHidden && tabBooking) {
            tabBooking.classList.add('hidden');
            tabBooking.style.position = prevStyle.position || '';
            tabBooking.style.left = prevStyle.left || '';
            tabBooking.style.top = prevStyle.top || '';
            tabBooking.style.width = prevStyle.width || '';
            tabBooking.style.zIndex = prevStyle.zIndex || '';
            tabBooking.style.visibility = prevStyle.visibility || '';
            tabBooking.style.display = prevStyle.display || '';
        }
        console.error('Lỗi chụp phiếu:', err);
        Swal.fire({
            icon: 'error',
            title: 'Không tạo được hình phiếu',
            text: 'Đã xảy ra lỗi khi tạo ảnh phiếu: ' + (err.message || 'Lỗi không xác định') + '. Bạn có muốn in trực tiếp không?',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-print mr-1"></i> In trực tiếp',
            cancelButtonText: 'Đóng'
        }).then(result => {
            if (result.isConfirmed) window.print();
        });
    }
}

function renderInvoice() {
    const tbody = document.getElementById('invoice-items');
    tbody.innerHTML = '';
    let subTotal = 0;

    if(billItems.length === 0) {
        document.getElementById('empty-cart-msg').style.display = 'block';
    } else {
        document.getElementById('empty-cart-msg').style.display = 'none';
        billItems.forEach(item => {
            subTotal += item.total;
            
            const daysText = (item.weekdays || []).map(d => getDayName(d)).join(', ');
            const weekdayDisplay = `<div class="text-xs text-indigo-600 font-semibold mt-0.5">Thứ: ${daysText}</div>`;

            let scheduleSection = '';
            const hasSkipped = item.skipped && item.skipped.length > 0;
            const hasAdded = item.addedDates && item.addedDates.length > 0;

            if (hasSkipped || hasAdded) {
                scheduleSection = `
                    <div class="mt-1 flex flex-wrap items-center gap-1.5 no-print">
                        ${hasSkipped ? `
                            <span class="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded inline-flex items-center" title="Ngày đã trừ: ${item.skipped.join(', ')}">
                                <i class="fa-solid fa-calendar-xmark mr-1"></i>Trừ (${item.skipped.length}): ${item.skipped.join(', ')}
                            </span>
                        ` : ''}
                        ${hasAdded ? `
                            <span class="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center" title="Ngày đã thêm bù: ${item.addedDates.join(', ')}">
                                <i class="fa-solid fa-calendar-plus mr-1"></i>Thêm (${item.addedDates.length}): ${item.addedDates.join(', ')}
                            </span>
                        ` : ''}
                        <button type="button" onclick="openScheduleEditModalForItem(${item.id})" class="no-print text-[11px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer" title="Bấm để sửa thêm hoặc bớt ngày">
                            (Sửa lịch)
                        </button>
                        <button type="button" onclick="resetScheduleForItem(${item.id})" class="no-print text-[11px] text-gray-400 hover:text-red-500 font-medium cursor-pointer" title="Khôi phục lịch gốc ban đầu">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>
                `;
            } else {
                scheduleSection = `
                    <div class="mt-1 no-print">
                        <button type="button" onclick="openScheduleEditModalForItem(${item.id})" class="text-[11px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 inline-flex items-center gap-1 font-medium transition cursor-pointer" title="Bấm để thêm bất kỳ ngày nào hoặc trừ bớt ngày">
                            <i class="fa-regular fa-calendar-days text-indigo-500"></i> Sửa lịch (Thêm / Bớt ngày)
                        </button>
                    </div>
                `;
            }
            const printScheduleNotes = `
                ${hasSkipped ? `<span class="print-only text-xs text-red-600 font-medium block">Trừ ngày: ${item.skipped.join(', ')}</span>` : ''}
                ${hasAdded ? `<span class="print-only text-xs text-emerald-700 font-medium block">Thêm ngày: ${item.addedDates.join(', ')}</span>` : ''}
            `;

            const displayPrice = Math.round(item.price);

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-100";
            tr.innerHTML = `
                <td class="p-3">
                    <div class="no-print rounded-lg p-1.5 -m-1.5 transition-all duration-150" 
                         style="cursor:pointer;" 
                         onclick="openScheduleEditModalForItem(${item.id})" 
                         title="Bấm để sửa lịch (Thêm / Bớt ngày)"
                         onmouseenter="this.style.backgroundColor='#eef2ff'; this.querySelector('.edit-hint').style.opacity='1'; this.querySelector('.item-name-text').style.color='#4338ca';"
                         onmouseleave="this.style.backgroundColor=''; this.querySelector('.edit-hint').style.opacity='0'; this.querySelector('.item-name-text').style.color='#1f2937';">
                        <div class="font-bold text-gray-800 inline-flex items-center gap-1.5">
                            <span class="item-name-text" style="transition:color 0.15s;">${item.name}</span>
                            <i class="fa-solid fa-pen-to-square edit-hint text-[10px] text-indigo-400" style="opacity:0; transition:opacity 0.15s;"></i>
                        </div>
                        <div class="text-xs text-gray-500">
                            ${item.desc}
                            ${weekdayDisplay}
                        </div>
                    </div>
                    <div class="print-only">
                        <div class="font-bold text-gray-800">${item.name}</div>
                        <div class="text-xs text-gray-500">
                            ${item.desc}
                            ${weekdayDisplay}
                        </div>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${scheduleSection}
                        ${printScheduleNotes}
                    </div>
                </td>
                <td class="p-3 text-center font-medium">
                    <div class="inline-flex items-center justify-center no-print">
                        <input type="number" min="0" value="${item.count}" 
                            class="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-400 outline-none"
                            onchange="updateItemCount(${item.id}, this.value)" title="Nhấp để sửa nhanh số buổi">
                        <span class="text-xs text-gray-500 ml-1">buổi</span>
                    </div>
                    <span class="print-only">${item.count} buổi</span>
                </td>
                <td class="p-3 text-center font-medium">${item.duration}h</td>
                <td class="p-3 text-right">
                    <input type="number" value="${displayPrice}" 
                        class="w-24 text-right border border-gray-300 rounded px-1 py-0.5 text-sm font-medium text-indigo-700 focus:ring-1 focus:ring-indigo-400 outline-none no-print"
                        onchange="updateItemPrice(${item.id}, this.value)">
                    <span class="print-only text-gray-600">${formatVND(displayPrice)}</span>
                </td>
                <td class="p-3 text-right font-bold text-gray-800">${formatVND(item.total)}</td>
                <td class="p-3 text-center no-print">
                    <button onclick="removeItem(${item.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-xmark"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    let discount = 0;
    const discVal = parseFloat(document.getElementById('discount-val').value) || 0;
    const discType = document.getElementById('discount-type').value;
    if(discType === 'percent') discount = subTotal * (discVal / 100);
    else discount = discVal;

    const isVatChecked = document.getElementById('vat-check').checked;
    const preTaxTotal = subTotal - discount;
    let vatAmount = 0;
    
    const vatLabelPrint = document.getElementById('vat-label-print');
    if(isVatChecked) {
        vatAmount = preTaxTotal * 0.10;
        document.getElementById('vat-amount').style.display = 'block';
        if (vatLabelPrint) {
            vatLabelPrint.style.display = 'block';
            vatLabelPrint.classList.remove('no-vat');
        }
    } else {
        document.getElementById('vat-amount').style.display = 'none';
        if (vatLabelPrint) {
            vatLabelPrint.style.display = 'none';
            vatLabelPrint.classList.add('no-vat');
        }
    }

    const finalTotal = preTaxTotal + vatAmount;

    document.getElementById('sub-total').textContent = formatVND(subTotal);
    document.getElementById('print-discount').textContent = formatVND(discount);
    const printDiscountRow = document.getElementById('print-discount-row');
    if (printDiscountRow) {
        if (discount > 0) {
            printDiscountRow.classList.remove('no-discount');
        } else {
            printDiscountRow.classList.add('no-discount');
        }
    }
    document.getElementById('vat-amount').textContent = formatVND(vatAmount);
    document.getElementById('final-total').textContent = formatVND(finalTotal);

    updatePaymentInfo(finalTotal, isVatChecked);
}

function updatePaymentInfo(finalTotal, isVatChecked) {
    const bankNameEl = document.getElementById('bank-name');
    const accNameEl = document.getElementById('bank-acc-name');
    const accNumEl = document.getElementById('bank-acc-num');
    const qrImageEl = document.getElementById('qr-image');
    const qrSection = document.getElementById('qr-section');
    const printBankType = document.getElementById('print-bank-type');

    // Đọc lựa chọn TK ngân hàng từ radio
    const bankChoice = document.querySelector('input[name="bank-select"]:checked');
    const bankType = bankChoice ? bankChoice.value : 'personal';

    let selectedBank;
    const bankInfoEl = document.getElementById('bank-info-display');
    if(bankType === 'company') {
        selectedBank = siteSettings.bankCompany;
        qrSection.classList.remove('bg-indigo-50', 'border-indigo-200');
        qrSection.classList.add('bg-blue-50', 'border-blue-300');
        if(printBankType) printBankType.textContent = 'TK Công ty';
        // Hiển thị thông tin TK Công ty
        if(bankInfoEl) {
            bankInfoEl.classList.remove('hidden');
            bankInfoEl.innerHTML = `
                <div class="text-xs space-y-0.5">
                    <p class="font-bold text-blue-800"><i class="fa-solid fa-building-columns mr-1"></i>${selectedBank.name || '---'}</p>
                    <p class="text-gray-700">CTK: <span class="font-bold">${selectedBank.accName || '---'}</span></p>
                    <p class="text-gray-700">STK: <span class="font-mono font-bold text-blue-700">${selectedBank.accNum || '---'}</span></p>
                </div>`;
        }
    } else {
        selectedBank = siteSettings.bankPersonal;
        qrSection.classList.add('bg-indigo-50', 'border-indigo-200');
        qrSection.classList.remove('bg-blue-50', 'border-blue-300');
        if(printBankType) printBankType.textContent = 'TK Cá nhân';
        if(bankInfoEl) {
            bankInfoEl.classList.add('hidden');
            bankInfoEl.innerHTML = '';
        }
    }

    bankNameEl.textContent = selectedBank.name || '---';
    accNameEl.textContent = selectedBank.accName || '---';
    accNumEl.textContent = selectedBank.accNum || '---';
    if(selectedBank.qrString) {
        // Chuẩn hóa mã phiếu: Xóa dấu gạch ngang (VD: HBA-20260320-1966 -> HBA202603201966)
        // Thêm tiền tố SEVQR để Vietinbank đẩy thông báo cho SePay
        const cleanInvoiceId = currentInvoiceId.replace(/-/g, '');
        qrImageEl.crossOrigin = 'anonymous';
        qrImageEl.src = `https://img.vietqr.io/image/${selectedBank.qrString}-compact.png?amount=${finalTotal}&addInfo=SEVQR%20${cleanInvoiceId}&accountName=${encodeURIComponent(selectedBank.accName || '')}`;
    } else {
        qrImageEl.src = '';
    }
}

function updateItemPrice(itemId, newPrice) {
    const price = parseInt(newPrice) || 0;
    const item = billItems.find(i => i.id === itemId);
    if (!item) return;
    item.price = price;
    item.total = price * item.duration * item.count;
    renderInvoice();
}

function removeItem(id) {
    billItems = billItems.filter(i => i.id !== id);
    renderInvoice();
}

function updateItemCount(itemId, newCount) {
    const count = parseInt(newCount);
    if (isNaN(count) || count < 0) return;
    const item = billItems.find(i => i.id === itemId);
    if (!item) return;
    item.count = count;
    item.total = item.price * item.duration * item.count;
    renderInvoice();
}

function getItemDateRange(item) {
    let start, end;
    if (item.startDateStr && item.endDateStr) {
        const [sy, sm, sd] = item.startDateStr.split('-').map(Number);
        const [ey, em, ed] = item.endDateStr.split('-').map(Number);
        start = new Date(sy, sm - 1, sd);
        end = new Date(ey, em - 1, ed);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            return { start, end };
        }
    }

    if (item.desc) {
        const match = item.desc.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*-\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
        if (match) {
            const currentYear = new Date().getFullYear();
            const formStartYear = document.getElementById('start-date')?.value ? parseInt(document.getElementById('start-date').value.split('-')[0]) : currentYear;
            const sd = parseInt(match[1]);
            const sm = parseInt(match[2]);
            const sy = match[3] ? parseInt(match[3]) : formStartYear;

            const ed = parseInt(match[4]);
            const em = parseInt(match[5]);
            const ey = match[6] ? parseInt(match[6]) : sy;

            start = new Date(sy, sm - 1, sd);
            end = new Date(ey, em - 1, ed);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                return { start, end };
            }
        }
    }

    const formStart = document.getElementById('start-date')?.value;
    const formEnd = document.getElementById('end-date')?.value;
    if (formStart && formEnd) {
        const [sy, sm, sd] = formStart.split('-').map(Number);
        const [ey, em, ed] = formEnd.split('-').map(Number);
        start = new Date(sy, sm - 1, sd);
        end = new Date(ey, em - 1, ed);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            return { start, end };
        }
    }

    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
}

function getItemAllPlayingDates(item) {
    const { start, end } = getItemDateRange(item);
    const weekdays = Array.isArray(item.weekdays) ? item.weekdays.map(Number) : [];
    const dates = [];

    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (current <= stop) {
        const dayOfWeek = current.getDay();
        if (weekdays.length === 0 || weekdays.includes(dayOfWeek)) {
            const dStr = String(current.getDate()).padStart(2, '0');
            const mStr = String(current.getMonth() + 1).padStart(2, '0');
            const yStr = current.getFullYear();
            const dateStr = `${dStr}/${mStr}/${yStr}`;
            const shortDateStr = `${current.getDate()}/${current.getMonth() + 1}`;

            const holiday = HOLIDAYS_DATA.find(h => {
                const parts = h.date.split('/').map(Number);
                return parts[0] === current.getDate() && parts[1] === (current.getMonth() + 1) && (!parts[2] || parts[2] === current.getFullYear());
            });

            dates.push({
                date: new Date(current),
                dateStr: dateStr,
                shortDateStr: shortDateStr,
                dayOfWeek: dayOfWeek,
                dayName: dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${dayOfWeek + 1}`,
                holidayName: holiday ? holiday.name : null
            });
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function resetScheduleForItem(itemId) {
    const item = billItems.find(i => i.id === itemId);
    if (!item) return;
    const allDates = getItemAllPlayingDates(item);
    const totalOriginal = item.originalCount || allDates.length;
    item.skipped = [];
    item.addedDates = [];
    item.count = totalOriginal;
    item.total = item.count * item.duration * item.price;
    renderInvoice();
    Swal.fire({
        icon: 'info',
        title: 'Đã khôi phục',
        text: `Đã khôi phục lịch của ${item.name} về ${item.count} buổi ban đầu. Mã QR thanh toán đã cập nhật!`,
        timer: 1800,
        showConfirmButton: false
    });
}

function openScheduleEditModalForItem(itemId) {
    const item = billItems.find(i => i.id === itemId);
    if (!item) return;

    const { start: initialStart, end: initialEnd } = getItemDateRange(item);
    const initialStartStr = `${initialStart.getFullYear()}-${String(initialStart.getMonth()+1).padStart(2,'0')}-${String(initialStart.getDate()).padStart(2,'0')}`;
    const initialEndStr = `${initialEnd.getFullYear()}-${String(initialEnd.getMonth()+1).padStart(2,'0')}-${String(initialEnd.getDate()).padStart(2,'0')}`;

    const timeMatch = item.desc ? item.desc.match(/\((\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\)/) : null;
    const timeRange = timeMatch ? timeMatch[1] : '';

    let regularDates = getItemAllPlayingDates(item);
    let currentStartDateStr = initialStartStr;
    let currentEndDateStr = initialEndStr;

    if (regularDates.length === 0 && (!item.addedDates || item.addedDates.length === 0)) {
        Swal.fire('Thông báo', 'Không tìm thấy ngày chơi nào!', 'warning');
        return;
    }

    let currentSkipped = Array.isArray(item.skipped) ? [...item.skipped] : [];
    let currentAdded = Array.isArray(item.addedDates) ? [...item.addedDates] : [];

    const hasMultipleSimilarCourts = billItems.filter(i => {
        if (i.id === item.id) return false;
        const w1 = JSON.stringify((i.weekdays || []).slice().sort());
        const w2 = JSON.stringify((item.weekdays || []).slice().sort());
        return w1 === w2;
    }).length > 0;

    function recalcRegularDates(startStr, endStr) {
        const tempItem = { ...item, startDateStr: startStr, endDateStr: endStr };
        return getItemAllPlayingDates(tempItem);
    }

    function formatDescFromDates(startStr, endStr) {
        const [sy, sm, sd] = startStr.split('-').map(Number);
        const [ey, em, ed] = endStr.split('-').map(Number);
        const dateDesc = `${sd}/${sm} - ${ed}/${em}/${ey}`;
        return timeRange ? `${dateDesc} (${timeRange})` : dateDesc;
    }

    const similarCourtsHtml = hasMultipleSimilarCourts ? '<label class="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 cursor-pointer"><input type="checkbox" id="swal-apply-similar" class="rounded text-amber-600 focus:ring-amber-500 w-4 h-4" checked><span>Đồng thời áp dụng các thay đổi này cho các sân khác cùng thứ trong phiếu</span></label>' : '';

    const modalContentHtml = `
        <div class="text-left space-y-3">
            <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-2">
                <div><span class="font-bold text-gray-800">Dịch vụ:</span> <span class="text-indigo-700 font-semibold">${item.name}</span></div>
                <div><span class="font-bold text-gray-800">Đơn giá:</span> ${formatVND(item.price)}/h (${item.duration}h/buổi)</div>
                <div class="pt-1.5 border-t border-gray-200">
                    <label class="block text-xs font-bold text-gray-800 uppercase mb-1.5">
                        <i class="fa-solid fa-calendar-days text-indigo-500 mr-1"></i> Khoảng thời gian:
                    </label>
                    <div class="flex items-center gap-2">
                        <div class="flex-1">
                            <label class="text-[10px] text-gray-500 uppercase block mb-0.5">Từ ngày</label>
                            <input type="date" id="swal-edit-start-date" value="${initialStartStr}"
                                class="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none">
                        </div>
                        <span class="text-gray-400 font-bold mt-4">→</span>
                        <div class="flex-1">
                            <label class="text-[10px] text-gray-500 uppercase block mb-0.5">Đến ngày</label>
                            <input type="date" id="swal-edit-end-date" value="${initialEndStr}"
                                class="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none">
                        </div>
                    </div>
                    <p id="swal-date-range-info" class="text-[11px] text-indigo-600 font-medium mt-1">
                        <i class="fa-solid fa-circle-info mr-0.5"></i> Khung giờ: ${item.desc}
                    </p>
                </div>
            </div>

            <div class="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5">
                <label class="block text-xs font-bold text-indigo-900 uppercase mb-1">
                    <i class="fa-solid fa-calendar-plus text-indigo-600 mr-1"></i> Thêm ngày bất kỳ (Chơi bù / Đột xuất):
                </label>
                <div class="flex items-center gap-2">
                    <input type="date" id="swal-schedule-add-date" class="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none flex-1">
                    <button type="button" id="swal-btn-add-date" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold inline-flex items-center gap-1 shadow-sm transition cursor-pointer">
                        <i class="fa-solid fa-plus"></i> Thêm vào lịch
                    </button>
                </div>
                <p class="text-[11px] text-gray-500 mt-1">Chọn bất kỳ ngày nào từ lịch để bổ sung buổi chơi vào phiếu.</p>
            </div>

            <div class="flex justify-between items-center pt-1">
                <span class="text-xs font-bold text-gray-700 uppercase">
                    <i class="fa-solid fa-list-check text-gray-500 mr-1"></i> Bấm ngày để Trừ nghỉ / Bớt ngày:
                </span>
                <div class="flex gap-1.5 text-xs">
                    <button type="button" id="swal-btn-suggest-holiday" class="text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-medium cursor-pointer" title="Tự động trừ các ngày trùng lễ tết">
                        <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Gợi ý Lễ
                    </button>
                    <button type="button" id="swal-btn-clear-skipped" class="text-[11px] text-gray-700 hover:text-gray-900 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded cursor-pointer">Chơi đủ</button>
                    <button type="button" id="swal-btn-reset-all" class="text-[11px] text-red-600 hover:text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded cursor-pointer">Khôi phục gốc</button>
                </div>
            </div>

            <div id="swal-schedule-dates-container" class="max-h-56 overflow-y-auto space-y-1.5 p-1 border rounded-lg bg-gray-50/50"></div>

            ${similarCourtsHtml}

            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-950 space-y-1">
                <div class="flex justify-between"><span class="text-gray-600">Lịch định kỳ ban đầu:</span><span class="font-bold text-gray-800" id="swal-calc-original">${regularDates.length} buổi</span></div>
                <div class="flex justify-between text-red-600"><span>Trừ ngày nghỉ (bớt ngày):</span><span class="font-bold" id="swal-calc-skipped">-0 buổi</span></div>
                <div class="flex justify-between text-emerald-700"><span>Thêm ngày chơi bù / đột xuất:</span><span class="font-bold" id="swal-calc-added">+0 buổi</span></div>
                <div class="flex justify-between text-blue-700 font-bold border-t border-indigo-200 pt-1 text-sm"><span>Số buổi thực tế thanh toán:</span><span id="swal-calc-final-sessions" class="font-bold text-base">... buổi</span></div>
                <div class="flex justify-between text-indigo-900 font-bold text-sm"><span>Thành tiền mới:</span><span id="swal-calc-final-total" class="text-base text-indigo-600 font-extrabold">... ₫</span></div>
            </div>
        </div>
    `;

    Swal.fire({
        title: 'Sửa Lịch (Thêm / Bớt Ngày)',
        html: modalContentHtml,
        width: 540,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> Áp Dụng Lịch Mới',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#4f46e5',
        focusConfirm: false,
        didOpen: () => {
            const container = document.getElementById('swal-schedule-dates-container');
            const calcOriginal = document.getElementById('swal-calc-original');
            const calcSkipped = document.getElementById('swal-calc-skipped');
            const calcAdded = document.getElementById('swal-calc-added');
            const calcFinalSessions = document.getElementById('swal-calc-final-sessions');
            const calcFinalTotal = document.getElementById('swal-calc-final-total');
            const dateRangeInfo = document.getElementById('swal-date-range-info');
            const inputStartDate = document.getElementById('swal-edit-start-date');
            const inputEndDate = document.getElementById('swal-edit-end-date');

            function isDateSkipped(dObj) {
                return currentSkipped.some(s => {
                    if (s === dObj.dateStr || s === dObj.shortDateStr) return true;
                    const parts = s.split('/').map(Number);
                    if (parts.length >= 2) return parts[0] === dObj.date.getDate() && parts[1] === (dObj.date.getMonth() + 1);
                    return false;
                });
            }

            function updateLiveCalculation() {
                const skippedCount = currentSkipped.length;
                const addedCount = currentAdded.length;
                const finalSessions = Math.max(0, regularDates.length - skippedCount + addedCount);
                const finalTotal = finalSessions * item.duration * item.price;
                if (calcOriginal) calcOriginal.textContent = `${regularDates.length} buổi`;
                if (calcSkipped) calcSkipped.textContent = `-${skippedCount} buổi`;
                if (calcAdded) calcAdded.textContent = `+${addedCount} buổi`;
                if (calcFinalSessions) calcFinalSessions.textContent = `${finalSessions} buổi`;
                if (calcFinalTotal) calcFinalTotal.textContent = formatVND(finalTotal);
            }

            function renderDatesList() {
                if (!container) return;
                let html = '';
                if (regularDates.length > 0) {
                    regularDates.forEach((d) => {
                        const skipped = isDateSkipped(d);
                        const dayClass = (d.dayOfWeek === 0 || d.dayOfWeek === 6) ? 'bg-red-50 text-red-600 border-red-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
                        const holidayBadge = d.holidayName ? `<span class="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded border border-red-200"><i class="fa-solid fa-flag"></i> ${d.holidayName}</span>` : '';
                        if (skipped) {
                            html += `<div class="flex items-center justify-between p-2 rounded-lg border border-red-200 bg-red-50/70 transition cursor-pointer hover:bg-red-100/70" onclick="window.swalToggleSkipDate('${d.dateStr}')"><div class="flex items-center gap-2.5"><input type="checkbox" checked class="w-4 h-4 text-red-600 rounded border-gray-300 pointer-events-none"><div><div class="flex items-center gap-1.5"><span class="font-bold text-gray-400 line-through text-xs sm:text-sm">${d.dateStr}</span><span class="text-[11px] font-semibold px-1.5 py-0.2 rounded border bg-gray-100 text-gray-400">${d.dayName}</span><span class="text-[11px] font-bold px-1.5 py-0.2 rounded bg-red-200 text-red-800 border border-red-300"><i class="fa-solid fa-ban mr-1"></i>Trừ nghỉ</span></div>${holidayBadge ? '<div class="mt-0.5">'+holidayBadge+'</div>' : ''}</div></div><span class="text-xs font-semibold text-red-500">-1 buổi</span></div>`;
                        } else {
                            html += `<div class="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50/40 transition cursor-pointer" onclick="window.swalToggleSkipDate('${d.dateStr}')"><div class="flex items-center gap-2.5"><input type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-gray-300 pointer-events-none"><div><div class="flex items-center gap-1.5"><span class="font-bold text-gray-800 text-xs sm:text-sm">${d.dateStr}</span><span class="text-[11px] font-semibold px-1.5 py-0.2 rounded border ${dayClass}">${d.dayName}</span>${holidayBadge ? holidayBadge : ''}</div></div></div><span class="text-xs font-semibold text-emerald-700">Chơi (+1)</span></div>`;
                        }
                    });
                }
                if (currentAdded.length > 0) {
                    html += `<div class="pt-2 mt-2 border-t border-dashed border-gray-300"><div class="text-xs font-bold text-emerald-800 mb-1 uppercase flex items-center gap-1"><i class="fa-solid fa-calendar-plus text-emerald-600"></i> Các ngày đã thêm bù (${currentAdded.length}):</div><div class="space-y-1.5">`;
                    currentAdded.forEach(dateStr => {
                        const [d, m, y] = dateStr.split('/').map(Number);
                        const dObj = new Date(y, m - 1, d);
                        const dow = dObj.getDay();
                        const dayName = dow === 0 ? 'Chủ Nhật' : `Thứ ${dow + 1}`;
                        html += `<div class="flex items-center justify-between p-2 rounded-lg border border-emerald-300 bg-emerald-50/80 transition"><div class="flex items-center gap-2"><span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white"><i class="fa-solid fa-plus mr-1"></i>Thêm bù</span><span class="font-bold text-gray-800 text-xs sm:text-sm">${dateStr}</span><span class="text-[11px] font-semibold px-1.5 py-0.2 rounded border bg-white text-emerald-800 border-emerald-200">${dayName}</span></div><div class="flex items-center gap-2"><span class="text-xs font-bold text-emerald-700">+1 buổi</span><button type="button" onclick="window.swalRemoveAddedDate('${dateStr}')" class="text-gray-400 hover:text-red-600 p-1 transition cursor-pointer"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
                    });
                    html += `</div></div>`;
                }
                container.innerHTML = html;
                updateLiveCalculation();
            }

            function onDateRangeChange() {
                const newStart = inputStartDate.value;
                const newEnd = inputEndDate.value;
                if (!newStart || !newEnd) return;
                if (new Date(newStart) > new Date(newEnd)) {
                    dateRangeInfo.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-0.5 text-red-500"></i> <span class="text-red-600">Ngày bắt đầu phải trước ngày kết thúc!</span>';
                    return;
                }
                currentStartDateStr = newStart;
                currentEndDateStr = newEnd;
                regularDates = recalcRegularDates(newStart, newEnd);
                currentSkipped = currentSkipped.filter(s => regularDates.some(rd => rd.dateStr === s || rd.shortDateStr === s));
                const newDesc = formatDescFromDates(newStart, newEnd);
                dateRangeInfo.innerHTML = `<i class="fa-solid fa-circle-info mr-0.5"></i> Khung giờ: ${newDesc}`;
                renderDatesList();
            }

            inputStartDate.addEventListener('change', onDateRangeChange);
            inputEndDate.addEventListener('change', onDateRangeChange);

            window.swalToggleSkipDate = function(dateStr) {
                const idx = currentSkipped.indexOf(dateStr);
                if (idx > -1) { currentSkipped.splice(idx, 1); } else { currentSkipped.push(dateStr); }
                renderDatesList();
            };
            window.swalRemoveAddedDate = function(dateStr) {
                currentAdded = currentAdded.filter(d => d !== dateStr);
                renderDatesList();
            };

            const btnAddDate = document.getElementById('swal-btn-add-date');
            const inputAddDate = document.getElementById('swal-schedule-add-date');
            if (btnAddDate && inputAddDate) {
                btnAddDate.addEventListener('click', () => {
                    const rawVal = inputAddDate.value;
                    if (!rawVal) { Swal.showValidationMessage('Vui lòng chọn một ngày!'); setTimeout(() => Swal.resetValidationMessage(), 2500); return; }
                    const [y, m, d] = rawVal.split('-').map(Number);
                    const formattedDateStr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                    const matchingRegular = regularDates.find(rd => rd.dateStr === formattedDateStr);
                    if (matchingRegular) {
                        const skippedIdx = currentSkipped.indexOf(formattedDateStr);
                        if (skippedIdx > -1) { currentSkipped.splice(skippedIdx, 1); inputAddDate.value = ''; renderDatesList(); return; }
                        else { Swal.showValidationMessage(`Ngày ${formattedDateStr} đã có sẵn!`); setTimeout(() => Swal.resetValidationMessage(), 2500); return; }
                    }
                    if (currentAdded.includes(formattedDateStr)) { Swal.showValidationMessage(`Ngày ${formattedDateStr} đã được thêm!`); setTimeout(() => Swal.resetValidationMessage(), 2500); return; }
                    currentAdded.push(formattedDateStr);
                    currentAdded.sort((a, b) => { const [d1,m1,y1]=a.split('/').map(Number); const [d2,m2,y2]=b.split('/').map(Number); return new Date(y1,m1-1,d1)-new Date(y2,m2-1,d2); });
                    inputAddDate.value = '';
                    renderDatesList();
                });
            }

            const btnSuggest = document.getElementById('swal-btn-suggest-holiday');
            if (btnSuggest) { btnSuggest.addEventListener('click', () => { regularDates.forEach(d => { if (d.holidayName && !currentSkipped.includes(d.dateStr)) currentSkipped.push(d.dateStr); }); renderDatesList(); }); }

            const btnClearSkipped = document.getElementById('swal-btn-clear-skipped');
            if (btnClearSkipped) { btnClearSkipped.addEventListener('click', () => { currentSkipped = []; renderDatesList(); }); }

            const btnResetAll = document.getElementById('swal-btn-reset-all');
            if (btnResetAll) {
                btnResetAll.addEventListener('click', () => {
                    currentSkipped = []; currentAdded = [];
                    currentStartDateStr = initialStartStr; currentEndDateStr = initialEndStr;
                    inputStartDate.value = initialStartStr; inputEndDate.value = initialEndStr;
                    regularDates = getItemAllPlayingDates(item);
                    dateRangeInfo.innerHTML = `<i class="fa-solid fa-circle-info mr-0.5"></i> Khung giờ: ${item.desc}`;
                    renderDatesList();
                });
            }
            renderDatesList();
        },
        willClose: () => { delete window.swalToggleSkipDate; delete window.swalRemoveAddedDate; },
        preConfirm: () => {
            const applySimilar = document.getElementById('swal-apply-similar')?.checked || false;
            return { skipped: currentSkipped, addedDates: currentAdded, applySimilar, newStartDate: currentStartDateStr, newEndDate: currentEndDateStr };
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const { skipped, addedDates, applySimilar, newStartDate, newEndDate } = result.value;
            const dateChanged = (newStartDate !== initialStartStr || newEndDate !== initialEndStr);
            if (dateChanged) {
                item.startDateStr = newStartDate; item.endDateStr = newEndDate;
                item.desc = formatDescFromDates(newStartDate, newEndDate);
                regularDates = recalcRegularDates(newStartDate, newEndDate);
            }
            item.originalCount = regularDates.length;
            item.skipped = skipped; item.addedDates = addedDates;
            item.count = Math.max(0, regularDates.length - skipped.length + addedDates.length);
            item.total = item.count * item.duration * item.price;

            let affectedCount = 1;
            if (applySimilar) {
                const itemWeekdaysKey = JSON.stringify((item.weekdays || []).slice().sort());
                billItems.forEach(otherItem => {
                    if (otherItem.id !== item.id) {
                        const otherWeekdaysKey = JSON.stringify((otherItem.weekdays || []).slice().sort());
                        if (otherWeekdaysKey === itemWeekdaysKey) {
                            if (dateChanged) { otherItem.startDateStr = newStartDate; otherItem.endDateStr = newEndDate; otherItem.desc = formatDescFromDates(newStartDate, newEndDate); }
                            const otherDates = getItemAllPlayingDates(otherItem);
                            otherItem.originalCount = otherDates.length; otherItem.skipped = [...skipped]; otherItem.addedDates = [...addedDates];
                            otherItem.count = Math.max(0, otherDates.length - skipped.length + addedDates.length);
                            otherItem.total = otherItem.count * otherItem.duration * otherItem.price;
                            affectedCount++;
                        }
                    }
                });
            }
            renderInvoice();
            Swal.fire({
                icon: 'success', title: 'Đã cập nhật lịch & Mã QR!',
                html: `Đã áp dụng cho <b>${affectedCount}</b> dòng sân.${dateChanged ? '<br><span class="text-xs text-orange-600 font-semibold"><i class="fa-solid fa-calendar-days mr-1"></i>Khoảng thời gian đã được cập nhật!</span>' : ''}<br>Số buổi mới: <b>${item.count} buổi</b> | Thành tiền: <b>${formatVND(item.total)}</b>.<br><span class="text-xs text-indigo-600 font-semibold"><i class="fa-solid fa-qrcode mr-1"></i>Mã QR VietQR đã tự động cập nhật!</span>`,
                timer: 2500, showConfirmButton: false
            });
        }
    });
}
// Giữ lại các alias cũ để đảm bảo tương thích ngược
const openExcludeModalForItem = openScheduleEditModalForItem;
const clearExcludeDatesForItem = resetScheduleForItem;

function switchTab(tabName) {
    if (currentUser && currentUser.role !== 'admin') {
        const tabPermMap = {
            'booking': 'booking_view',
            'config': 'config_view',
            'reports': 'reports_view',
            'customers': 'customers_view',
            'settings': 'settings_view',
            'staff': 'staff_view'
        };
        const reqPerm = tabPermMap[tabName];
        if (reqPerm && !hasPermission(reqPerm)) {
            Swal.fire({
                icon: 'warning',
                title: 'Không có quyền truy cập',
                text: 'Tài khoản của bạn không được phân quyền xem phân hệ này!',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }
    }

    document.querySelectorAll('[id^="tab-booking"], [id^="tab-config"], [id^="tab-reports"], [id^="tab-settings"], [id^="tab-customers"], [id^="tab-staff"]').forEach(el => el.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');
    
    const btnBooking = document.getElementById('tab-btn-booking');
    const btnConfig = document.getElementById('tab-btn-config');
    const btnReports = document.getElementById('tab-btn-reports');
    const btnCustomers = document.getElementById('tab-btn-customers');
    const btnSettings = document.getElementById('tab-btn-settings');
    const btnStaff = document.getElementById('tab-btn-staff');
    
    const activeClass = "tab-active py-4 px-1 inline-flex items-center text-sm border-b-2 border-indigo-600 font-bold text-indigo-700 cursor-pointer whitespace-nowrap";
    const inactiveClass = "tab-inactive py-4 px-1 inline-flex items-center text-sm border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-800 transition cursor-pointer whitespace-nowrap";

    [btnBooking, btnConfig, btnReports, btnCustomers, btnSettings, btnStaff].forEach(btn => { if(btn) btn.className = inactiveClass; });

    if(tabName === 'booking') {
        if(btnBooking) btnBooking.className = activeClass;
    } else if(tabName === 'config') {
        if(btnConfig) btnConfig.className = activeClass;
        renderConfigTable();
    } else if(tabName === 'reports') {
        if(btnReports) btnReports.className = activeClass;
        fetchReports();
    } else if(tabName === 'customers') {
        if(btnCustomers) btnCustomers.className = activeClass;
        renderCustomerTable();
    } else if(tabName === 'settings') {
        if(btnSettings) btnSettings.className = activeClass;
        populateSettingsForm();
    } else if(tabName === 'staff') {
        if(btnStaff) btnStaff.className = activeClass;
        renderStaffTable();
    }
}
function backupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pricingRules));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "bang_gia_san_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}
function restoreData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(Array.isArray(data)) {
                pricingRules = data;
                localStorage.setItem('pricingRules', JSON.stringify(pricingRules));
                renderConfigTable();
                Swal.fire('Thành công', 'Đã khôi phục dữ liệu!', 'success');
            } else throw new Error("Format lỗi");
        } catch(err) { Swal.fire('Lỗi', 'File không hợp lệ', 'error'); }
    };
    reader.readAsText(file);
    input.value = '';
}
function renderConfigTable() {
    const tbody = document.getElementById('config-table-body');
    tbody.innerHTML = '';
    pricingRules.forEach(rule => {
        const daysText = rule.days.length === 7 ? 'Tất cả các ngày' : rule.days.map(d => d === 0 ? 'CN' : 'T'+(d+1)).join(', ');
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-gray-50";
        tr.innerHTML = `
            <td class="p-3 border font-medium text-gray-600">${rule.group}</td>
            <td class="p-3 border font-bold text-gray-800">${rule.name}</td>
            <td class="p-3 border text-xs text-gray-500 break-words max-w-xs">${daysText}</td>
            <td class="p-3 border text-center font-mono text-xs">${rule.start} - ${rule.end}</td>
            <td class="p-3 border text-right font-bold text-indigo-600">${formatVND(rule.price)} /h</td>
            <td class="p-3 border text-center">
                <button onclick="editRule(${rule.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteRule(${rule.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
function renderWeekdays(containerId, selectedDays = [], isModal = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const daysMap = [
        {val: 1, label: 'Thứ 2'}, {val: 2, label: 'Thứ 3'}, {val: 3, label: 'Thứ 4'},
        {val: 4, label: 'Thứ 5'}, {val: 5, label: 'Thứ 6'}, {val: 6, label: 'Thứ 7'},
        {val: 0, label: 'CN'}
    ];
    daysMap.forEach(d => {
        const isChecked = selectedDays.includes(d.val);
        const nameAttr = isModal ? 'modal-weekday' : 'weekday';
        container.innerHTML += `
            <label class="cursor-pointer select-none">
                <input type="checkbox" name="${nameAttr}" value="${d.val}" class="hidden peer weekday-check" ${isChecked ? 'checked' : ''}>
                <div class="px-3 py-1.5 rounded border border-gray-200 bg-white text-gray-500 text-xs font-medium transition-all hover:bg-gray-50 flex items-center gap-1">
                    <i class="fa-solid fa-check check-icon hidden text-[10px]"></i>
                    ${d.label}
                </div>
            </label>
        `;
    });
}
function closeModal() { document.getElementById('rule-modal').classList.add('hidden'); }
function addNewRule() {
    currentEditingRuleId = null;
    document.getElementById('modal-title').textContent = "Thêm Quy Tắc Mới";
    document.getElementById('rule-name').value = "";
    document.getElementById('rule-price').value = "";
    document.getElementById('rule-start').value = "06:00";
    document.getElementById('rule-end').value = "22:00";
    renderWeekdays('rule-days-container', [], true);
    document.getElementById('rule-modal').classList.remove('hidden');
}
function editRule(id) {
    currentEditingRuleId = id;
    const rule = pricingRules.find(r => r.id === id);
    if(!rule) return;
    document.getElementById('modal-title').textContent = "Sửa Quy Tắc";
    document.getElementById('rule-group').value = rule.group;
    document.getElementById('rule-name').value = rule.name;
    document.getElementById('rule-price').value = rule.price;
    document.getElementById('rule-start').value = rule.start;
    document.getElementById('rule-end').value = rule.end;
    renderWeekdays('rule-days-container', rule.days, true);
    document.getElementById('rule-modal').classList.remove('hidden');
}
function saveRule() {
    const group = document.getElementById('rule-group').value;
    const name = document.getElementById('rule-name').value;
    const price = parseInt(document.getElementById('rule-price').value) || 0;
    const start = document.getElementById('rule-start').value;
    const end = document.getElementById('rule-end').value;
    const days = [];
    document.querySelectorAll('input[name="modal-weekday"]:checked').forEach(cb => days.push(parseInt(cb.value)));
    if(!name || days.length === 0) { Swal.fire('Lỗi', 'Nhập tên và chọn ngày!', 'error'); return; }
    if(currentEditingRuleId) {
        const idx = pricingRules.findIndex(r => r.id === currentEditingRuleId);
        if(idx !== -1) pricingRules[idx] = { id: currentEditingRuleId, group, name, days, start, end, price };
    } else {
        const newId = Date.now();
        pricingRules.push({ id: newId, group, name, days, start, end, price });
    }
    syncRulesToFirebase();
    renderConfigTable();
    closeModal();
}
function deleteRule(id) {
    if (!hasPermission('config_delete')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền xóa quy tắc bảng giá!', 'error');
    }
    if(confirm("Xóa quy tắc này?")) {
        pricingRules = pricingRules.filter(r => r.id !== id);
        syncRulesToFirebase();
        renderConfigTable();
    }
}

async function fetchReports() {
    const tbody = document.getElementById('report-table-body');
    const emptyMsg = document.getElementById('empty-report-msg');
    const totalRevEl = document.getElementById('total-revenue-report');
    const totalDebtEl = document.getElementById('total-debt-report');
    
    if(!tbody || !db) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i> Đang tính toán dữ liệu...</td></tr>';
    
    // Get filter values
    const filterPreset = document.getElementById('filter-date-preset') ? document.getElementById('filter-date-preset').value : 'this_month';
    const filterStatus = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
    const filterStart = document.getElementById('filter-start') ? document.getElementById('filter-start').value : '';
    const filterEnd = document.getElementById('filter-end') ? document.getElementById('filter-end').value : '';
    const filterCustName = document.getElementById('filter-cust-name') ? document.getElementById('filter-cust-name').value.trim() : '';
    const filterCustPhone = document.getElementById('filter-cust-phone') ? document.getElementById('filter-cust-phone').value.trim() : '';

    const today = new Date();
    today.setHours(0,0,0,0);

    let startLimit = null;
    let endLimit = null;

    if (filterPreset === 'today') {
        startLimit = new Date(); startLimit.setHours(0,0,0,0);
        endLimit = new Date(); endLimit.setHours(23,59,59,999);
    } else if (filterPreset === 'this_month') {
        startLimit = new Date(today.getFullYear(), today.getMonth(), 1);
        endLimit = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filterPreset === 'last_month') {
        startLimit = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endLimit = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    } else if (filterPreset === 'custom' && filterStart) {
        startLimit = new Date(filterStart); startLimit.setHours(0,0,0,0);
        if (filterEnd) {
            endLimit = new Date(filterEnd); endLimit.setHours(23,59,59,999);
        } else {
            endLimit = new Date(); endLimit.setHours(23,59,59,999);
        }
    }

    if(unsubscribeReports) {
        unsubscribeReports();
        unsubscribeReports = null;
    }

    try {
        unsubscribeReports = db.collection('transactions').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            
            // Xử lý chuông thông báo Realtime
            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const data = change.doc.data();
                const newStatus = data.status || 'paid';
                
                if (change.type === 'added') {
                    knownTransactions[docId] = newStatus;
                    // Kích hoạt chuông thông báo nếu là giao dịch trả trước mới được tạo từ webhook
                    if (newStatus === 'paid' && (docId === currentInvoiceId || data.prePaid)) {
                        showPaymentNotification(data.customerName || 'Khách', data.transferAmount || data.totalAmount, data.id || docId.slice(0,6).toUpperCase());
                    }
                } else if (change.type === 'modified') {
                    if (knownTransactions[docId] === 'unpaid' && newStatus === 'paid') {
                        // Kích hoạt chuông thông báo tiền về
                        showPaymentNotification(data.customerName, data.totalAmount, data.id || docId.slice(0,6).toUpperCase());
                    }
                    knownTransactions[docId] = newStatus;
                } else if (change.type === 'removed') {
                    delete knownTransactions[docId];
                }
            });

            // Lưu bộ nhớ đệm tất cả giao dịch phục vụ tra cứu lịch sử khách
            cachedTransactions = snapshot.docs.map(d => ({ docId: d.id, ...d.data() }));

            tbody.innerHTML = '';
            let totalRev = 0;
            let totalDebt = 0;
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                const docId = doc.id;
                
                // Lọc theo thời gian
                let createdAtDate = null;
                if (data.createdAt && data.createdAt.toDate) {
                    createdAtDate = data.createdAt.toDate();
                } else {
                    createdAtDate = new Date(); // Fallback for pending writes
                }

                if (startLimit && createdAtDate < startLimit) return;
                if (endLimit && createdAtDate > endLimit) return;

                // Lọc theo trạng thái
                const status = data.status || 'paid';
                if (filterStatus !== 'all' && filterStatus !== status) return;

                // Lọc theo tên khách hàng (hỗ trợ tiếng Việt có dấu và không dấu)
                if (filterCustName) {
                    const cName = data.customerName || '';
                    const normCust = removeVietnameseTones(cName);
                    const normSearch = removeVietnameseTones(filterCustName);
                    if (!normCust.includes(normSearch) && !cName.toLowerCase().includes(filterCustName.toLowerCase())) {
                        return;
                    }
                }

                // Lọc theo số điện thoại
                if (filterCustPhone) {
                    const cPhone = (data.customerPhone || '').replace(/\D/g, '');
                    const sPhone = filterCustPhone.replace(/\D/g, '');
                    if (sPhone) {
                        if (!cPhone.includes(sPhone)) return;
                    } else {
                        if (!(data.customerPhone || '').toLowerCase().includes(filterCustPhone.toLowerCase())) return;
                    }
                }

                count++;
                const amount = data.totalAmount || 0;
                
                const currentPaidAmount = data.paidAmount !== undefined ? data.paidAmount : (status === 'paid' ? amount : 0);
                const currentRemainingAmount = data.remainingAmount !== undefined ? data.remainingAmount : (status === 'paid' ? 0 : amount);
                
                totalRev += currentPaidAmount;
                if (status !== 'paid') totalDebt += currentRemainingAmount;
                
                let timeStr = `${createdAtDate.getHours().toString().padStart(2, '0')}:${createdAtDate.getMinutes().toString().padStart(2, '0')} - ${createdAtDate.getDate()}/${createdAtDate.getMonth()+1}/${createdAtDate.getFullYear()}`;

                let startDateStr = data.startDate || '---';
                let endDateStr = data.endDate || '---';
                if(startDateStr && startDateStr.includes('-')) { const [y,m,d] = startDateStr.split('-'); startDateStr = `${d}/${m}/${y}`; }
                if(endDateStr && endDateStr.includes('-')) { const [y,m,d] = endDateStr.split('-'); endDateStr = `${d}/${m}/${y}`; }

                const itemsDesc = (data.items || []).map(i => {
                    const daysText = (i.weekdays || []).map(d => d === 0 ? 'CN' : 'T'+(d+1)).join(', ');
                    const skippedText = (i.skipped && i.skipped.length > 0) ? `<div class="text-[10px] text-red-500 italic">Trừ: ${i.skipped.join(', ')}</div>` : '';
                    return `<div class="text-xs text-gray-700 font-medium mb-1">• ${i.name} - ${i.count} buổi (${i.duration}h)<div class="text-[10px] text-indigo-600">Thứ: ${daysText}</div>${skippedText}</div>`;
                }).join('');

                const subTotal = data.subTotal || 0;
                const vatAmount = data.vatAmount || 0;
                const invId = data.id || `CŨ-${docId.slice(0,6).toUpperCase()}`;

                let statusHtml = '';
                if (status === 'unpaid') {
                    statusHtml = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">Chưa TT</span>`;
                } else if (status === 'partial') {
                    statusHtml = `<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">TT 1 Phần</span>`;
                } else if (status === 'overpaid') {
                    statusHtml = `<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">Trả Thừa</span>`;
                } else {
                    statusHtml = `<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">Đã TT</span>`;
                }

                // Lưu dữ liệu vào data attribute để dùng cho modal
                const dataStr = encodeURIComponent(JSON.stringify({...data, docId: docId}));

                const tr = document.createElement('tr');
                tr.className = "border-b hover:bg-indigo-50 transition";
                tr.innerHTML = `
                    <td class="p-3 border text-xs font-bold text-indigo-600 whitespace-nowrap cursor-pointer hover:underline" onclick="viewReceipt('${dataStr}')">${invId} <i class="fa-solid fa-up-right-from-square text-[10px] ml-1"></i></td>
                    <td class="p-3 border text-xs text-gray-500 whitespace-nowrap"><i class="fa-regular fa-clock mr-1"></i> ${timeStr}</td>
                    <td class="p-3 border text-center whitespace-nowrap">${statusHtml}</td>
                    <td class="p-3 border font-bold text-gray-800 text-sm">${data.customerName || 'Vãng lai'}</td>
                    <td class="p-3 border text-gray-600 text-xs">${data.customerPhone || '---'}</td>
                    <td class="p-3 border font-bold text-xs ${data.paymentMethod === 'Tiền mặt' ? 'text-green-600' : 'text-blue-600'}">${data.paymentMethod || '---'}</td>
                    <td class="p-3 border text-xs text-gray-500 whitespace-nowrap">${startDateStr}</td>
                    <td class="p-3 border text-xs text-gray-500 whitespace-nowrap">${endDateStr}</td>
                    <td class="p-3 border">${itemsDesc}</td>
                    <td class="p-3 border text-right font-medium text-gray-700">${formatVND(subTotal)}</td>
                    <td class="p-3 border text-right text-sm ${vatAmount > 0 ? 'text-orange-600 font-bold' : 'text-gray-400'}">${vatAmount > 0 ? formatVND(vatAmount) : '---'}</td>
                    <td class="p-3 border text-right font-bold text-indigo-700 text-base">${formatVND(data.totalAmount || 0)}</td>
                    <td class="p-3 border text-center whitespace-nowrap">
                        <button onclick="openRenewModal('${dataStr}')" title="Gia hạn phiếu sang tháng mới (cùng lịch, cùng sân)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-800 transition mr-1">
                            <i class="fa-solid fa-calendar-plus text-xs"></i>
                        </button>
                        <button onclick="editBill('${dataStr}')" title="Sửa phiếu" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition mr-1">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="deleteBill('${docId}', '${invId}')" title="Xóa phiếu" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            if (count === 0) {
                tbody.innerHTML = '';
                if(emptyMsg) emptyMsg.classList.remove('hidden');
            } else {
                if(emptyMsg) emptyMsg.classList.add('hidden');
            }

            if(totalRevEl) totalRevEl.textContent = formatVND(totalRev);
            if(totalDebtEl) totalDebtEl.textContent = formatVND(totalDebt);

        }, e => {
            console.error("Error fetching reports realtime:", e);
            tbody.innerHTML = '<tr><td colspan="12" class="text-center py-6 text-red-500 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i> Lỗi kết nối dữ liệu realtime.</td></tr>';
        });
    } catch (e) {
        console.error("Error setting up snapshot:", e);
    }
}

function resetReportsFilter() {
    const presetEl = document.getElementById('filter-date-preset');
    if (presetEl) presetEl.value = 'this_month';
    const customDates = document.getElementById('filter-custom-dates');
    if (customDates) customDates.classList.add('hidden');
    const startEl = document.getElementById('filter-start');
    if (startEl) startEl.value = '';
    const endEl = document.getElementById('filter-end');
    if (endEl) endEl.value = '';
    const statusEl = document.getElementById('filter-status');
    if (statusEl) statusEl.value = 'all';
    const custNameEl = document.getElementById('filter-cust-name');
    if (custNameEl) custNameEl.value = '';
    const custPhoneEl = document.getElementById('filter-cust-phone');
    if (custPhoneEl) custPhoneEl.value = '';

    fetchReports();
}

// ==========================================
// SETTINGS: Fetch / Save / Apply
// ==========================================

let bankList = [];

async function fetchBankList() {
    try {
        const res = await fetch('https://api.vietqr.io/v2/banks');
        const data = await res.json();
        if(data.code === '00') {
            bankList = data.data;
            const optionsHtml = '<option value="">-- Chọn ngân hàng --</option>' + 
                bankList.map(b => `<option value="${b.bin}">${b.shortName} (${b.name})</option>`).join('');
            
            const pSelect = document.getElementById('s-bank-personal-name');
            const cSelect = document.getElementById('s-bank-company-name');
            if(pSelect) pSelect.innerHTML = optionsHtml;
            if(cSelect) cSelect.innerHTML = optionsHtml;
            
            // Populate lại nếu setting đã load xong trước cả bank
            populateSettingsForm();
        }
    } catch(e) {
        console.error("Lỗi lấy danh sách ngân hàng:", e);
    }
}

function applySettingsToUI() {
    const el = (id) => document.getElementById(id);
    if(el('inv-venue-name')) el('inv-venue-name').textContent = siteSettings.venueName ? (siteSettings.venueName + ' - Phiếu Thanh Toán') : '--- Phiếu Thanh Toán ---';
    if(el('inv-venue-sub')) el('inv-venue-sub').textContent = siteSettings.venueSub || '';
    if(el('inv-venue-address')) el('inv-venue-address').textContent = siteSettings.venueAddress ? ('ĐC: ' + siteSettings.venueAddress) : '';
    renderInvoice();
}

function populateSettingsForm() {
    const el = (id) => document.getElementById(id);
    if(!el('s-venue-name')) return;
    
    el('s-venue-name').value = siteSettings.venueName || '';
    el('s-venue-sub').value = siteSettings.venueSub || '';
    el('s-venue-address').value = siteSettings.venueAddress || '';
    
    const personalBin = siteSettings.bankPersonal.qrString ? siteSettings.bankPersonal.qrString.split('-')[0] : '';
    const companyBin = siteSettings.bankCompany.qrString ? siteSettings.bankCompany.qrString.split('-')[0] : '';

    el('s-bank-personal-name').value = personalBin;
    el('s-bank-personal-accname').value = siteSettings.bankPersonal.accName || '';
    el('s-bank-personal-accnum').value = siteSettings.bankPersonal.accNum || '';

    el('s-bank-company-name').value = companyBin;
    el('s-bank-company-accname').value = siteSettings.bankCompany.accName || '';
    el('s-bank-company-accnum').value = siteSettings.bankCompany.accNum || '';
}

let unsubscribeSettings = null;
async function fetchSettings() {
    if (!db) return;
    if (unsubscribeSettings) {
        unsubscribeSettings();
    }
    try {
        unsubscribeSettings = db.collection('config').doc('settings').onSnapshot(docRef => {
            if (docRef.exists) {
                const d = docRef.data();
                siteSettings.venueName = d.venueName || '';
                siteSettings.venueSub = d.venueSub || '';
                siteSettings.venueAddress = d.venueAddress || '';
                siteSettings.bankPersonal = d.bankPersonal || { name: '', accName: '', accNum: '', qrString: '' };
                siteSettings.bankCompany = d.bankCompany || { name: '', accName: '', accNum: '', qrString: '' };
                applySettingsToUI();
                populateSettingsForm();
            }
        });
    } catch (e) {
        console.warn("Error fetching settings realtime:", e);
    }
}

async function saveSettings() {
    if (!hasPermission('settings_edit_venue') && !hasPermission('settings_edit_bank_personal') && !hasPermission('settings_edit_bank_company')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền sửa cài đặt hệ thống!', 'error');
    }
    if (!db) { Swal.fire('Lỗi', 'Không kết nối được với Firebase!', 'error'); return; }

    const elVal = (id) => document.getElementById(id).value.trim();
    
    const pBin = elVal('s-bank-personal-name');
    const cBin = elVal('s-bank-company-name');
    
    // Tìm tên ngân hàng rút gọn (shortName) từ danh sách
    const pBankObj = bankList.find(b => b.bin === pBin);
    const cBankObj = bankList.find(b => b.bin === cBin);

    siteSettings.venueName = elVal('s-venue-name');
    siteSettings.venueSub = elVal('s-venue-sub');
    siteSettings.venueAddress = elVal('s-venue-address');
    
    const pAccNum = elVal('s-bank-personal-accnum');
    siteSettings.bankPersonal = {
        name: pBankObj ? pBankObj.shortName : '',
        accName: elVal('s-bank-personal-accname').toUpperCase(),
        accNum: pAccNum,
        qrString: pBin && pAccNum ? `${pBin}-${pAccNum}` : ''
    };
    
    const cAccNum = elVal('s-bank-company-accnum');
    siteSettings.bankCompany = {
        name: cBankObj ? cBankObj.shortName : '',
        accName: elVal('s-bank-company-accname').toUpperCase(),
        accNum: cAccNum,
        qrString: cBin && cAccNum ? `${cBin}-${cAccNum}` : ''
    };

    try {
        Swal.fire({ title: 'Đang lưu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await db.collection('config').doc('settings').set(siteSettings);
        applySettingsToUI();
        Swal.fire({ icon: 'success', title: 'Đã lưu cài đặt thành công!', text: 'Thông tin sân và tài khoản đã được cập nhật.', timer: 2000, showConfirmButton: false });
    } catch (e) {
        console.error("Error saving settings:", e);
        Swal.fire('Lỗi', 'Không thể lưu cài đặt. Vui lòng thử lại!', 'error');
    }
}

// ==========================================
// RECEIPT MODAL & STATUS UPDATES
// ==========================================

function viewReceipt(dataStrEncoded) {
    const data = JSON.parse(decodeURIComponent(dataStrEncoded));
    const invId = data.id || `CŨ-${(data.docId || '').slice(0,6).toUpperCase()}`;
    const targetInvoiceDocId = data.id || data.docId;
    const status = data.status || (data.remainingAmount === 0 ? 'paid' : (data.paidAmount > 0 ? 'partial' : 'unpaid'));
    
    // Status text & badge for header
    let headerStatusBadge = '';
    if (status === 'paid') {
        headerStatusBadge = `<span class="ml-2 px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-xs font-bold inline-flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> ĐÃ THANH TOÁN</span>`;
    } else if (status === 'partial') {
        headerStatusBadge = `<span class="ml-2 px-2.5 py-0.5 bg-amber-500 text-white rounded-full text-xs font-bold inline-flex items-center gap-1"><i class="fa-solid fa-circle-half-stroke"></i> TRẢ 1 PHẦN</span>`;
    } else {
        headerStatusBadge = `<span class="ml-2 px-2.5 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold inline-flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> CHƯA THANH TOÁN</span>`;
    }

    document.getElementById('rm-id').innerHTML = `${invId} ${headerStatusBadge}`;
    
    // Xây dựng nội dung chi tiết
    const itemsHtml = (data.items || []).map(i => {
        const daysText = (i.weekdays || []).map(d => d === 0 ? 'CN' : 'T'+(d+1)).join(', ');
        return `<div class="border-b py-2 flex justify-between text-sm">
            <div>
                <p class="font-bold text-gray-800">${i.name}</p>
                <p class="text-xs text-gray-500">Thứ: ${daysText} | ${i.desc || ''}</p>
                ${i.skipped && i.skipped.length > 0 ? `<p class="text-[10px] text-red-600 mt-1 font-medium"><i class="fa-solid fa-calendar-xmark mr-1"></i>Trừ ngày: ${i.skipped.join(', ')}</p>` : ''}
                ${i.addedDates && i.addedDates.length > 0 ? `<p class="text-[10px] text-emerald-600 mt-0.5 font-medium"><i class="fa-solid fa-calendar-plus mr-1"></i>Thêm ngày: ${i.addedDates.join(', ')}</p>` : ''}
            </div>
            <div class="text-right">
                <p class="text-gray-600">${i.count} buổi x ${formatVND(i.price)}</p>
                <p class="font-bold text-indigo-700">${formatVND(i.total)}</p>
            </div>
        </div>`;
    }).join('');

    const modalDiscount = data.discountAmount !== undefined ? data.discountAmount : (data.discount !== undefined ? data.discount : Math.max(0, (data.subTotal || 0) - ((data.totalAmount || 0) - (data.vatAmount || 0))));
    
    // Banner trạng thái thanh toán nổi bật ở đầu phiếu
    let statusBannerHtml = '';
    if (status === 'paid') {
        statusBannerHtml = `
            <div class="mb-4 p-3.5 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-emerald-900 uppercase">Trạng thái: ĐÃ THANH TOÁN ĐỦ</div>
                        <div class="text-[11px] text-emerald-700">Số tiền: <b>${formatVND(data.paidAmount || data.totalAmount || 0)}</b> qua <b>${data.paymentMethod || 'Chuyển khoản'}</b> ${data.manualPaymentLabel ? `(${data.manualPaymentLabel})` : ''}</div>
                    </div>
                </div>
                <span class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-xs">
                    <i class="fa-solid fa-check mr-1"></i> HOÀN TẤT
                </span>
            </div>
        `;
    } else if (status === 'partial') {
        statusBannerHtml = `
            <div class="mb-4 p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xl">
                        <i class="fa-solid fa-circle-half-stroke"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-amber-900 uppercase">Trạng thái: THANH TOÁN MỘT PHẦN</div>
                        <div class="text-[11px] text-gray-700">Đã trả: <b class="text-emerald-700">${formatVND(data.paidAmount || 0)}</b> | Còn thiếu: <b class="text-red-600 font-bold">${formatVND(data.remainingAmount || 0)}</b></div>
                    </div>
                </div>
                <button type="button" onclick="openManualPaymentModal(JSON.parse(decodeURIComponent('${dataStrEncoded}')))" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer transition">
                    <i class="fa-solid fa-hand-holding-dollar"></i> Thu nợ
                </button>
            </div>
        `;
    } else {
        statusBannerHtml = `
            <div class="mb-4 p-3.5 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl">
                        <i class="fa-solid fa-circle-xmark"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-red-900 uppercase">Trạng thái: CHƯA THANH TOÁN</div>
                        <div class="text-[11px] text-red-700">Tổng tiền cần thu: <b class="text-red-700 font-bold">${formatVND(data.remainingAmount !== undefined ? data.remainingAmount : (data.totalAmount || 0))}</b></div>
                    </div>
                </div>
                <button type="button" onclick="openManualPaymentModal(JSON.parse(decodeURIComponent('${dataStrEncoded}')))" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer transition">
                    <i class="fa-solid fa-hand-holding-dollar"></i> Gạch nợ ngay
                </button>
            </div>
        `;
    }

    // Ảnh chứng từ nếu có trên phiếu chính
    const mainProof = data.proofImage || data.manualPaymentProofImage;
    let mainProofHtml = '';
    if (mainProof) {
        window._paymentProofImages = window._paymentProofImages || {};
        window._paymentProofImages[targetInvoiceDocId] = mainProof;
        mainProofHtml = `
            <div class="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <i class="fa-solid fa-receipt text-blue-600 text-xl"></i>
                    <div>
                        <div class="text-xs font-bold text-blue-900">Ủy nhiệm chi / Ảnh chứng từ thanh toán</div>
                        <div class="text-[11px] text-gray-500">${data.manualPaymentLabel || 'Thanh toán chuyển khoản'}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <img src="${mainProof}" class="w-10 h-10 object-cover rounded border border-blue-300 cursor-pointer shadow-xs hover:scale-105 transition" onclick="viewPaymentProofImage('${mainProof}')" title="Bấm để xem ảnh phóng to">
                    <button type="button" onclick="viewPaymentProofImage('${mainProof}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-expand text-xs"></i> Xem ảnh
                    </button>
                </div>
            </div>
        `;
    }

    const html = `
        ${statusBannerHtml}
        ${mainProofHtml}
        <div class="grid grid-cols-2 gap-4 mb-4 text-sm bg-gray-50 p-3 rounded">
            <div><span class="text-gray-500 font-medium">Khách hàng:</span> <br><b>${data.customerName || 'Vãng lai'}</b></div>
            <div><span class="text-gray-500 font-medium">SĐT:</span> <br><b>${data.customerPhone || '---'}</b></div>
            <div><span class="text-gray-500 font-medium">Chi nhánh:</span> <br><b>${data.note || '---'}</b></div>
            <div><span class="text-gray-500 font-medium">Thanh toán:</span> <br><b>${data.paymentMethod || '---'}</b></div>
            ${(data.company || data.taxCode || data.taxAddress) ? `
            <div class="col-span-2 text-xs border-t pt-2 mt-1 bg-white p-2 rounded border border-blue-100">
                <span class="text-blue-800 font-bold uppercase block mb-1"><i class="fa-solid fa-building mr-1"></i> Thông Tin Doanh Nghiệp</span>
                ${data.company ? `<div>Tên Cty: <b>${data.company}</b></div>` : ''}
                ${data.taxCode ? `<div>MST: <b class="font-mono text-blue-700">${data.taxCode}</b></div>` : ''}
                ${data.taxAddress ? `<div>Địa chỉ: <span>${data.taxAddress}</span></div>` : ''}
            </div>` : ''}
            ${data.team ? `<div class="col-span-2 text-xs text-gray-500 italic">Đội bóng: ${data.team}</div>` : ''}
        </div>
        <div class="mb-4">
            <h3 class="font-bold text-gray-700 mb-2 border-b pb-1">DỊCH VỤ ĐÃ ĐẶT</h3>
            ${itemsHtml}
        </div>
        <div class="bg-indigo-50 p-3 rounded text-right space-y-1">
            <p class="text-sm text-gray-600">Tiền hàng: ${formatVND(data.subTotal || 0)}</p>
            ${modalDiscount > 0 ? `<p class="text-sm text-emerald-700 font-medium">Giảm giá: -${formatVND(modalDiscount)}</p>` : ''}
            ${(data.vatAmount && data.vatAmount > 0) ? `<p class="text-sm text-gray-600">Thuế VAT (10%): ${formatVND(data.vatAmount)}</p>` : ''}
            <p class="font-bold text-lg text-indigo-700 mt-2 pt-2 border-t border-indigo-100">Tổng V/A: ${formatVND(data.totalAmount || 0)}</p>
            <p class="text-sm font-bold text-green-700">Đã thanh toán: ${formatVND(data.paidAmount !== undefined ? data.paidAmount : (status==='paid' ? data.totalAmount : 0))}</p>
            <p class="text-sm font-bold ${data.remainingAmount > 0 ? "text-red-600" : (data.remainingAmount < 0 ? "text-purple-600" : "text-gray-600")}">Còn nợ: ${formatVND(data.remainingAmount !== undefined ? data.remainingAmount : (status==='paid' ? 0 : (data.totalAmount||0)))}</p>
        </div>
    `;

    document.getElementById('rm-content').innerHTML = html;

    const historyTableBody = document.getElementById('payment-history-table');
    const historyEmpty = document.getElementById('payment-history-empty');
    if (historyTableBody && historyEmpty && db && targetInvoiceDocId) {
        historyTableBody.innerHTML = '';
        historyEmpty.classList.remove('hidden');
        historyEmpty.textContent = 'Đang tải lịch sử thanh toán...';

        db.collection('transactions').doc(targetInvoiceDocId).collection('payments').orderBy('paidAt', 'desc').get().then(snap => {
            if (snap.empty) {
                historyEmpty.textContent = 'Chưa có giao dịch thanh toán nào.';
            } else {
                historyEmpty.classList.add('hidden');
                snap.forEach(doc => {
                    const payData = doc.data();
                    let dateStr = '---';
                    if (payData.paidAt && payData.paidAt.toDate) {
                        const d = payData.paidAt.toDate();
                        dateStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                    }
                    // Lưu ảnh chứng từ vào global cache để tránh truyền chuỗi Base64 dài vào DOM
                    if (payData.proofImage) {
                        window._paymentProofImages = window._paymentProofImages || {};
                        window._paymentProofImages[doc.id] = payData.proofImage;
                    }

                    let proofBtn = '';
                    if (payData.proofImage) {
                        proofBtn = `
                            <div class="inline-flex items-center gap-1.5 ml-2 cursor-pointer group" onclick="viewPaymentProofImage(window._paymentProofImages['${doc.id}'])" title="Bấm để xem ảnh chứng từ / ủy nhiệm chi">
                                <img src="${payData.proofImage}" class="w-8 h-8 rounded object-cover border border-blue-300 group-hover:scale-110 transition shadow-xs inline-block">
                                <span class="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                    <i class="fa-solid fa-image"></i> Xem bill
                                </span>
                            </div>`;
                    }

                    // Format phương thức thanh toán đẹp mắt
                    let channelDisplay = payData.sepayTransactionId || '---';
                    if (payData.channel === 'company_transfer') {
                        channelDisplay = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200 text-[10px]"><i class="fa-solid fa-building text-blue-600"></i> CK Công ty</span> ${payData.note ? '<span class="text-gray-600 text-[10px] font-normal">(' + escapeVatHtml(payData.note) + ')</span>' : ''}`;
                    } else if (payData.channel === 'wrong_syntax_transfer') {
                        channelDisplay = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold border border-purple-200 text-[10px]"><i class="fa-solid fa-user-tag text-purple-600"></i> CK Sai cú pháp</span> ${payData.note ? '<span class="text-gray-600 text-[10px] font-normal">(' + escapeVatHtml(payData.note) + ')</span>' : ''}`;
                    } else if (payData.channel === 'cash') {
                        channelDisplay = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 text-[10px]"><i class="fa-solid fa-money-bill-wave text-emerald-600"></i> Tiền mặt</span> ${payData.note ? '<span class="text-gray-600 text-[10px] font-normal">(' + escapeVatHtml(payData.note) + ')</span>' : ''}`;
                    }

                    const tr = document.createElement('tr');
                    tr.className = "border-b text-gray-700 hover:bg-gray-50";
                    tr.innerHTML = `
                        <td class="p-2 border text-[11px] font-medium whitespace-nowrap">${dateStr}</td>
                        <td class="p-2 border font-bold text-green-700 text-xs text-right whitespace-nowrap">${formatVND(payData.amount)}</td>
                        <td class="p-2 border font-mono text-[10px] text-gray-700">${channelDisplay}${proofBtn}</td>
                    `;
                    historyTableBody.appendChild(tr);
                });
            }
        }).catch(err => {
            console.error("Lỗi lấy lịch sử thanh toán:", err);
            historyEmpty.textContent = 'Lỗi kết nối khi tải lịch sử thanh toán.';
        });
    }

    const statusContainer = document.getElementById('rm-status-container');
    const statusBtn = document.getElementById('rm-status-btn');
    if (status === 'unpaid' || status === 'partial') {
        if (statusContainer) statusContainer.classList.remove('hidden');
        statusBtn.style.display = 'flex';
        statusBtn.innerHTML = status === 'partial' 
            ? `<i class="fa-solid fa-hand-holding-dollar mr-1.5"></i> Thu nợ còn lại & Xác nhận gạch nợ`
            : `<i class="fa-solid fa-hand-holding-dollar mr-1.5"></i> Xác Nhận Thanh Toán / Gạch Nợ Thủ Công`;
        statusBtn.onclick = () => openManualPaymentModal(data);
    } else {
        if (statusContainer) statusContainer.classList.add('hidden');
        statusBtn.style.display = 'none';
    }

    // Gán sự kiện cho các nút trong modal xem chi tiết
    const renewBtn = document.getElementById('rm-renew-btn');
    const editFullBtn = document.getElementById('rm-edit-full-btn');
    const deleteBtn = document.getElementById('rm-delete-btn');
    const printBtn = document.getElementById('rm-print-btn');
    const printShareBtn = document.getElementById('rm-print-share-btn');
    
    if (renewBtn) renewBtn.onclick = () => { closeReceiptModal(); openRenewModal(dataStrEncoded); };
    if (editFullBtn) editFullBtn.onclick = () => { editFullBill(data.docId, dataStrEncoded); };
    if (deleteBtn) deleteBtn.onclick = () => { closeReceiptModal(); deleteBill(data.docId, invId); };
    if (printBtn) printBtn.onclick = () => { printReceipt(data); };
    if (printShareBtn) printShareBtn.onclick = () => { printAndShareReceipt(data); };

    document.getElementById('receipt-modal').classList.remove('hidden');
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
}

function printReceipt(data) {
    const status = data.status || 'paid';
    const isPaid = (status === 'paid');
    const docTitle = isPaid ? 'HÓA ĐƠN' : 'PHIẾU THANH TOÁN';
    
    // Load dữ liệu vào khu vực invoice chính để in
    const invId = data.id || `CŨ-${(data.docId || '').slice(0,6).toUpperCase()}`;
    currentInvoiceId = invId;
    
    // Set mã phiếu
    document.getElementById('inv-id').textContent = invId;
    
    // Set tiêu đề phiếu
    const venueNameEl = document.getElementById('inv-venue-name');
    venueNameEl.textContent = (siteSettings.venueName || '---') + ' - ' + docTitle;
    
    // Set ngày
    let createdDate = new Date();
    if (data.createdAt && data.createdAt.toDate) {
        createdDate = data.createdAt.toDate();
    } else if (data.createdAt && data.createdAt.seconds) {
        createdDate = new Date(data.createdAt.seconds * 1000);
    }
    document.getElementById('inv-date').textContent = formatDateFull(createdDate);
    
    // Set thông tin khách
    document.getElementById('display-name').textContent = data.customerName || 'Khách Vãng Lai';
    document.getElementById('display-phone').textContent = data.customerPhone || '---';
    if (document.getElementById('display-team')) document.getElementById('display-team').textContent = data.team ? `Đội: ${data.team}` : '';
    document.getElementById('display-company').textContent = data.company ? `Công ty: ${data.company}` : '';
    if (document.getElementById('display-tax-code')) document.getElementById('display-tax-code').textContent = data.taxCode ? `MST: ${data.taxCode}` : '';
    if (document.getElementById('display-tax-address')) document.getElementById('display-tax-address').textContent = data.taxAddress ? `Đ/C: ${data.taxAddress}` : '';
    document.getElementById('display-gender').textContent = '';
    
    // Set hình thức thanh toán
    document.getElementById('print-pay-method').textContent = data.paymentMethod || 'Tiền mặt';
    
    // Set ghi chú
    document.getElementById('print-note').textContent = data.note || '';
    
    // Load items vào bảng invoice
    billItems = (data.items || []).map((item, idx) => ({
        ...item,
        id: Date.now() + idx
    }));
    
    // Set giảm giá
    const discountAmount = data.discountAmount !== undefined ? data.discountAmount : (data.discount !== undefined ? data.discount : Math.max(0, (data.subTotal || 0) - ((data.totalAmount || 0) - (data.vatAmount || 0))));
    if (document.getElementById('discount-type')) document.getElementById('discount-type').value = 'money';
    if (document.getElementById('discount-val')) document.getElementById('discount-val').value = discountAmount || '';
    
    // Set VAT
    const vatAmount = data.vatAmount || 0;
    if (document.getElementById('vat-check')) document.getElementById('vat-check').checked = (vatAmount > 0);
    
    // Render invoice (sẽ tính sub-total từ items)
    renderInvoice();
    
    // Override lại tổng tiền từ dữ liệu gốc để chính xác
    if (document.getElementById('sub-total')) document.getElementById('sub-total').textContent = formatVND(data.subTotal || 0);
    if (document.getElementById('print-discount')) document.getElementById('print-discount').textContent = formatVND(discountAmount);
    const printDiscountRow = document.getElementById('print-discount-row');
    if (printDiscountRow) {
        if (discountAmount > 0) {
            printDiscountRow.classList.remove('no-discount');
        } else {
            printDiscountRow.classList.add('no-discount');
        }
    }
    if (document.getElementById('vat-amount')) document.getElementById('vat-amount').textContent = formatVND(vatAmount);
    if (document.getElementById('final-total')) document.getElementById('final-total').textContent = formatVND(data.totalAmount || 0);
    
    // Nếu đã thanh toán, thêm dòng trạng thái ĐÃ THANH TOÁN
    if (isPaid) {
        document.getElementById('print-note').textContent = (data.note ? data.note + ' | ' : '') + '✅ ĐÃ THANH TOÁN';
    }
    
    // Đóng modal, chờ render xong rồi in
    closeReceiptModal();
    
    setTimeout(() => {
        window.print();
        
        // Sau khi in xong, khôi phục lại trạng thái ban đầu
        setTimeout(() => {
            venueNameEl.textContent = (siteSettings.venueName || '---') + ' - Phiếu Thanh Toán';
            billItems = [];
            generateNewInvoiceId();
            document.getElementById('inv-date').textContent = formatDateFull(new Date());
            document.getElementById('display-name').textContent = '---';
            document.getElementById('display-phone').textContent = '---';
            document.getElementById('display-company').textContent = '';
            document.getElementById('display-gender').textContent = '';
            document.getElementById('print-note').textContent = '';
            document.getElementById('discount-val').value = '';
            document.getElementById('vat-check').checked = false;
            renderInvoice();
        }, 500);
    }, 300);
}

async function printAndShareReceipt(data) {
    const status = data.status || 'paid';
    const isPaid = (status === 'paid');
    const docTitle = isPaid ? 'HÓA ĐƠN' : 'PHIẾU THANH TOÁN';
    
    const invId = data.id || `CŨ-${(data.docId || '').slice(0,6).toUpperCase()}`;
    currentInvoiceId = invId;
    if (document.getElementById('inv-id')) document.getElementById('inv-id').textContent = invId;
    
    const venueNameEl = document.getElementById('inv-venue-name');
    if (venueNameEl) venueNameEl.textContent = (siteSettings.venueName || '---') + ' - ' + docTitle;
    
    let createdDate = new Date();
    if (data.createdAt && data.createdAt.toDate) {
        createdDate = data.createdAt.toDate();
    } else if (data.createdAt && data.createdAt.seconds) {
        createdDate = new Date(data.createdAt.seconds * 1000);
    }
    if (document.getElementById('inv-date')) document.getElementById('inv-date').textContent = formatDateFull(createdDate);
    
    if (document.getElementById('display-name')) document.getElementById('display-name').textContent = data.customerName || 'Khách Vãng Lai';
    if (document.getElementById('display-phone')) document.getElementById('display-phone').textContent = data.customerPhone || '---';
    if (document.getElementById('display-team')) document.getElementById('display-team').textContent = data.team ? `Đội: ${data.team}` : '';
    if (document.getElementById('display-company')) document.getElementById('display-company').textContent = data.company ? `Công ty: ${data.company}` : '';
    if (document.getElementById('display-tax-code')) document.getElementById('display-tax-code').textContent = data.taxCode ? `MST: ${data.taxCode}` : '';
    if (document.getElementById('display-tax-address')) document.getElementById('display-tax-address').textContent = data.taxAddress ? `Đ/C: ${data.taxAddress}` : '';
    if (document.getElementById('display-gender')) document.getElementById('display-gender').textContent = '';
    
    if (document.getElementById('print-pay-method')) document.getElementById('print-pay-method').textContent = data.paymentMethod || 'Tiền mặt';
    if (document.getElementById('print-note')) document.getElementById('print-note').textContent = data.note || '';
    
    billItems = (data.items || []).map((item, idx) => ({
        ...item,
        id: Date.now() + idx
    }));
    
    const discountAmount = data.discountAmount !== undefined ? data.discountAmount : (data.discount !== undefined ? data.discount : Math.max(0, (data.subTotal || 0) - ((data.totalAmount || 0) - (data.vatAmount || 0))));
    if (document.getElementById('discount-type')) document.getElementById('discount-type').value = 'money';
    if (document.getElementById('discount-val')) document.getElementById('discount-val').value = discountAmount || '';
    
    const vatAmount = data.vatAmount || 0;
    if (document.getElementById('vat-check')) document.getElementById('vat-check').checked = (vatAmount > 0);
    
    renderInvoice();
    
    if (document.getElementById('sub-total')) document.getElementById('sub-total').textContent = formatVND(data.subTotal || 0);
    if (document.getElementById('print-discount')) document.getElementById('print-discount').textContent = formatVND(discountAmount);
    const printDiscountRow = document.getElementById('print-discount-row');
    if (printDiscountRow) {
        if (discountAmount > 0) {
            printDiscountRow.classList.remove('no-discount');
        } else {
            printDiscountRow.classList.add('no-discount');
        }
    }
    if (document.getElementById('vat-amount')) document.getElementById('vat-amount').textContent = formatVND(vatAmount);
    if (document.getElementById('final-total')) document.getElementById('final-total').textContent = formatVND(data.totalAmount || 0);
    
    if (isPaid && document.getElementById('print-note')) {
        document.getElementById('print-note').textContent = (data.note ? data.note + ' | ' : '') + '✅ ĐÃ THANH TOÁN';
    }
    
    closeReceiptModal();
    
    // Chụp và hiện popup in / chia sẻ (đợi người dùng xem xong và đóng popup)
    await captureAndShowReceiptPopup();
    
    // Sau khi popup đóng, khôi phục lại trạng thái ban đầu của form chính
    if (venueNameEl) venueNameEl.textContent = (siteSettings.venueName || '---') + ' - Phiếu Thanh Toán';
    billItems = [];
    generateNewInvoiceId();
    if (document.getElementById('inv-date')) document.getElementById('inv-date').textContent = formatDateFull(new Date());
    if (document.getElementById('display-name')) document.getElementById('display-name').textContent = '---';
    if (document.getElementById('display-phone')) document.getElementById('display-phone').textContent = '---';
    if (document.getElementById('display-company')) document.getElementById('display-company').textContent = '';
    if (document.getElementById('display-gender')) document.getElementById('display-gender').textContent = '';
    if (document.getElementById('print-note')) document.getElementById('print-note').textContent = '';
    if (document.getElementById('discount-val')) document.getElementById('discount-val').value = '';
    if (document.getElementById('vat-check')) document.getElementById('vat-check').checked = false;
    renderInvoice();
}


// ==========================================
// XÁC NHẬN THANH TOÁN / GẠCH NỢ THỦ CÔNG (CK CÔNG TY, CK SAI CÚ PHÁP, TIỀN MẶT)
// ==========================================

let currentManualPaymentData = null;
let currentManualPaymentBase64 = null;

function openManualPaymentModal(data) {
    if (!hasPermission('reports_manual_payment')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền thực hiện gạch nợ thủ công!', 'error');
    }
    if (!data) return;
    currentManualPaymentData = data;
    if (!currentManualPaymentData.docId) {
        currentManualPaymentData.docId = currentManualPaymentData.id;
    }
    currentManualPaymentBase64 = null;

    const el = (id) => document.getElementById(id);
    if (!el('manual-payment-modal')) return;

    const invId = data.id || `CŨ-${(data.docId || '').slice(0, 6).toUpperCase()}`;
    const amountToPay = data.remainingAmount !== undefined ? data.remainingAmount : (data.totalAmount || 0);

    el('mpm-invoice-id').textContent = invId;
    el('mpm-customer-name').textContent = data.company ? `${data.company} (${data.customerName || ''})` : (data.customerName || 'Khách vãng lai');
    el('mpm-amount-display').textContent = formatVND(amountToPay);

    // Mặc định chọn hình thức: nếu có công ty -> Chuyển khoản công ty, nếu tiền mặt -> Tiền mặt, còn lại -> CK sai cú pháp
    const radioCompany = document.querySelector('input[name="mpm-channel"][value="company_transfer"]');
    const radioWrongSyntax = document.querySelector('input[name="mpm-channel"][value="wrong_syntax_transfer"]');
    const radioCash = document.querySelector('input[name="mpm-channel"][value="cash"]');

    if (data.company && radioCompany) {
        radioCompany.checked = true;
    } else if (data.paymentMethod === 'Tiền mặt' && radioCash) {
        radioCash.checked = true;
    } else if (radioWrongSyntax) {
        radioWrongSyntax.checked = true;
    }

    if (el('mpm-ref-note')) el('mpm-ref-note').value = '';
    
    // Reset ảnh
    removeManualPaymentImage();

    el('manual-payment-modal').classList.remove('hidden');
    bringModalToFront(el('manual-payment-modal'));
}

function closeManualPaymentModal() {
    const modal = document.getElementById('manual-payment-modal');
    if (modal) modal.classList.add('hidden');
    currentManualPaymentData = null;
    currentManualPaymentBase64 = null;
    syncModalStack();
}

function handleManualPaymentImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        Swal.fire('Lỗi', 'Vui lòng chọn file hình ảnh (JPG, PNG, JPEG)!', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            // Nén ảnh bằng Canvas: tối đa 1280px để giữ nét nhưng dung lượng siêu nhẹ (~80KB - 150KB)
            let width = img.width;
            let height = img.height;
            const maxDimension = 1280;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            currentManualPaymentBase64 = compressedDataUrl;

            const el = (id) => document.getElementById(id);
            if (el('mpm-image-preview')) el('mpm-image-preview').src = compressedDataUrl;
            if (el('mpm-image-preview-box')) el('mpm-image-preview-box').classList.remove('hidden');
            if (el('mpm-upload-placeholder')) el('mpm-upload-placeholder').classList.add('hidden');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

function removeManualPaymentImage() {
    currentManualPaymentBase64 = null;
    const el = (id) => document.getElementById(id);
    if (el('mpm-image-input')) el('mpm-image-input').value = '';
    if (el('mpm-image-preview')) el('mpm-image-preview').src = '';
    if (el('mpm-image-preview-box')) el('mpm-image-preview-box').classList.add('hidden');
    if (el('mpm-upload-placeholder')) el('mpm-upload-placeholder').classList.remove('hidden');
}

function viewPaymentProofImage(imgUrl) {
    if (!imgUrl) return;
    const modal = document.getElementById('comp-image-modal');
    const img = document.getElementById('comp-large-image');
    if (!modal || !img) return;
    img.src = imgUrl;
    modal.classList.remove('hidden');
    bringModalToFront(modal);
}

async function executeManualPayment() {
    if (!db || !currentManualPaymentData) {
        Swal.fire('Lỗi', 'Không tìm thấy dữ liệu phiếu!', 'error');
        return;
    }

    const docId = currentManualPaymentData.docId;
    if (!docId) {
        Swal.fire('Lỗi', 'Mã phiếu không hợp lệ!', 'error');
        return;
    }

    const selectedChannelEl = document.querySelector('input[name="mpm-channel"]:checked');
    const channel = selectedChannelEl ? selectedChannelEl.value : 'company_transfer';

    const channelMap = {
        'company_transfer': { label: 'Chuyển khoản Công ty', method: 'Chuyển khoản', tag: '[CK Công ty]' },
        'wrong_syntax_transfer': { label: 'CK Cá nhân (Sai cú pháp)', method: 'Chuyển khoản', tag: '[CK Sai cú pháp]' },
        'cash': { label: 'Tiền mặt', method: 'Tiền mặt', tag: '[Tiền mặt]' }
    };

    const config = channelMap[channel] || channelMap['company_transfer'];
    const refNote = document.getElementById('mpm-ref-note') ? document.getElementById('mpm-ref-note').value.trim() : '';

    let sepayLabel = config.tag;
    if (refNote) {
        sepayLabel += ` ${refNote}`;
    }

    try {
        Swal.fire({ title: 'Đang gạch nợ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const docRef = db.collection('transactions').doc(docId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            Swal.fire('Lỗi', 'Phiếu không tồn tại trên hệ thống!', 'error');
            return;
        }

        const data = docSnap.data();
        const totalAmount = data.totalAmount || 0;
        const amountToPay = data.remainingAmount !== undefined ? data.remainingAmount : totalAmount;

        const batch = db.batch();

        // 1. Cập nhật phiếu sang trạng thái paid và lưu kèm ảnh ủy nhiệm chi lên phiếu chính
        const updateMainDocPayload = {
            status: 'paid',
            paymentMethod: config.method,
            paidAmount: totalAmount,
            remainingAmount: 0,
            manualPaymentChannel: channel,
            manualPaymentLabel: config.label,
            manualPaymentNote: refNote,
            manualPaymentAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (currentManualPaymentBase64) {
            updateMainDocPayload.proofImage = currentManualPaymentBase64;
            updateMainDocPayload.manualPaymentProofImage = currentManualPaymentBase64;
        }

        batch.update(docRef, updateMainDocPayload);

        // 2. Ghi nhận giao dịch vào collection con 'payments'
        const paymentDocRef = docRef.collection('payments').doc();
        const paymentPayload = {
            amount: amountToPay,
            paidAt: firebase.firestore.FieldValue.serverTimestamp(),
            method: config.method,
            channel: channel,
            channelLabel: config.label,
            note: refNote,
            sepayTransactionId: sepayLabel
        };

        if (currentManualPaymentBase64) {
            paymentPayload.proofImage = currentManualPaymentBase64;
        }

        batch.set(paymentDocRef, paymentPayload);

        await batch.commit();

        // 3. Cập nhật bộ nhớ đệm
        currentManualPaymentData.status = 'paid';
        currentManualPaymentData.paidAmount = totalAmount;
        currentManualPaymentData.remainingAmount = 0;
        currentManualPaymentData.paymentMethod = config.method;
        if (currentManualPaymentBase64) {
            currentManualPaymentData.proofImage = currentManualPaymentBase64;
            currentManualPaymentData.manualPaymentProofImage = currentManualPaymentBase64;
        }

        const cached = cachedTransactions.find(t => (t.id === docId || t.docId === docId));
        if (cached) {
            cached.status = 'paid';
            cached.paidAmount = totalAmount;
            cached.remainingAmount = 0;
            cached.paymentMethod = config.method;
            if (currentManualPaymentBase64) {
                cached.proofImage = currentManualPaymentBase64;
                cached.manualPaymentProofImage = currentManualPaymentBase64;
            }
        }
        const custMatch = currentViewingCustomerInvoices.find(t => (t.id === docId || t.docId === docId));
        if (custMatch) {
            custMatch.status = 'paid';
            custMatch.paidAmount = totalAmount;
            custMatch.remainingAmount = 0;
            custMatch.paymentMethod = config.method;
            if (currentManualPaymentBase64) {
                custMatch.proofImage = currentManualPaymentBase64;
                custMatch.manualPaymentProofImage = currentManualPaymentBase64;
            }
        }

        closeManualPaymentModal();
        closeReceiptModal();
        fetchReports(); // Cập nhật lại danh sách báo cáo chính
        if (currentViewingPhone) {
            loadCustomerInvoices(currentViewingPhone);
        }

        Swal.fire({
            icon: 'success',
            title: 'Gạch Nợ Thành Công!',
            html: `Đã xác nhận thanh toán theo hình thức: <b class="text-emerald-700">${config.label}</b>.<br>Số tiền: <b>${formatVND(amountToPay)}</b>`,
            confirmButtonColor: '#059669',
            confirmButtonText: 'Đã hiểu'
        });

    } catch (e) {
        console.error("Lỗi khi xác nhận thanh toán thủ công:", e);
        Swal.fire('Lỗi', 'Không thể gạch nợ: ' + e.message, 'error');
    }
}

async function confirmPayment(docId) {
    if (!db) return;
    try {
        Swal.fire({ title: 'Đang cập nhật...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const docRef = db.collection('transactions').doc(docId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const amountToPay = data.remainingAmount !== undefined ? data.remainingAmount : (data.totalAmount || 0);
            
            const batch = db.batch();
            batch.update(docRef, { 
                status: 'paid', 
                paidAmount: data.totalAmount || 0, 
                remainingAmount: 0 
            });
            batch.set(docRef.collection('payments').doc(), {
                amount: amountToPay,
                paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                sepayTransactionId: 'Thanh toán trực tiếp'
            });
            await batch.commit();
        }
        closeReceiptModal();
        Swal.fire({ icon: 'success', title: 'Thành công', text: 'Đã cập nhật trạng thái đã thanh toán!', timer: 1500, showConfirmButton: false });
        fetchReports(); // Refresh table
    } catch (e) {
        console.error("Error updating payment:", e);
        Swal.fire('Lỗi', 'Không gạch nợ được. Hãy kiểm tra mạng!', 'error');
    }
}

// ==========================================
// EDIT FULL BILL
// ==========================================

function editFullBill(docId, dataStrEncoded) {
    const data = JSON.parse(decodeURIComponent(dataStrEncoded));
    closeReceiptModal();
    
    Swal.fire({
        title: 'Chuyển sang chế độ Sửa Lịch Đặt?',
        html: "Hệ thống sẽ kéo toàn bộ dữ liệu của hoá đơn hiện tại vào bảng Tính Tiền (thay thế bản nháp đang có).<br><br><b>Bạn có thể tùy ý sửa khách, xóa/thêm sân, giảm giá... Khi bấm Lưu Phiếu, tiền CÔNG NỢ sẽ được hệ thống phân bổ lại hoàn toàn tự động!</b>",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-pen-to-square mr-1"></i> Bắt đầu Sửa',
        cancelButtonText: 'Hủy'
    }).then((result) => {
        if (result.isConfirmed) {
            // Chuyển sang Tab Booking
            switchTab('booking');

            // Set currentInvoiceId
            currentInvoiceId = data.id || `CŨ-${docId.slice(0,6).toUpperCase()}`;
            if (document.getElementById('inv-id')) document.getElementById('inv-id').textContent = currentInvoiceId;
            
            // Đổi giao diện để User biết đang sửa
            document.getElementById('inv-id').parentElement.classList.add('text-orange-600', 'bg-orange-100', 'px-1.5', 'py-0.5', 'rounded');
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            document.getElementById('print-btn-text').textContent = 'Lưu Phiếu (Ghi đè)';
            document.getElementById('print-btn').classList.replace('bg-blue-600', 'bg-orange-600');
            document.getElementById('print-btn').classList.replace('hover:bg-blue-700', 'hover:bg-orange-700');

            // Điền Khách hàng
            if(document.getElementById('cust-name')) document.getElementById('cust-name').value = data.customerName || '';
            if(document.getElementById('cust-phone')) document.getElementById('cust-phone').value = data.customerPhone || '';
            if(document.getElementById('cust-team')) document.getElementById('cust-team').value = data.team || '';
            if(document.getElementById('cust-company')) document.getElementById('cust-company').value = data.company || '';
            if(document.getElementById('cust-tax-code')) document.getElementById('cust-tax-code').value = data.taxCode || '';
            if(document.getElementById('cust-tax-address')) document.getElementById('cust-tax-address').value = data.taxAddress || '';
            
            if (data.company || data.taxCode || data.taxAddress) {
                const bizFields = document.getElementById('cust-biz-fields');
                const toggleIcon = document.getElementById('cust-biz-toggle-icon');
                if (bizFields) bizFields.classList.remove('hidden');
                if (toggleIcon) toggleIcon.classList.add('rotate-180');
            }
            
            // Chọn giới tính nếu có (hoặc để nguyên)
            // Điền Ghi chú
            if(document.getElementById('inv-note')) document.getElementById('inv-note').value = data.note || '';

            // Gọi event để render right panel
            if(document.getElementById('cust-name')) document.getElementById('cust-name').dispatchEvent(new Event('input'));

            // Phân bổ billItems
            billItems = data.items ? JSON.parse(JSON.stringify(data.items)) : [];
            
            // Hình thức thanh toán
            if (data.paymentMethod) {
                const rbs = document.querySelectorAll('input[name="pay-method"]');
                for (const rb of rbs) {
                    if (rb.value === data.paymentMethod) rb.checked = true;
                }
            }
            
            // VAT & Discount logic
            const vatChecked = (data.vatAmount && data.vatAmount > 0);
            if(document.getElementById('vat-check')) document.getElementById('vat-check').checked = vatChecked;
            
            // Calculate discount (stored or backward):
            const discount = data.discountAmount !== undefined ? data.discountAmount : (data.discount !== undefined ? data.discount : (data.subTotal ? Math.max(0, data.subTotal - (data.totalAmount - (data.vatAmount || 0))) : 0));
            if (discount > 0) {
                if (document.getElementById('discount-type')) document.getElementById('discount-type').value = 'money';
                if (document.getElementById('discount-val')) document.getElementById('discount-val').value = discount;
            } else {
                if (document.getElementById('discount-type')) document.getElementById('discount-type').value = 'money';
                if (document.getElementById('discount-val')) document.getElementById('discount-val').value = '';
            }

            renderInvoice();
            
            Swal.fire({
                icon: 'success',
                title: 'Đã sẵn sàng!',
                text: 'Hãy sửa đổi trên bảng Tính Tiền. Xóa sân cũ và bấm Thêm sân mới nếu cần thiết!',
                timer: 4000,
                showConfirmButton: true,
                confirmButtonText: 'Đã hiểu'
            });
        }
    });
}

function cancelEditMode() {
    generateNewInvoiceId();
    document.getElementById('inv-id').parentElement.classList.remove('text-orange-600', 'bg-orange-100', 'p-1', 'px-1.5', 'py-0.5', 'rounded');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('print-btn-text').textContent = 'Lưu & Xuất Phiếu';
    document.getElementById('print-btn').classList.replace('bg-orange-600', 'bg-blue-600');
    document.getElementById('print-btn').classList.replace('hover:bg-orange-700', 'hover:bg-blue-700');
    
    // Clear data
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    if(document.getElementById('cust-team')) document.getElementById('cust-team').value = '';
    document.getElementById('cust-company').value = '';
    if(document.getElementById('cust-tax-code')) document.getElementById('cust-tax-code').value = '';
    if(document.getElementById('cust-tax-address')) document.getElementById('cust-tax-address').value = '';
    document.getElementById('inv-note').value = '';
    document.getElementById('cust-name').dispatchEvent(new Event('input'));
    
    document.getElementById('discount-val').value = '';
    document.getElementById('vat-check').checked = false;
    
    billItems = [];
    renderInvoice();
    Swal.fire('Đã Hủy', 'Trở lại chế độ tạo phiếu mới!', 'info');
}

// ==========================================
// EDIT & DELETE BILL (SỬA NHANH)
// ==========================================

function editBill(dataStrEncoded) {
    const data = JSON.parse(decodeURIComponent(dataStrEncoded));
    const invId = data.id || `CŨ-${data.docId.slice(0,6).toUpperCase()}`;

    // Lưu trạng thái và số tiền đã trả để kiểm tra cảnh báo và tính lại
    document.getElementById('ebm-docid').value = data.docId;
    document.getElementById('ebm-docid').dataset.currentStatus = data.status || 'paid';
    document.getElementById('ebm-docid').dataset.currentPaid = data.paidAmount !== undefined ? data.paidAmount : (data.status === 'paid' ? data.totalAmount : 0);
    document.getElementById('ebm-id').textContent = invId;
    document.getElementById('ebm-name').value = data.customerName || '';
    document.getElementById('ebm-phone').value = data.customerPhone || '';
    document.getElementById('ebm-payment').value = data.paymentMethod || 'Tiền mặt';
    document.getElementById('ebm-status').value = data.status || 'paid';
    document.getElementById('ebm-total').value = data.totalAmount || 0;
    document.getElementById('ebm-note').value = data.note || '';

    document.getElementById('edit-bill-modal').classList.remove('hidden');
}

function closeEditBillModal() {
    document.getElementById('edit-bill-modal').classList.add('hidden');
}

async function saveBillEdit() {
    if (!db) return;
    const docIdEl = document.getElementById('ebm-docid');
    const docId = docIdEl.value;
    const currentStatus = docIdEl.dataset.currentStatus;
    const currentPaid = parseFloat(docIdEl.dataset.currentPaid) || 0;

    const customerName = document.getElementById('ebm-name').value.trim();
    const customerPhone = document.getElementById('ebm-phone').value.trim();
    const paymentMethod = document.getElementById('ebm-payment').value;
    const selectedStatus = document.getElementById('ebm-status').value;
    const totalAmount = parseInt(document.getElementById('ebm-total').value) || 0;
    const note = document.getElementById('ebm-note').value.trim();

    if (!customerName) {
        Swal.fire('Lỗi', 'Vui lòng nhập tên khách hàng!', 'error');
        return;
    }

    if (currentStatus === 'paid' || currentStatus === 'overpaid' || currentStatus === 'partial') {
        const warnResult = await Swal.fire({
            title: 'Cảnh báo chỉnh sửa',
            html: `Phiếu này đã được thanh toán (TT 1 phần / Trả thừa / Đã TT).<br>Nếu bạn thay đổi Tổng Tiền, hệ thống sẽ tự động tính lại công nợ theo số tiền đã đóng. Bạn có chắc chắn?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Đồng ý sửa',
            cancelButtonText: 'Hủy'
        });
        if (!warnResult.isConfirmed) return;
    }

    let remainingAmount = totalAmount - currentPaid;
    let newStatus = selectedStatus;
    let newPaidAmount = currentPaid;
    let manualFullPayment = false;

    if (selectedStatus === 'paid' && currentStatus === 'unpaid' && currentPaid === 0) {
        remainingAmount = 0;
        newPaidAmount = totalAmount;
        newStatus = 'paid';
        manualFullPayment = true;
    } else {
        if (remainingAmount === 0 && currentPaid > 0) newStatus = 'paid';
        else if (remainingAmount > 0 && currentPaid > 0) newStatus = 'partial';
        else if (remainingAmount < 0) newStatus = 'overpaid';
        else if (remainingAmount === totalAmount && currentPaid === 0) newStatus = 'unpaid';
    }

    try {
        Swal.fire({ title: 'Đang lưu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const batch = db.batch();
        const docRef = db.collection('transactions').doc(docId);
        
        batch.update(docRef, {
            customerName,
            customerPhone,
            paymentMethod,
            status: newStatus,
            totalAmount,
            paidAmount: newPaidAmount,
            remainingAmount,
            note
        });

        if (manualFullPayment) {
            batch.set(docRef.collection('payments').doc(), {
                amount: totalAmount,
                paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                sepayTransactionId: 'Sửa bill (Gạch nợ tay)'
            });
        }
        await batch.commit();

        closeEditBillModal();
        Swal.fire({ icon: 'success', title: 'Đã cập nhật phiếu!', timer: 1500, showConfirmButton: false });
        fetchReports(); // Refresh table UI
    } catch (e) {
        console.error('Lỗi sửa bill:', e);
        Swal.fire('Lỗi', 'Không thể cập nhật. Kiểm tra kết nối mạng!', 'error');
    }
}

async function deleteBill(docId, invId) {
    if (!hasPermission('reports_delete_bill')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền xóa phiếu thanh toán!', 'error');
    }
    const result = await Swal.fire({
        title: 'Xác nhận xóa phiếu?',
        html: `Phiếu <b class="text-red-600">${invId}</b> sẽ bị xóa vĩnh viễn và không thể khôi phục!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-trash mr-1"></i> Xóa ngay',
        cancelButtonText: 'Hủy bỏ',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    if (!db) return;
    try {
        Swal.fire({ title: 'Đang xóa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await db.collection('transactions').doc(docId).delete();
        if (currentViewingPhone && document.getElementById('view-customer-modal') && !document.getElementById('view-customer-modal').classList.contains('hidden')) {
            loadCustomerInvoices(currentViewingPhone);
        }
        Swal.fire({ icon: 'success', title: 'Đã xóa phiếu!', text: `Phiếu ${invId} đã được xóa khỏi hệ thống.`, timer: 2000, showConfirmButton: false });
    } catch (e) {
        console.error('Lỗi xóa bill:', e);
        Swal.fire('Lỗi', 'Không thể xóa phiếu. Kiểm tra kết nối mạng!', 'error');
    }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

let customersList = [];
let unsubscribeCustomers = null;

function fetchCustomers() {
    if (!db) return;
    if (unsubscribeCustomers) unsubscribeCustomers();
    
    unsubscribeCustomers = db.collection('customers').orderBy('lastVisit', 'desc').onSnapshot(snapshot => {
        customersList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const rawId = doc.id;
            const cleanPhone = (rawId || '').trim();
            customersList.push({ ...data, rawDocId: rawId, phoneId: cleanPhone });
        });
        renderCustomerTable();
    }, e => {
        console.error("Lỗi lấy danh bạ khách:", e);
    });
}

function renderCustomerTable() {
    const tbody = document.getElementById('customer-table-body');
    const emptyMsg = document.getElementById('empty-customer-msg');
    const searchVal = (document.getElementById('customer-search') ? document.getElementById('customer-search').value.toLowerCase().trim() : '');

    if (!tbody) return;

    let filtered = customersList;
    if (searchVal) {
        const normSearch = removeVietnameseTones(searchVal);
        filtered = customersList.filter(c => {
            const name = c.name || '';
            const phone = c.phoneId || '';
            const code = c.customerCode || '';
            const comp = c.company || '';
            const team = c.team || '';
            const tax = c.taxCode || '';
            const addr = c.taxAddress || '';
            return removeVietnameseTones(name).includes(normSearch) ||
                name.toLowerCase().includes(searchVal) ||
                phone.includes(searchVal) ||
                code.toLowerCase().includes(searchVal) ||
                removeVietnameseTones(comp).includes(normSearch) ||
                comp.toLowerCase().includes(searchVal) ||
                removeVietnameseTones(team).includes(normSearch) ||
                team.toLowerCase().includes(searchVal) ||
                tax.toLowerCase().includes(searchVal) ||
                removeVietnameseTones(addr).includes(normSearch);
        });
    }

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        if(emptyMsg) emptyMsg.classList.remove('hidden');
    } else {
        if(emptyMsg) emptyMsg.classList.add('hidden');
        filtered.forEach(c => {
            let lastVisitStr = '---';
            if (c.lastVisit && c.lastVisit.toDate) {
                const d = c.lastVisit.toDate();
                lastVisitStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
            }

            let orgDisplay = '---';
            if (c.company && c.team) {
                orgDisplay = `<span class="font-semibold text-gray-800">${c.company}</span><br><span class="text-xs text-gray-500">Đội: ${c.team}</span>`;
            } else if (c.company) {
                orgDisplay = `<span class="font-semibold text-gray-800">${c.company}</span>`;
            } else if (c.team) {
                orgDisplay = `<span class="text-gray-700">${c.team}</span>`;
            }
            if (c.taxCode) {
                orgDisplay += `<br><span class="text-[11px] font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded">MST: ${c.taxCode}</span>`;
            }

            const safeName = (c.name || '').replace(/'/g, "\\'");
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-blue-50 transition text-sm text-gray-700";
            tr.innerHTML = `
                <td class="p-3 border-r font-mono text-xs font-bold text-gray-500">${c.customerCode || '---'}</td>
                <td class="p-3 border-r font-bold text-blue-700 cursor-pointer hover:underline" onclick="viewCustomer('${c.phoneId}')" title="Click xem chi tiết">${c.name || '---'}</td>
                <td class="p-3 border-r font-mono font-bold">${c.phoneId || '---'}</td>
                <td class="p-3 border-r text-gray-600">${c.gender || '---'}</td>
                <td class="p-3 border-r text-gray-600">${orgDisplay}</td>
                <td class="p-3 border-r text-center font-bold text-gray-800">${c.ticketCount || 0}</td>
                <td class="p-3 border-r text-right font-bold text-green-700 text-base">${formatVND(c.totalSpent || 0)}</td>
                <td class="p-3 border-r text-gray-500 whitespace-nowrap"><i class="fa-regular fa-calendar mr-1"></i> ${lastVisitStr}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="viewCustomer('${c.phoneId}')" title="Xem chi tiết" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition mr-1">
                        <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                    <button onclick="openEditCustomerModal('${c.phoneId}')" title="Sửa thông tin" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition mr-1">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteCustomer('${c.phoneId}', '${safeName}')" title="Xóa khách hàng" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

if(document.getElementById('customer-search')) {
    document.getElementById('customer-search').addEventListener('input', renderCustomerTable);
}

function toggleBookingBizInfo() {
    const bizFields = document.getElementById('cust-biz-fields');
    const toggleIcon = document.getElementById('cust-biz-toggle-icon');
    if (!bizFields) return;
    const isHidden = bizFields.classList.contains('hidden');
    if (isHidden) {
        bizFields.classList.remove('hidden');
        if (toggleIcon) toggleIcon.classList.add('rotate-180');
    } else {
        bizFields.classList.add('hidden');
        if (toggleIcon) toggleIcon.classList.remove('rotate-180');
    }
}

function openAddCustomerModal() {
    const titleEl = document.getElementById('customer-modal-title');
    const saveBtn = document.getElementById('c-save-btn');
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-plus mr-2"></i> Thêm Khách Hàng Mới';
    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-save mr-2"></i> Lưu Lại';
    const origPhoneEl = document.getElementById('c-edit-original-phone');
    if (origPhoneEl) origPhoneEl.value = '';

    document.getElementById('c-phone').value = '';
    document.getElementById('c-name').value = '';
    if (document.getElementById('c-team')) document.getElementById('c-team').value = '';
    document.getElementById('c-company').value = '';
    if (document.getElementById('c-tax-code')) document.getElementById('c-tax-code').value = '';
    if (document.getElementById('c-tax-address')) document.getElementById('c-tax-address').value = '';
    if (document.getElementById('c-tax-email')) document.getElementById('c-tax-email').value = '';
    document.getElementById('c-gender').value = 'Anh';
    document.getElementById('customer-modal').classList.remove('hidden');
}

function openEditCustomerModal(phoneId) {
    const cust = customersList.find(c => c.phoneId === phoneId || c.rawDocId === phoneId);
    if (!cust) return;

    const titleEl = document.getElementById('customer-modal-title');
    const saveBtn = document.getElementById('c-save-btn');
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-pen mr-2"></i> Sửa Thông Tin Khách Hàng';
    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i> Cập Nhật';
    const origPhoneEl = document.getElementById('c-edit-original-phone');
    if (origPhoneEl) origPhoneEl.value = cust.rawDocId || cust.phoneId || phoneId;

    document.getElementById('c-phone').value = cust.phoneId || '';
    document.getElementById('c-name').value = cust.name || '';
    if (document.getElementById('c-team')) document.getElementById('c-team').value = cust.team || '';
    document.getElementById('c-company').value = cust.company || '';
    if (document.getElementById('c-tax-code')) document.getElementById('c-tax-code').value = cust.taxCode || '';
    if (document.getElementById('c-tax-address')) document.getElementById('c-tax-address').value = cust.taxAddress || '';
    if (document.getElementById('c-tax-email')) document.getElementById('c-tax-email').value = cust.taxEmail || '';
    document.getElementById('c-gender').value = cust.gender || 'Anh';

    document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomerModal() {
    const origPhoneEl = document.getElementById('c-edit-original-phone');
    const rawOriginalPhone = origPhoneEl ? origPhoneEl.value : '';
    const originalPhone = rawOriginalPhone.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const name = document.getElementById('c-name').value.trim();
    const gender = document.getElementById('c-gender').value;
    const team = document.getElementById('c-team') ? document.getElementById('c-team').value.trim() : '';
    const company = document.getElementById('c-company').value.trim();
    const taxCode = document.getElementById('c-tax-code') ? document.getElementById('c-tax-code').value.trim() : '';
    const taxAddress = document.getElementById('c-tax-address') ? document.getElementById('c-tax-address').value.trim() : '';
    const taxEmail = document.getElementById('c-tax-email') ? document.getElementById('c-tax-email').value.trim() : '';

    if (!phone || !name) {
        Swal.fire('Lỗi', 'Vui lòng nhập đủ Số điện thoại và Họ tên!', 'error');
        return;
    }

    if (!db) return;

    const isEditing = !!rawOriginalPhone;

    try {
        Swal.fire({ title: 'Đang lưu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        if (!isEditing) {
            // Thêm mới
            const docRef = await db.collection('customers').doc(phone).get();
            if (docRef.exists) {
                Swal.fire('Cảnh báo', 'Khách hàng với Số điện thoại này đã tồn tại trong danh bạ!', 'warning');
                return;
            }

            const code = 'KH' + Math.floor(1000 + Math.random() * 9000);

            await db.collection('customers').doc(phone).set({
                customerCode: code,
                name: name,
                gender: gender,
                team: team,
                company: company,
                taxCode: taxCode,
                taxAddress: taxAddress,
                taxEmail: taxEmail,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
                totalSpent: 0,
                ticketCount: 0
            });

            closeCustomerModal();
            Swal.fire({ icon: 'success', title: 'Thành công', text: 'Đã thêm khách hàng mới!', timer: 1500, showConfirmButton: false });
        } else {
            // Sửa thông tin
            const updatePayload = {
                name: name,
                gender: gender,
                team: team,
                company: company,
                taxCode: taxCode,
                taxAddress: taxAddress,
                taxEmail: taxEmail
            };

            if (phone === rawOriginalPhone) {
                // SĐT không đổi và ID trong Firestore chuẩn
                await db.collection('customers').doc(phone).set(updatePayload, { merge: true });
            } else {
                // Đổi số điện thoại HOẶC ID cũ trong database dính khoảng trắng thừa (rawOriginalPhone !== phone)
                if (phone !== originalPhone) {
                    const newDocRef = await db.collection('customers').doc(phone).get();
                    if (newDocRef.exists) {
                        Swal.fire('Cảnh báo', `Số điện thoại ${phone} đã được dùng cho một khách hàng khác!`, 'warning');
                        return;
                    }
                }

                // Sao chép dữ liệu từ doc cũ sang doc mới
                const oldDoc = await db.collection('customers').doc(rawOriginalPhone).get();
                const oldData = oldDoc.exists ? oldDoc.data() : {};

                await db.collection('customers').doc(phone).set({
                    ...oldData,
                    ...updatePayload
                }, { merge: true });

                // Xóa doc cũ nếu ID cũ khác với ID mới
                if (rawOriginalPhone && rawOriginalPhone !== phone) {
                    await db.collection('customers').doc(rawOriginalPhone).delete();
                }
            }

            closeCustomerModal();

            // Nếu modal chi tiết khách đang mở, refresh lại
            const viewModal = document.getElementById('view-customer-modal');
            if (viewModal && !viewModal.classList.contains('hidden')) {
                viewCustomer(phone);
            }

            Swal.fire({ icon: 'success', title: 'Thành công', text: 'Đã cập nhật thông tin khách hàng!', timer: 1500, showConfirmButton: false });
        }
    } catch (e) {
        console.error("Lỗi lưu khách hàng:", e);
        Swal.fire('Lỗi', 'Không thể lưu thông tin. Vui lòng kiểm tra kết nối mạng!', 'error');
    }
}

async function deleteCustomer(phoneId, customerName) {
    if (!hasPermission('customers_delete')) {
        return Swal.fire('Từ chối', 'Bạn không có quyền xóa khách hàng!', 'error');
    }
    const result = await Swal.fire({
        title: 'Xác nhận xóa khách hàng?',
        html: `Khách hàng <b class="text-blue-700">${customerName || phoneId}</b> (SĐT: ${phoneId}) sẽ bị xóa vĩnh viễn khỏi danh bạ!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fa-solid fa-trash mr-1"></i> Xóa ngay',
        cancelButtonText: 'Hủy bỏ',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;
    if (!db) return;

    try {
        Swal.fire({ title: 'Đang xóa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const cust = customersList.find(c => c.phoneId === phoneId || c.rawDocId === phoneId);
        const targetDocId = (cust && cust.rawDocId) ? cust.rawDocId : phoneId;
        await db.collection('customers').doc(targetDocId).delete();
        closeViewCustomerModal();
        Swal.fire({ icon: 'success', title: 'Đã xóa!', text: `Đã xóa khách hàng ${customerName || phoneId} khỏi danh bạ.`, timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error('Lỗi xóa khách hàng:', e);
        Swal.fire('Lỗi', 'Không thể xóa khách hàng. Kiểm tra kết nối mạng!', 'error');
    }
}

let currentViewingPhone = '';
let currentViewingCustomerInvoices = [];
let selectedVatInvoiceIds = new Set();
let currentCustomerCompensations = [];
let currentCompUploadedBase64 = null;

function switchVcSubTab(subTabName) {
    const btnInvoices = document.getElementById('vc-tab-btn-invoices');
    const btnComp = document.getElementById('vc-tab-btn-compensations');
    const contentInvoices = document.getElementById('vc-tab-content-invoices');
    const contentComp = document.getElementById('vc-tab-content-compensations');

    if (subTabName === 'invoices') {
        if (btnInvoices) {
            btnInvoices.className = "pb-2.5 border-b-2 border-blue-600 text-blue-600 flex items-center gap-1.5 transition font-bold";
        }
        if (btnComp) {
            btnComp.className = "pb-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition font-semibold";
        }
        if (contentInvoices) contentInvoices.classList.remove('hidden');
        if (contentComp) contentComp.classList.add('hidden');
    } else {
        if (btnInvoices) {
            btnInvoices.className = "pb-2.5 border-b-2 border-transparent text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition font-semibold";
        }
        if (btnComp) {
            btnComp.className = "pb-2.5 border-b-2 border-amber-600 text-amber-700 flex items-center gap-1.5 transition font-bold";
        }
        if (contentInvoices) contentInvoices.classList.add('hidden');
        if (contentComp) contentComp.classList.remove('hidden');
        fetchCustomerCompensations(currentViewingPhone);
    }
}

async function viewCustomer(phoneId) {
    const cust = customersList.find(c => c.phoneId === phoneId || c.rawDocId === phoneId);
    if (!cust) return;

    currentViewingPhone = cust.phoneId || phoneId;
    selectedVatInvoiceIds.clear();

    const el = (id) => document.getElementById(id);
    if (!el('view-customer-modal')) return;

    el('vc-title').textContent = cust.name || 'Khách hàng';
    el('vc-code').textContent = cust.customerCode || '---';
    el('vc-name').textContent = cust.name || '---';
    el('vc-phone').textContent = cust.phoneId || '---';
    if (el('vc-phone-header')) el('vc-phone-header').textContent = cust.phoneId || '---';
    el('vc-phone-link').href = `tel:${cust.phoneId || ''}`;
    el('vc-gender-badge').textContent = cust.gender || 'Anh';
    if (el('vc-team')) el('vc-team').textContent = cust.team || '---';
    
    // Doanh nghiệp
    if (el('vc-company')) {
        el('vc-company').textContent = cust.company || '---';
        el('vc-company').title = cust.company || '';
    }
    if (el('vc-tax-code')) el('vc-tax-code').textContent = cust.taxCode || '---';
    if (el('vc-tax-address')) {
        el('vc-tax-address').textContent = cust.taxAddress || '---';
        el('vc-tax-address').title = cust.taxAddress || '';
    }
    if (el('vc-tax-email')) {
        el('vc-tax-email').textContent = cust.taxEmail || '---';
        el('vc-tax-email').title = cust.taxEmail || '';
    }

    el('vc-tickets').textContent = cust.ticketCount || 0;
    el('vc-spent').textContent = formatVND(cust.totalSpent || 0);

    let lastVisitStr = '---';
    if (cust.lastVisit && cust.lastVisit.toDate) {
        const d = cust.lastVisit.toDate();
        lastVisitStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    }
    el('vc-last-visit').textContent = lastVisitStr;

    el('vc-edit-btn').onclick = () => {
        openEditCustomerModal(phoneId);
    };
    el('vc-delete-btn').onclick = () => {
        deleteCustomer(phoneId, cust.name);
    };

    // Mặc định về subtab Lịch Sử
    switchVcSubTab('invoices');
    el('view-customer-modal').classList.remove('hidden');

    // Tải đồng thời Lịch sử phiếu và Nhật ký Bù sân
    loadCustomerInvoices(currentViewingPhone);
    fetchCustomerCompensations(currentViewingPhone);
}

async function loadCustomerInvoices(phoneId) {
    const el = (id) => document.getElementById(id);
    const transBody = el('vc-transactions-body');
    if (!transBody) return;
    
    transBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-1.5 text-blue-600"></i> Đang tải lịch sử giao dịch...</td></tr>';

    try {
        let transactions = [];
        const cleanPhone = (phoneId || '').replace(/\D/g, '');

        if (cachedTransactions && cachedTransactions.length > 0) {
            transactions = cachedTransactions.filter(t => {
                const tPhone = (t.customerPhone || '').replace(/\D/g, '');
                return (cleanPhone && tPhone && tPhone === cleanPhone) || (t.customerPhone === phoneId);
            });
        } else if (db) {
            const snap = await db.collection('transactions').where('customerPhone', '==', phoneId).get();
            snap.forEach(d => transactions.push({ docId: d.id, ...d.data() }));
        }

        transactions.sort((a, b) => {
            const tA = (a.createdAt && a.createdAt.toDate) ? a.createdAt.toDate().getTime() : 0;
            const tB = (b.createdAt && b.createdAt.toDate) ? b.createdAt.toDate().getTime() : 0;
            return tB - tA;
        });

        currentViewingCustomerInvoices = transactions;
        if (el('vc-badge-invoices')) el('vc-badge-invoices').textContent = transactions.length;

        renderVcInvoicesTable();

    } catch (e) {
        console.error("Lỗi lấy lịch sử giao dịch của khách:", e);
        transBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Lỗi khi tải lịch sử giao dịch.</td></tr>';
    }
}


// ==========================================
// TÍNH TOÁN KHOẢNG NGÀY HIỆU LỰC THỰC TẾ CỦA PHIẾU (XỬ LÝ PHIẾU NHIỀU DỊCH VỤ DÀI HẠN)
// ==========================================
function getEffectiveTransactionDates(t) {
    if (!t) return { startDateObj: null, endDateObj: null, startDateISO: '', endDateISO: '', displayStr: '---' };

    let minStart = null;
    let maxEnd = null;

    // 1. Quét qua toàn bộ các dòng dịch vụ (items)
    if (t.items && Array.isArray(t.items) && t.items.length > 0) {
        t.items.forEach(item => {
            const range = getItemDateRange(item);
            if (range && range.start && range.end) {
                if (!minStart || range.start < minStart) minStart = new Date(range.start);
                if (!maxEnd || range.end > maxEnd) maxEnd = new Date(range.end);
            }
        });
    }

    // 2. Nếu không lấy được từ items, dùng startDate và endDate cấp phiếu
    if (!minStart && t.startDate && t.startDate.includes('-')) {
        const [sy, sm, sd] = t.startDate.split('-').map(Number);
        minStart = new Date(sy, sm - 1, sd);
    }
    if (!maxEnd && t.endDate && t.endDate.includes('-')) {
        const [ey, em, ed] = t.endDate.split('-').map(Number);
        maxEnd = new Date(ey, em - 1, ed);
    }

    const pad = (n) => String(n).padStart(2, '0');
    let startDateISO = '';
    let endDateISO = '';
    let displayStr = '---';

    if (minStart && maxEnd) {
        const sy = minStart.getFullYear();
        const sm = pad(minStart.getMonth() + 1);
        const sd = pad(minStart.getDate());

        const ey = maxEnd.getFullYear();
        const em = pad(maxEnd.getMonth() + 1);
        const ed = pad(maxEnd.getDate());

        startDateISO = `${sy}-${sm}-${sd}`;
        endDateISO = `${ey}-${em}-${ed}`;

        if (sy === ey) {
            displayStr = `${sd}/${sm} - ${ed}/${em}/${ey}`;
        } else {
            displayStr = `${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`;
        }
    } else if (maxEnd) {
        const ey = maxEnd.getFullYear();
        const em = pad(maxEnd.getMonth() + 1);
        const ed = pad(maxEnd.getDate());
        endDateISO = `${ey}-${em}-${ed}`;
        displayStr = `Đến ${ed}/${em}/${ey}`;
    }

    return {
        startDateObj: minStart,
        endDateObj: maxEnd,
        startDateISO,
        endDateISO,
        displayStr
    };
}

function renderVcInvoicesTable() {
    const el = (id) => document.getElementById(id);
    const transBody = el('vc-transactions-body');
    if (!transBody) return;

    const filterVat = el('vc-filter-vat') ? el('vc-filter-vat').value : 'all';

    let displayList = currentViewingCustomerInvoices;
    if (filterVat === 'exported') {
        displayList = displayList.filter(t => t.vatStatus === 'exported' || t.vatExported === true || t.vatExported === 'exported');
    } else if (filterVat === 'pending') {
        displayList = displayList.filter(t => t.vatStatus === 'pending' || t.vatExported === 'pending');
    } else if (filterVat === 'not_exported') {
        displayList = displayList.filter(t => !t.vatStatus || t.vatStatus === 'not_exported' || (!t.vatExported && t.vatExported !== 'pending' && t.vatExported !== true));
    }

    if (displayList.length === 0) {
        transBody.innerHTML = '<tr><td colspan="8" class="p-5 text-center text-gray-400 italic">Không có phiếu nào phù hợp với bộ lọc.</td></tr>';
        updateVatSelectionUI();
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    transBody.innerHTML = '';
    displayList.forEach(t => {
        const invId = t.id || `CŨ-${(t.docId || '').slice(0,6).toUpperCase()}`;
        const targetDocId = t.id || t.docId;

        // Ngày tạo
        let createDateStr = '---';
        if (t.createdAt && t.createdAt.toDate) {
            const d = t.createdAt.toDate();
            createDateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        }

        // 1. Tính toán khoảng ngày thực tế của phiếu (quét qua toàn bộ items dịch vụ)
        const effectiveDates = getEffectiveTransactionDates(t);

        // Tự động làm sạch dữ liệu cũ (Self-healing): nếu t.endDate bị lưu thiếu/sai so với items thực tế
        if (effectiveDates.endDateISO && t.endDate !== effectiveDates.endDateISO) {
            t.startDate = effectiveDates.startDateISO;
            t.endDate = effectiveDates.endDateISO;
            if (db && targetDocId) {
                db.collection('transactions').doc(targetDocId).update({
                    startDate: effectiveDates.startDateISO,
                    endDate: effectiveDates.endDateISO
                }).catch(e => console.warn('Lỗi auto-heal date:', e));
            }
        }

        // Kỳ thuê hiển thị (startDate - endDate thực tế)
        let periodDisplay = '';
        if (effectiveDates.displayStr && effectiveDates.displayStr !== '---') {
            periodDisplay = `<div class="font-bold text-gray-800 text-[11px]"><i class="fa-regular fa-calendar-days text-indigo-500 mr-1"></i>${effectiveDates.displayStr}</div>`;
        }
        periodDisplay += `<div class="text-[10px] text-gray-400">Tạo: ${createDateStr}</div>`;

        // CẢNH BÁO HẾT HẠN HỢP ĐỒNG (Tính theo mốc kết thúc muộn nhất của toàn bộ dịch vụ)
        let expiryBadge = '<span class="text-gray-400 italic text-[11px]">Vãng lai</span>';
        if (effectiveDates.endDateObj) {
            const endDateObj = new Date(effectiveDates.endDateObj);
            endDateObj.setHours(0, 0, 0, 0);

            const diffTime = endDateObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const [ey, em, ed] = (effectiveDates.endDateISO || '').split('-');

            if (diffDays < 0) {
                const daysAgo = Math.abs(diffDays);
                expiryBadge = `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1" title="Hạn cuối: ${ed}/${em}/${ey}"><i class="fa-solid fa-triangle-exclamation"></i> Đã hết hạn (${daysAgo} ngày)</span>`;
            } else if (diffDays <= 7) {
                expiryBadge = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] inline-flex items-center gap-1 animate-pulse" title="Hạn cuối: ${ed}/${em}/${ey}"><i class="fa-solid fa-bolt text-amber-600"></i> Sắp hết (${diffDays} ngày)</span>`;
            } else {
                expiryBadge = `<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold text-[10px] inline-flex items-center gap-1" title="Hạn cuối: ${ed}/${em}/${ey}"><i class="fa-solid fa-circle-check"></i> Còn ${diffDays} ngày</span>`;
            }
        }

        // TRẠNG THÁI THANH TOÁN (paid, partial, unpaid)
        let payStatus = t.status || 'unpaid';
        let paymentBadge = '';
        if (payStatus === 'paid') {
            paymentBadge = `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs whitespace-nowrap"><i class="fa-solid fa-circle-check text-emerald-600"></i> Đã TT</span>`;
        } else if (payStatus === 'partial') {
            const remain = (t.remainingAmount !== undefined) ? t.remainingAmount : ((t.totalAmount || 0) - (t.paidAmount || 0));
            paymentBadge = `
                <div class="flex flex-col items-center gap-0.5 whitespace-nowrap">
                    <span class="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-bold text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-circle-half-stroke text-amber-600"></i> Trả 1 phần</span>
                    <span class="text-[9px] text-red-600 font-semibold">Còn: ${formatVND(remain)}</span>
                </div>
            `;
        } else {
            paymentBadge = `
                <div class="flex flex-col items-center gap-1 whitespace-nowrap">
                    <span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Chưa TT</span>
                    <button type="button" onclick="openManualPaymentFromCustModal('${targetDocId}')" class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition" title="Gạch nợ phiếu này">
                        <i class="fa-solid fa-hand-holding-dollar"></i> Thu
                    </button>
                </div>
            `;
        }

        // TRẠNG THÁI VAT (3 trạng thái: not_exported: Chưa xuất, pending: Chờ xuất, exported: Đã xuất VAT)
        let vatStatus = 'not_exported';
        if (t.vatStatus) {
            vatStatus = t.vatStatus;
        } else if (t.vatExported === true || t.vatExported === 'exported') {
            vatStatus = 'exported';
        } else if (t.vatExported === 'pending') {
            vatStatus = 'pending';
        }

        let vatBadge = '';
        if (vatStatus === 'exported') {
            vatBadge = `
                <button type="button" onclick="changeInvoiceVatStatus('${targetDocId}', 'exported')" title="Kế toán đã xuất hóa đơn hoàn tất. Bấm để đổi trạng thái" class="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-full font-bold text-[11px] inline-flex items-center gap-1.5 transition border border-emerald-300 cursor-pointer shadow-xs">
                    <i class="fa-solid fa-check text-emerald-600"></i> Đã xuất VAT
                </button>
            `;
        } else if (vatStatus === 'pending') {
            vatBadge = `
                <button type="button" onclick="changeInvoiceVatStatus('${targetDocId}', 'pending')" title="Đã gửi yêu cầu cho kế toán, đang chờ gửi lại hóa đơn. Bấm để đổi trạng thái" class="px-2.5 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-full font-bold text-[11px] inline-flex items-center gap-1.5 transition border border-amber-300 cursor-pointer shadow-xs animate-pulse">
                    <i class="fa-solid fa-clock-rotate-left text-amber-600"></i> Chờ xuất
                </button>
            `;
        } else {
            vatBadge = `
                <button type="button" onclick="changeInvoiceVatStatus('${targetDocId}', 'not_exported')" title="Chưa gửi kế toán. Bấm để đổi trạng thái" class="px-2.5 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full font-medium text-[11px] inline-flex items-center gap-1.5 transition border border-gray-200 cursor-pointer shadow-xs">
                    <i class="fa-regular fa-circle text-[10px]"></i> Chưa xuất
                </button>
            `;
        }

        // CHECKBOX CHỌN PHIẾU XUẤT EXCEL
        const isChecked = selectedVatInvoiceIds.has(targetDocId);

        const dataStr = encodeURIComponent(JSON.stringify(t));
        const tr = document.createElement('tr');
        tr.className = `border-b hover:bg-blue-50/60 transition ${isChecked ? 'bg-blue-50/80' : ''}`;
        tr.innerHTML = `
            <td class="p-2 border text-center">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleInvoiceVatSelect('${targetDocId}', this.checked)" class="rounded text-blue-600 cursor-pointer">
            </td>
            <td class="p-2 border font-mono font-bold text-indigo-700 whitespace-nowrap">${invId}</td>
            <td class="p-2 border whitespace-nowrap">${periodDisplay}</td>
            <td class="p-2 border text-center whitespace-nowrap">${expiryBadge}</td>
            <td class="p-2 border text-right font-bold text-gray-800 whitespace-nowrap">${formatVND(t.totalAmount || 0)}</td>
            <td class="p-2 border text-center whitespace-nowrap">${paymentBadge}</td>
            <td class="p-2 border text-center whitespace-nowrap">${vatBadge}</td>
            <td class="p-2 border text-center whitespace-nowrap">
                <button onclick="viewReceipt('${dataStr}')" class="px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-[11px] font-bold transition mr-1" title="Xem chi tiết phiếu">
                    <i class="fa-solid fa-eye"></i> Phiếu
                </button>
                <button onclick="openRenewModal('${dataStr}')" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-[11px] font-bold shadow-sm transition inline-flex items-center gap-1" title="Gia hạn phiếu này sang tháng mới">
                    <i class="fa-solid fa-calendar-plus"></i> Gia Hạn
                </button>
            </td>
        `;
        transBody.appendChild(tr);
    });

    updateVatSelectionUI();
}

function openManualPaymentFromCustModal(targetDocId) {
    if (!targetDocId) return;
    let inv = currentViewingCustomerInvoices.find(t => (t.id === targetDocId || t.docId === targetDocId));
    if (!inv && cachedTransactions) {
        inv = cachedTransactions.find(t => (t.id === targetDocId || t.docId === targetDocId));
    }
    if (inv) {
        if (!inv.docId) inv.docId = inv.id || targetDocId;
        openManualPaymentModal(inv);
    }
}

function filterVcInvoicesTable() {
    renderVcInvoicesTable();
}

function toggleInvoiceVatSelect(targetDocId, checked) {
    if (checked) {
        selectedVatInvoiceIds.add(targetDocId);
    } else {
        selectedVatInvoiceIds.delete(targetDocId);
    }
    updateVatSelectionUI();
}

function toggleSelectAllInvoices(checked) {
    if (checked) {
        currentViewingCustomerInvoices.forEach(t => {
            const id = t.id || t.docId;
            if (id) selectedVatInvoiceIds.add(id);
        });
    } else {
        selectedVatInvoiceIds.clear();
    }
    renderVcInvoicesTable();
}

function updateVatSelectionUI() {
    const el = (id) => document.getElementById(id);
    const count = selectedVatInvoiceIds.size;
    if (el('vc-selected-count')) el('vc-selected-count').textContent = count;
    if (el('vc-btn-count')) el('vc-btn-count').textContent = count;
    
    const selectAllCheckbox = el('vc-select-all-invoices');
    if (selectAllCheckbox && currentViewingCustomerInvoices.length > 0) {
        selectAllCheckbox.checked = (count === currentViewingCustomerInvoices.length && count > 0);
    }
}

async function changeInvoiceVatStatus(targetDocId, currentStatusVal) {
    if (!db || !targetDocId) return;

    const { value: newStatus } = await Swal.fire({
        title: 'Trạng thái Hóa đơn VAT',
        html: '<div class="text-xs text-gray-500 mb-2 text-left">Chọn giai đoạn thực tế của phiếu thanh toán:</div>',
        input: 'radio',
        inputOptions: {
            'not_exported': '⚪ Chưa xuất (Chưa gửi cho kế toán)',
            'pending': '🟡 Chờ xuất (Đã gửi kế toán, chờ nhận hóa đơn)',
            'exported': '🟢 Đã xuất VAT (Kế toán đã xuất và gửi hóa đơn)'
        },
        inputValue: currentStatusVal || 'not_exported',
        showCancelButton: true,
        confirmButtonText: 'Lưu trạng thái',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280'
    });

    if (!newStatus || newStatus === currentStatusVal) return;

    try {
        const updatePayload = {
            vatStatus: newStatus,
            vatExported: (newStatus === 'exported' ? true : (newStatus === 'pending' ? 'pending' : false)),
            vatUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (newStatus === 'exported') {
            updatePayload.vatExportedAt = firebase.firestore.FieldValue.serverTimestamp();
        } else if (newStatus === 'pending') {
            updatePayload.vatRequestedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('transactions').doc(targetDocId).set(updatePayload, { merge: true });

        // Cập nhật bộ nhớ đệm
        const match = currentViewingCustomerInvoices.find(t => (t.id === targetDocId || t.docId === targetDocId));
        if (match) {
            match.vatStatus = newStatus;
            match.vatExported = updatePayload.vatExported;
        }
        const cached = cachedTransactions.find(t => (t.id === targetDocId || t.docId === targetDocId));
        if (cached) {
            cached.vatStatus = newStatus;
            cached.vatExported = updatePayload.vatExported;
        }

        renderVcInvoicesTable();

        const statusNames = {
            'not_exported': '⚪ Chưa xuất',
            'pending': '🟡 Chờ xuất (Đã gửi yêu cầu cho kế toán)',
            'exported': '🟢 Đã xuất VAT'
        };

        Swal.fire({
            icon: 'success',
            title: `Đã đổi: ${statusNames[newStatus]}`,
            toast: true,
            position: 'top-end',
            timer: 1800,
            showConfirmButton: false
        });
    } catch (e) {
        console.error("Lỗi cập nhật trạng thái VAT:", e);
        Swal.fire('Lỗi', 'Không thể cập nhật trạng thái VAT: ' + e.message, 'error');
    }
}

async function toggleInvoiceVatStatus(targetDocId, currentStatus) {
    const curVal = currentStatus ? 'exported' : 'not_exported';
    return changeInvoiceVatStatus(targetDocId, curVal);
}

// ==========================================
// XUẤT EXCEL & XEM TRƯỚC HÓA ĐƠN VAT CHO KẾ TOÁN (XLSX-JS-STYLE)
// ==========================================

let currentVatGridRows = [];

function escapeVatHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNumberVn(n) {
    return Number(n || 0).toLocaleString('vi-VN');
}

function openVatExportModalForSelected() {
    if (selectedVatInvoiceIds.size === 0) {
        Swal.fire('Chưa chọn phiếu', 'Vui lòng tích chọn ít nhất 1 phiếu thanh toán để xuất hóa đơn VAT!', 'warning');
        return;
    }

    const cust = customersList.find(c => c.phoneId === currentViewingPhone || c.rawDocId === currentViewingPhone);
    const selectedTransactions = currentViewingCustomerInvoices.filter(t => selectedVatInvoiceIds.has(t.id || t.docId));

    const el = (id) => document.getElementById(id);
    if (!el('vat-export-modal')) return;

    // 1. Điền thông tin Người mua / Đơn vị mua hàng (5 dòng đầu)
    el('ve-buyer-name').value = cust ? (cust.name || '') : '';
    el('ve-company').value = (cust && cust.company) ? cust.company : (cust ? (cust.name || '') : '');
    el('ve-tax-code').value = (cust && cust.taxCode) ? cust.taxCode : '';
    el('ve-tax-address').value = (cust && cust.taxAddress) ? cust.taxAddress : '';
    el('ve-email').value = (cust && (cust.taxEmail || cust.email)) ? (cust.taxEmail || cust.email) : '';

    // 2. Thiết lập thuế suất mặc định (10%)
    el('ve-vat-rate').value = '10';
    const vatRate = 0.10;

    // 3. Khởi tạo danh sách dòng dịch vụ xuất hóa đơn từ các phiếu được chọn
    currentVatGridRows = [];

    selectedTransactions.forEach(t => {
        const total = t.totalAmount || 0;
        let preTax = 0;
        let vat = 0;

        if (t.vatAmount && t.vatAmount > 0) {
            vat = t.vatAmount;
            preTax = t.subTotal || (total - vat);
        } else {
            // Phiếu chưa bao gồm VAT: tính ngược tiền trước thuế từ tổng thanh toán theo tỷ lệ thuế suất
            preTax = Math.round(total / (1 + vatRate));
            vat = total - preTax;
        }

        // Đếm tổng số buổi trong phiếu
        let sessionCount = 0;
        const sportsInTicket = new Set();
        if (t.items && Array.isArray(t.items)) {
            t.items.forEach(it => {
                sessionCount += (Number(it.count) || 1);
                let nm = it.name || '';
                let sp = nm.includes('[') ? nm.split('[')[0].trim() : (nm.includes('-') ? nm.split('-')[0].trim() : nm.trim());
                if (sp) sportsInTicket.add(sp.replace(/^sân\s+/i, '').toLowerCase());
            });
        }
        if (sessionCount <= 0) sessionCount = 1;

        const sportStr = sportsInTicket.size > 0 ? Array.from(sportsInTicket).join(', ') : 'thể thao';

        // Xác định tháng/kỳ thuê
        let monthStr = '';
        if (t.startDate) {
            const parts = t.startDate.split('-');
            if (parts.length >= 2) monthStr = ` tháng ${parts[1]}/${parts[0]}`;
        }
        if (!monthStr) {
            const now = new Date();
            monthStr = ` tháng ${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        }

        const itemName = `Dịch vụ thuê sân ${sportStr}${monthStr}`;
        const unitPrice = sessionCount > 0 ? Math.round(preTax / sessionCount) : preTax;

        currentVatGridRows.push({
            id: 'vat_row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: itemName,
            unit: 'buổi',
            count: sessionCount,
            price: unitPrice,
            total: preTax, // Thành tiền (LOCKED - Read only)
            originalTotalAmount: total,
            originalVatAmount: t.vatAmount || 0,
            originalSubTotal: t.subTotal || 0,
            originInvoiceId: t.id || t.docId
        });
    });

    renderVatItemsGrid();
    el('vat-export-modal').classList.remove('hidden');
    bringModalToFront(el('vat-export-modal'));
}

function renderVatItemsGrid() {
    const tbody = document.getElementById('ve-items-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    currentVatGridRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-emerald-50/30 transition text-xs";
        tr.innerHTML = `
            <td class="p-2 border text-center font-bold text-gray-500">${index + 1}</td>
            <td class="p-2 border">
                <input type="text" value="${escapeVatHtml(row.name)}" class="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs text-gray-800 font-medium focus:ring-1 focus:ring-emerald-500 outline-none" oninput="updateVatGridRowField(${index}, 'name', this.value)" placeholder="Tên hàng hóa, dịch vụ">
            </td>
            <td class="p-2 border">
                <input type="text" value="${escapeVatHtml(row.unit || 'buổi')}" class="w-full px-1.5 py-1.5 border border-gray-300 rounded bg-white text-center text-xs text-gray-800 focus:ring-1 focus:ring-emerald-500 outline-none" oninput="updateVatGridRowField(${index}, 'unit', this.value)" placeholder="ĐVT">
            </td>
            <td class="p-2 border">
                <input type="number" step="any" min="0.01" value="${row.count}" class="w-full px-1.5 py-1.5 border border-gray-300 rounded bg-white text-center font-bold text-xs text-gray-800 focus:ring-1 focus:ring-emerald-500 outline-none" oninput="onVatGridCountChange(${index}, this.value)" title="Số lượng = Thành tiền / Đơn giá">
            </td>
            <td class="p-2 border">
                <input type="text" value="${formatNumberVn(row.price)}" class="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-right font-mono font-bold text-xs text-blue-700 focus:ring-1 focus:ring-emerald-500 outline-none" onchange="onVatGridPriceChange(${index}, this.value)" oninput="this.value = this.value.replace(/[^0-9]/g, '')" title="Đơn giá 1 buổi. Sửa đơn giá sẽ tự động tính lại số lượng">
            </td>
            <td class="p-2 border text-right">
                <div class="font-bold text-gray-800 font-mono py-1.5 px-2 bg-gray-100/70 border border-gray-200 rounded text-xs select-none" title="Số tiền gốc cố định theo phiếu (không được sửa)">${formatVND(row.total)}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    recalculateVatGridTotals();
}

function updateVatGridRowField(index, field, value) {
    if (currentVatGridRows[index]) {
        currentVatGridRows[index][field] = value;
    }
}

function onVatGridPriceChange(index, rawVal) {
    const row = currentVatGridRows[index];
    if (!row) return;

    const price = parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10) || 0;
    if (price <= 0) {
        Swal.fire('Lưu ý', 'Đơn giá phải lớn hơn 0!', 'warning');
        renderVatItemsGrid();
        return;
    }

    row.price = price;
    // Công thức: Số lượng = Thành tiền / Đơn giá
    const calculatedCount = row.total / price;
    row.count = Math.round(calculatedCount * 100) / 100;

    renderVatItemsGrid();
}

function onVatGridCountChange(index, rawVal) {
    const row = currentVatGridRows[index];
    if (!row) return;

    const count = parseFloat(rawVal) || 0;
    if (count <= 0) {
        Swal.fire('Lưu ý', 'Số lượng phải lớn hơn 0!', 'warning');
        renderVatItemsGrid();
        return;
    }

    row.count = count;
    // Công thức: Đơn giá = Thành tiền / Số lượng
    row.price = Math.round(row.total / count);

    renderVatItemsGrid();
}

function recalculateVatGridTotals() {
    const el = (id) => document.getElementById(id);
    const rateVal = el('ve-vat-rate') ? el('ve-vat-rate').value : '10';
    const vatRate = rateVal === 'none' ? 0 : (parseFloat(rateVal) / 100);

    // Cập nhật lại tiền trước thuế của từng dòng nếu người dùng thay đổi thuế suất
    currentVatGridRows.forEach(row => {
        const origTotal = row.originalTotalAmount || row.total;
        let preTax = 0;
        if (row.originalVatAmount && row.originalVatAmount > 0) {
            preTax = row.originalSubTotal || (origTotal - row.originalVatAmount);
        } else if (vatRate === 0) {
            preTax = origTotal;
        } else {
            preTax = Math.round(origTotal / (1 + vatRate));
        }
        row.total = preTax;
        if (row.price > 0) {
            row.count = Math.round((row.total / row.price) * 100) / 100;
        } else if (row.count > 0) {
            row.price = Math.round(row.total / row.count);
        }
    });

    // Render lại số tiền vào table body nếu có
    const tbody = document.getElementById('ve-items-table-body');
    if (tbody && tbody.children.length === currentVatGridRows.length) {
        currentVatGridRows.forEach((row, idx) => {
            const tr = tbody.children[idx];
            if (tr) {
                const countInput = tr.children[3]?.querySelector('input');
                if (countInput && document.activeElement !== countInput) countInput.value = row.count;
                const priceInput = tr.children[4]?.querySelector('input');
                if (priceInput && document.activeElement !== priceInput) priceInput.value = formatNumberVn(row.price);
                const totalDisplay = tr.children[5]?.querySelector('div');
                if (totalDisplay) totalDisplay.textContent = formatVND(row.total);
            }
        });
    }

    const sumPreTax = currentVatGridRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const sumVat = vatRate > 0 ? Math.round(sumPreTax * vatRate) : 0;
    const sumTotal = sumPreTax + sumVat;

    if (el('ve-sum-pretax')) el('ve-sum-pretax').textContent = formatVND(sumPreTax);
    if (el('ve-sum-vat')) el('ve-sum-vat').textContent = formatVND(sumVat);
    if (el('ve-sum-total')) el('ve-sum-total').textContent = formatVND(sumTotal);
}

function closeVatExportModal() {
    const modal = document.getElementById('vat-export-modal');
    if (modal) modal.classList.add('hidden');
    syncModalStack();
}

// ---------------------------------------------------------
// XEM TRƯỚC HÓA ĐƠN VAT (PREVIEW INVOICE MODAL)
// ---------------------------------------------------------

function previewVatInvoiceModal() {
    const el = (id) => document.getElementById(id);
    const buyerName = el('ve-buyer-name') ? el('ve-buyer-name').value.trim() : '';
    const companyName = el('ve-company') ? el('ve-company').value.trim() : '';
    const taxCode = el('ve-tax-code') ? el('ve-tax-code').value.trim() : '';
    const taxAddress = el('ve-tax-address') ? el('ve-tax-address').value.trim() : '';
    const taxEmail = el('ve-email') ? el('ve-email').value.trim() : '';
    const rateVal = el('ve-vat-rate') ? el('ve-vat-rate').value : '10';
    const vatRate = rateVal === 'none' ? 0 : (parseFloat(rateVal) / 100);

    const sumPreTax = currentVatGridRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const sumVat = vatRate > 0 ? Math.round(sumPreTax * vatRate) : 0;
    const sumTotal = sumPreTax + sumVat;
    const vatLabel = rateVal === 'none' ? 'KCT' : (rateVal === '0' ? 'VAT 0%' : `VAT ${rateVal}%`);

    const paper = el('vat-preview-paper');
    if (!paper) return;

    paper.innerHTML = `
        <div class="space-y-4">
            <!-- 5 Dòng thông tin người mua (khớp 100% ảnh mẫu) -->
            <div class="space-y-1.5 text-[14px] text-gray-900 border-b border-gray-300 pb-3">
                <div><span class="font-normal">Họ tên người mua hàng (Buyer):</span> <span class="font-semibold">${escapeVatHtml(buyerName)}</span></div>
                <div><span class="font-normal">Tên đơn vị (Company's name):</span> <span class="font-bold">${escapeVatHtml(companyName)}</span></div>
                <div><span class="font-normal">Mã số thuế (Tax code):</span> <span class="font-semibold font-mono">${escapeVatHtml(taxCode)}</span></div>
                <div><span class="font-normal">Địa chỉ (Address):</span> <span class="font-normal">${escapeVatHtml(taxAddress)}</span></div>
                <div><span class="font-normal">Email nhận hóa đơn:</span> <span class="font-normal font-mono text-emerald-800">${escapeVatHtml(taxEmail)}</span></div>
            </div>

            <!-- Bảng dịch vụ khung kẻ chuẩn Excel theo mẫu -->
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-900 text-[13px]">
                    <thead>
                        <tr class="font-bold border border-gray-900 bg-gray-50">
                            <th class="border border-gray-900 p-2 text-center w-12">STT</th>
                            <th class="border border-gray-900 p-2 text-center">Tên hàng</th>
                            <th class="border border-gray-900 p-2 text-center w-20">ĐVTính</th>
                            <th class="border border-gray-900 p-2 text-center w-20">Số Lượng</th>
                            <th class="border border-gray-900 p-2 text-center w-28">Đơn Giá</th>
                            <th class="border border-gray-900 p-2 text-center w-32">Thành Tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentVatGridRows.map((r, i) => `
                            <tr>
                                <td class="border border-gray-900 p-2 text-center font-normal">${i + 1}</td>
                                <td class="border border-gray-900 p-2 text-left font-normal">${escapeVatHtml(r.name)}</td>
                                <td class="border border-gray-900 p-2 text-center font-normal">${escapeVatHtml(r.unit || 'buổi')}</td>
                                <td class="border border-gray-900 p-2 text-center font-normal">${r.count}</td>
                                <td class="border border-gray-900 p-2 text-right font-normal">${formatNumberVn(r.price)}</td>
                                <td class="border border-gray-900 p-2 text-right font-normal">${formatNumberVn(r.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="border border-gray-900 p-2 text-center font-normal">Cộng</td>
                            <td class="border border-gray-900 p-2 text-right font-normal">${formatNumberVn(sumPreTax)}</td>
                        </tr>
                        <tr>
                            <td colspan="5" class="border border-gray-900 p-2 text-center font-normal">${vatLabel}</td>
                            <td class="border border-gray-900 p-2 text-right font-normal">${formatNumberVn(sumVat)}</td>
                        </tr>
                        <tr class="font-bold">
                            <td colspan="5" class="border border-gray-900 p-2 text-center">THÀNH TIỀN</td>
                            <td class="border border-gray-900 p-2 text-right font-bold">${formatNumberVn(sumTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;

    el('vat-preview-modal').classList.remove('hidden');
    bringModalToFront(el('vat-preview-modal'));
}

function closeVatPreviewModal() {
    const modal = document.getElementById('vat-preview-modal');
    if (modal) modal.classList.add('hidden');
    syncModalStack();
}

function printVatPreview() {
    const paper = document.getElementById('vat-preview-paper');
    if (!paper) return;

    const printWin = window.open('', '_blank', 'width=850,height=750');
    if (!printWin) {
        window.print();
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bảng Kê Hóa Đơn VAT</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 25px; margin: 0; color: #000; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
                th { text-align: center; font-weight: bold; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .font-bold { font-weight: bold; }
                .font-normal { font-weight: normal; }
            </style>
        </head>
        <body>
            ${paper.innerHTML}
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 350);
}

// ---------------------------------------------------------
// XUẤT FILE EXCEL (.XLSX) CHUẨN ĐÚNG THEO ẢNH MẪU
// ---------------------------------------------------------

async function executeExportVatExcel() {
    if (typeof XLSX === 'undefined') {
        Swal.fire('Lỗi', 'Thư viện xuất Excel (xlsx-js-style) chưa được nạp. Vui lòng tải lại trang!', 'error');
        return;
    }

    const el = (id) => document.getElementById(id);
    const selectedTransactions = currentViewingCustomerInvoices.filter(t => selectedVatInvoiceIds.has(t.id || t.docId));
    if (selectedTransactions.length === 0 || currentVatGridRows.length === 0) {
        Swal.fire('Lỗi', 'Không có dữ liệu phiếu để xuất hóa đơn!', 'error');
        return;
    }

    const buyerName = el('ve-buyer-name') ? el('ve-buyer-name').value.trim() : '';
    const companyName = el('ve-company') ? el('ve-company').value.trim() : '';
    const taxCode = el('ve-tax-code') ? el('ve-tax-code').value.trim() : '';
    const taxAddress = el('ve-tax-address') ? el('ve-tax-address').value.trim() : '';
    const taxEmail = el('ve-email') ? el('ve-email').value.trim() : '';
    const rateVal = el('ve-vat-rate') ? el('ve-vat-rate').value : '10';
    const vatRate = rateVal === 'none' ? 0 : (parseFloat(rateVal) / 100);
    const autoMark = el('ve-auto-mark-checked') ? el('ve-auto-mark-checked').checked : true;

    if (!companyName) {
        Swal.fire('Lưu ý', 'Vui lòng nhập Tên đơn vị / Tên công ty mua hàng!', 'warning');
        return;
    }

    try {
        Swal.fire({ title: 'Đang tạo file Excel chuẩn...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Tính toán các tổng
        const sumPreTax = currentVatGridRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
        const sumVat = vatRate > 0 ? Math.round(sumPreTax * vatRate) : 0;
        const sumTotal = sumPreTax + sumVat;
        const vatLabel = rateVal === 'none' ? 'KCT' : (rateVal === '0' ? 'VAT 0%' : `VAT ${rateVal}%`);

        // Dữ liệu ma trận theo đúng 100% mẫu trong ảnh
        const aoa = [
            [`Họ tên người mua hàng (Buyer): ${buyerName}`],
            [`Tên đơn vị (Company's name): ${companyName}`],
            [`Mã số thuế (Tax code): ${taxCode}`],
            [`Địa chỉ (Address): ${taxAddress}`],
            [`Email nhận hóa đơn: ${taxEmail}`],
            ['STT', 'Tên hàng', 'ĐVTính', 'Số Lượng', 'Đơn Giá', 'Thành Tiền']
        ];

        currentVatGridRows.forEach((r, idx) => {
            aoa.push([
                idx + 1,
                r.name || '',
                r.unit || 'buổi',
                Number(r.count) || 0,
                Number(r.price) || 0,
                Number(r.total) || 0
            ]);
        });

        aoa.push(['Cộng', '', '', '', '', Number(sumPreTax)]);
        aoa.push([vatLabel, '', '', '', '', Number(sumVat)]);
        aoa.push(['THÀNH TIỀN', '', '', '', '', Number(sumTotal)]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Định dạng font Times New Roman và viền ô chuẩn kế toán
        const fontStandard = { name: 'Times New Roman', sz: 11, color: { rgb: '000000' } };
        const fontBold = { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '000000' } };
        const borderThin = {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
        };

        // 1. Dòng 0 đến 4: Thông tin người mua
        for (let r = 0; r < 5; r++) {
            const ref = XLSX.utils.encode_cell({ r: r, c: 0 });
            if (ws[ref]) {
                ws[ref].s = {
                    font: fontStandard,
                    alignment: { horizontal: 'left', vertical: 'center' }
                };
            }
        }

        // 2. Dòng 5: Tiêu đề bảng dịch vụ (Header)
        for (let c = 0; c < 6; c++) {
            const ref = XLSX.utils.encode_cell({ r: 5, c: c });
            if (!ws[ref]) ws[ref] = { v: '', t: 's' };
            ws[ref].s = {
                font: fontBold,
                alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                border: borderThin
            };
        }

        // 3. Các dòng dịch vụ (Item rows)
        const numItems = currentVatGridRows.length;
        for (let i = 0; i < numItems; i++) {
            const r = 6 + i;
            // STT (Cột 0)
            const ref0 = XLSX.utils.encode_cell({ r: r, c: 0 });
            if (ws[ref0]) {
                ws[ref0].s = { font: fontStandard, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin };
            }
            // Tên hàng (Cột 1)
            const ref1 = XLSX.utils.encode_cell({ r: r, c: 1 });
            if (ws[ref1]) {
                ws[ref1].s = { font: fontStandard, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: borderThin };
            }
            // ĐVTính (Cột 2)
            const ref2 = XLSX.utils.encode_cell({ r: r, c: 2 });
            if (ws[ref2]) {
                ws[ref2].s = { font: fontStandard, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin };
            }
            // Số Lượng (Cột 3)
            const ref3 = XLSX.utils.encode_cell({ r: r, c: 3 });
            if (ws[ref3]) {
                ws[ref3].s = { font: fontStandard, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin };
            }
            // Đơn Giá (Cột 4)
            const ref4 = XLSX.utils.encode_cell({ r: r, c: 4 });
            if (ws[ref4]) {
                ws[ref4].z = '#,##0';
                ws[ref4].s = { font: fontStandard, alignment: { horizontal: 'right', vertical: 'center' }, border: borderThin };
            }
            // Thành Tiền (Cột 5)
            const ref5 = XLSX.utils.encode_cell({ r: r, c: 5 });
            if (ws[ref5]) {
                ws[ref5].z = '#,##0';
                ws[ref5].s = { font: fontStandard, alignment: { horizontal: 'right', vertical: 'center' }, border: borderThin };
            }
        }

        // 4. Các dòng tổng cộng (Cộng, VAT, THÀNH TIỀN)
        const rowCong = 6 + numItems;
        const rowVat = rowCong + 1;
        const rowThanhTien = rowCong + 2;

        ws['!merges'] = [
            { s: { r: rowCong, c: 0 }, e: { r: rowCong, c: 4 } },
            { s: { r: rowVat, c: 0 }, e: { r: rowVat, c: 4 } },
            { s: { r: rowThanhTien, c: 0 }, e: { r: rowThanhTien, c: 4 } }
        ];

        [
            { row: rowCong, font: fontStandard },
            { row: rowVat, font: fontStandard },
            { row: rowThanhTien, font: fontBold }
        ].forEach(summary => {
            for (let c = 0; c <= 4; c++) {
                const ref = XLSX.utils.encode_cell({ r: summary.row, c: c });
                if (!ws[ref]) ws[ref] = { v: '', t: 's' };
                ws[ref].s = {
                    font: summary.font,
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: borderThin
                };
            }
            const refNum = XLSX.utils.encode_cell({ r: summary.row, c: 5 });
            if (!ws[refNum]) ws[refNum] = { v: 0, t: 'n' };
            ws[refNum].z = '#,##0';
            ws[refNum].s = {
                font: summary.font,
                alignment: { horizontal: 'right', vertical: 'center' },
                border: borderThin
            };
        });

        // Thiết lập độ rộng cột cân đối
        ws['!cols'] = [
            { wch: 8 },  // STT
            { wch: 44 }, // Tên hàng
            { wch: 10 }, // ĐVTính
            { wch: 12 }, // Số Lượng
            { wch: 16 }, // Đơn Giá
            { wch: 18 }  // Thành Tiền
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDonVAT');

        const d = new Date();
        const safeCustName = removeVietnameseTones(companyName || 'Khach').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Hoa_Don_VAT_${safeCustName}_${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}.xlsx`;

        XLSX.writeFile(wb, filename);

        // Đánh dấu chuyển sang Chờ xuất (Đã gửi kế toán) nếu có tích chọn
        if (autoMark && db) {
            const batch = db.batch();
            selectedTransactions.forEach(t => {
                const targetDocId = t.id || t.docId;
                if (targetDocId) {
                    const docRef = db.collection('transactions').doc(targetDocId);
                    batch.set(docRef, {
                        vatStatus: 'pending',
                        vatExported: 'pending',
                        vatRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    t.vatStatus = 'pending';
                    t.vatExported = 'pending';
                    const cached = cachedTransactions.find(ct => (ct.id === targetDocId || ct.docId === targetDocId));
                    if (cached) {
                        cached.vatStatus = 'pending';
                        cached.vatExported = 'pending';
                    }
                }
            });
            await batch.commit();
            renderVcInvoicesTable();
        }

        closeVatPreviewModal();
        closeVatExportModal();

        Swal.fire({
            icon: 'success',
            title: 'Xuất File Excel Thành Công!',
            html: `Đã tạo file chuẩn: <b>${filename}</b>.<br>Kế toán có thể nạp trực tiếp vào phần mềm hóa đơn điện tử.`,
            confirmButtonColor: '#059669',
            confirmButtonText: 'Đã hiểu'
        });

    } catch (err) {
        console.error("Lỗi xuất Excel VAT:", err);
        Swal.fire('Lỗi', 'Không thể tạo file Excel: ' + err.message, 'error');
    }
}



async function fetchCustomerCompensations(phoneId) {
    if (!db || !phoneId) return;

    const el = (id) => document.getElementById(id);
    const tbody = el('vc-compensations-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-1.5 text-amber-600"></i> Đang tải danh sách bù sân...</td></tr>';

    try {
        const snap = await db.collection('compensations')
            .where('customerPhone', '==', phoneId)
            .get();

        const list = [];
        snap.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });

        // Sắp xếp ngày nghỉ mới nhất lên đầu
        list.sort((a, b) => {
            const dateA = a.missedDate || '';
            const dateB = b.missedDate || '';
            return dateB.localeCompare(dateA);
        });

        currentCustomerCompensations = list;

        // Cập nhật thống kê
        const pendingCount = list.filter(c => c.status !== 'completed').reduce((sum, c) => sum + (parseInt(c.sessionsCount) || 1), 0);
        if (el('vc-pending-comp-stat')) el('vc-pending-comp-stat').textContent = `${pendingCount} buổi`;
        if (el('vc-badge-compensations')) el('vc-badge-compensations').textContent = `${pendingCount}`;

        renderCompensationsTable();
    } catch (e) {
        console.error("Lỗi tải bù sân:", e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-red-500">Lỗi khi tải danh sách bù sân.</td></tr>';
    }
}

function renderCompensationsTable() {
    const el = (id) => document.getElementById(id);
    const tbody = el('vc-compensations-body');
    if (!tbody) return;

    if (currentCustomerCompensations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-5 text-center text-gray-400 italic">Chưa có ghi chú bù sân nào cho khách này. Bấm "Thêm Ghi Chú Bù Sân" để ghi nhận.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    currentCustomerCompensations.forEach(comp => {
        let displayMissedDate = comp.missedDate || '---';
        if (displayMissedDate.includes('-')) {
            const [y, m, d] = displayMissedDate.split('-');
            displayMissedDate = `${d}/${m}/${y}`;
        }

        // Căn cứ xác nhận (ảnh)
        let proofHtml = '<span class="text-gray-400 italic text-[11px]">Không có</span>';
        if (comp.proofImage) {
            proofHtml = `
                <div class="inline-flex items-center gap-1 cursor-pointer group" onclick="viewLargeProofImage('${comp.proofImage}')" title="Bấm để xem ảnh lớn">
                    <img src="${comp.proofImage}" class="w-8 h-8 rounded object-cover border group-hover:scale-110 transition shadow-sm" alt="Ảnh căn cứ">
                    <i class="fa-solid fa-magnifying-glass-plus text-xs text-amber-600"></i>
                </div>
            `;
        }

        // Trạng thái
        const isDone = (comp.status === 'completed');
        let statusBadge = '';
        if (isDone) {
            statusBadge = `
                <button type="button" onclick="toggleCompensationStatus('${comp.id}', true)" title="Bấm để chuyển về Chờ bù" class="px-2 py-0.5 bg-green-100 text-green-800 hover:bg-green-200 rounded font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer">
                    <i class="fa-solid fa-circle-check"></i> Đã bù
                </button>
            `;
        } else {
            statusBadge = `
                <button type="button" onclick="toggleCompensationStatus('${comp.id}', false)" title="Bấm để đánh dấu Đã bù" class="px-2 py-0.5 bg-amber-100 text-amber-800 hover:bg-green-100 hover:text-green-800 rounded font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer">
                    <i class="fa-regular fa-clock"></i> Chờ bù
                </button>
            `;
        }

        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-amber-50/40 transition text-xs";
        tr.innerHTML = `
            <td class="p-2.5 border font-bold text-gray-800 whitespace-nowrap"><i class="fa-regular fa-calendar-xmark text-amber-600 mr-1"></i>${displayMissedDate}</td>
            <td class="p-2.5 border text-gray-700 whitespace-nowrap"><b>${comp.courtName || 'Sân hợp đồng'}</b><br><span class="text-[11px] font-mono text-gray-500">${comp.timeRange || '---'}</span></td>
            <td class="p-2.5 border text-gray-700 max-w-[200px]">
                <div class="font-medium text-amber-900">${comp.reason || '---'}</div>
                ${comp.note ? `<div class="text-[11px] text-gray-500 italic truncate" title="${comp.note}">${comp.note}</div>` : ''}
            </td>
            <td class="p-2.5 border text-center font-bold text-amber-700 text-sm">${comp.sessionsCount || 1}</td>
            <td class="p-2.5 border text-center whitespace-nowrap">${proofHtml}</td>
            <td class="p-2.5 border text-center whitespace-nowrap">${statusBadge}</td>
            <td class="p-2.5 border text-center whitespace-nowrap">
                <button onclick="openEditCompensationModal('${comp.id}')" title="Sửa ghi chú" class="inline-flex items-center justify-center w-7 h-7 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition mr-1">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button onclick="deleteCompensation('${comp.id}')" title="Xóa" class="inline-flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-500 hover:bg-red-100 transition">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAddCompensationModal() {
    const cust = customersList.find(c => c.phoneId === currentViewingPhone || c.rawDocId === currentViewingPhone);
    const el = (id) => document.getElementById(id);

    el('comp-modal-title').innerHTML = '<i class="fa-solid fa-calendar-xmark mr-1.5"></i> Thêm Ghi Chú Bù Sân';
    el('comp-edit-id').value = '';
    el('comp-cust-phone').value = currentViewingPhone;
    el('comp-cust-name-display').textContent = cust ? cust.name : 'Khách hàng';
    el('comp-cust-phone-display').textContent = currentViewingPhone;

    // Hôm nay
    const d = new Date();
    const todayISO = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    el('comp-missed-date').value = todayISO;
    el('comp-sessions-count').value = '1';
    el('comp-court-name').value = '';
    el('comp-time-range').value = '';
    el('comp-reason-select').value = 'Thời tiết mưa to / ngập sân';
    el('comp-custom-reason').value = '';
    el('comp-custom-reason').classList.add('hidden');
    el('comp-note').value = '';
    el('comp-status').value = 'pending';

    removeCompImage();
    el('comp-modal').classList.remove('hidden');
}

function openEditCompensationModal(compId) {
    const comp = currentCustomerCompensations.find(c => c.id === compId);
    if (!comp) return;

    const cust = customersList.find(c => c.phoneId === currentViewingPhone || c.rawDocId === currentViewingPhone);
    const el = (id) => document.getElementById(id);

    el('comp-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square mr-1.5"></i> Sửa Ghi Chú Bù Sân';
    el('comp-edit-id').value = comp.id;
    el('comp-cust-phone').value = currentViewingPhone;
    el('comp-cust-name-display').textContent = cust ? cust.name : 'Khách hàng';
    el('comp-cust-phone-display').textContent = currentViewingPhone;

    el('comp-missed-date').value = comp.missedDate || '';
    el('comp-sessions-count').value = comp.sessionsCount || 1;
    el('comp-court-name').value = comp.courtName || '';
    el('comp-time-range').value = comp.timeRange || '';
    
    // Lý do
    const standardReasons = [
        "Thời tiết mưa to / ngập sân",
        "Sân bảo trì / sửa chữa định kỳ",
        "Giải đấu / Sự kiện đặc biệt của trung tâm",
        "Khách xin hoãn / báo nghỉ trước có xác nhận"
    ];
    if (standardReasons.includes(comp.reason)) {
        el('comp-reason-select').value = comp.reason;
        el('comp-custom-reason').value = '';
        el('comp-custom-reason').classList.add('hidden');
    } else {
        el('comp-reason-select').value = 'other';
        el('comp-custom-reason').value = comp.reason || '';
        el('comp-custom-reason').classList.remove('hidden');
    }

    el('comp-note').value = comp.note || '';
    el('comp-status').value = comp.status || 'pending';

    if (comp.proofImage) {
        currentCompUploadedBase64 = comp.proofImage;
        el('comp-image-preview').src = comp.proofImage;
        el('comp-image-preview-box').classList.remove('hidden');
        el('comp-upload-placeholder').classList.add('hidden');
    } else {
        removeCompImage();
    }

    el('comp-modal').classList.remove('hidden');
}

function closeCompModal() {
    const modal = document.getElementById('comp-modal');
    if (modal) modal.classList.add('hidden');
    currentCompUploadedBase64 = null;
}

function checkCustomReason(val) {
    const customInput = document.getElementById('comp-custom-reason');
    if (!customInput) return;
    if (val === 'other') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
    }
}

// Xử lý nén ảnh qua Canvas để lưu trữ nhanh, nhẹ, không lo giới hạn
function handleCompImageSelected(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const el = (id) => document.getElementById(id);
    el('comp-img-name').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 1200;
            const maxHeight = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Nén JPEG chất lượng 0.75 -> file siêu nhẹ (~80KB - 150KB)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            currentCompUploadedBase64 = compressedDataUrl;

            el('comp-image-preview').src = compressedDataUrl;
            el('comp-image-preview-box').classList.remove('hidden');
            el('comp-upload-placeholder').classList.add('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeCompImage() {
    currentCompUploadedBase64 = null;
    const el = (id) => document.getElementById(id);
    if (el('comp-image-input')) el('comp-image-input').value = '';
    if (el('comp-image-preview-box')) el('comp-image-preview-box').classList.add('hidden');
    if (el('comp-upload-placeholder')) el('comp-upload-placeholder').classList.remove('hidden');
}

function viewLargeProofImage(src) {
    if (!src) return;
    const modal = document.getElementById('comp-image-modal');
    const img = document.getElementById('comp-large-image');
    if (modal && img) {
        img.src = src;
        modal.classList.remove('hidden');
    }
}

function closeLargeProofImage() {
    const modal = document.getElementById('comp-image-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveCompensation() {
    if (!db) {
        Swal.fire('Lỗi', 'Không thể kết nối cơ sở dữ liệu!', 'error');
        return;
    }

    const el = (id) => document.getElementById(id);
    const editId = el('comp-edit-id').value;
    const phone = el('comp-cust-phone').value;
    const missedDate = el('comp-missed-date').value;
    const sessionsCount = parseInt(el('comp-sessions-count').value, 10) || 1;
    const courtName = el('comp-court-name').value.trim();
    const timeRange = el('comp-time-range').value.trim();
    const reasonSelect = el('comp-reason-select').value;
    const customReason = el('comp-custom-reason').value.trim();
    const reason = reasonSelect === 'other' ? (customReason || 'Lý do khác') : reasonSelect;
    const note = el('comp-note').value.trim();
    const status = el('comp-status').value;

    if (!missedDate) {
        Swal.fire('Thiếu thông tin', 'Vui lòng chọn ngày bị nghỉ!', 'warning');
        return;
    }

    const payload = {
        customerPhone: phone,
        missedDate: missedDate,
        sessionsCount: sessionsCount,
        courtName: courtName,
        timeRange: timeRange,
        reason: reason,
        note: note,
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (currentCompUploadedBase64) {
        payload.proofImage = currentCompUploadedBase64;
    }

    try {
        Swal.fire({ title: 'Đang lưu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        if (editId) {
            await db.collection('compensations').doc(editId).set(payload, { merge: true });
        } else {
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('compensations').add(payload);
        }

        closeCompModal();
        await fetchCustomerCompensations(phone);

        Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: editId ? 'Đã cập nhật ghi chú bù sân.' : 'Đã thêm ghi chú bù sân mới.',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        console.error("Lỗi lưu ghi chú bù sân:", e);
        Swal.fire('Lỗi', 'Không thể lưu ghi chú bù sân. Vui lòng thử lại!', 'error');
    }
}

async function deleteCompensation(compId) {
    if (!db || !compId) return;

    const result = await Swal.fire({
        title: 'Xóa ghi chú bù sân?',
        text: 'Ghi chú này sẽ bị xóa khỏi hệ thống!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Xóa ngay',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        await db.collection('compensations').doc(compId).delete();
        await fetchCustomerCompensations(currentViewingPhone);
        Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        console.error("Lỗi xóa bù sân:", e);
        Swal.fire('Lỗi', 'Không thể xóa ghi chú!', 'error');
    }
}

async function toggleCompensationStatus(compId, currentIsCompleted) {
    if (!db || !compId) return;
    const newStatus = currentIsCompleted ? 'pending' : 'completed';

    try {
        await db.collection('compensations').doc(compId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await fetchCustomerCompensations(currentViewingPhone);
        Swal.fire({
            icon: 'success',
            title: newStatus === 'completed' ? 'Đã đánh dấu Đã Bù Xong!' : 'Đã chuyển về Chờ Bù!',
            toast: true,
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        console.error("Lỗi cập nhật trạng thái bù sân:", e);
        Swal.fire('Lỗi', 'Không thể cập nhật trạng thái!', 'error');
    }
}

function closeViewCustomerModal() {
    const modal = document.getElementById('view-customer-modal');
    if (modal) modal.classList.add('hidden');
    currentViewingPhone = '';
    selectedVatInvoiceIds.clear();
}

// ==========================================
// CUSTOMER AUTOCOMPLETE
// ==========================================

function setupAutocomplete() {
    const phoneInput = document.getElementById('cust-phone');
    const nameInput = document.getElementById('cust-name');
    const phoneList = document.getElementById('autocomplete-phone');
    const nameList = document.getElementById('autocomplete-name');

    if(!phoneInput || !nameInput || !phoneList || !nameList) return;

    function renderList(inputEl, listEl, keyField) {
        const val = inputEl.value.toLowerCase().trim();
        listEl.innerHTML = '';
        if (val.length < 2) {
            listEl.classList.add('hidden');
            return;
        }

        let matches = customersList.filter(c => (c[keyField] || '').toLowerCase().includes(val)).slice(0, 5);
        if (matches.length === 0) {
            listEl.classList.add('hidden');
            return;
        }

        matches.forEach(m => {
            const li = document.createElement('li');
            li.className = "p-3 border-b cursor-pointer hover:bg-blue-50 transition text-sm flex justify-between items-center";
            li.innerHTML = `<div><span class="font-bold text-blue-700">${m.name}</span> <span class="text-xs text-gray-500 ml-1">(${m.gender})</span></div> <div class="font-mono text-gray-600 font-bold bg-gray-100 px-2 py-1 rounded">${m.phoneId}</div>`;
            li.onclick = () => {
                document.getElementById('cust-name').value = m.name || '';
                document.getElementById('cust-phone').value = m.phoneId || '';
                if (document.getElementById('cust-team')) document.getElementById('cust-team').value = m.team || '';
                document.getElementById('cust-company').value = m.company || '';
                if (document.getElementById('cust-tax-code')) document.getElementById('cust-tax-code').value = m.taxCode || '';
                if (document.getElementById('cust-tax-address')) document.getElementById('cust-tax-address').value = m.taxAddress || '';
                if (m.gender) document.getElementById('cust-gender').value = m.gender;
                
                // Mở khối thông tin doanh nghiệp nếu có dữ liệu
                if (m.company || m.taxCode || m.taxAddress) {
                    const bizFields = document.getElementById('cust-biz-fields');
                    const toggleIcon = document.getElementById('cust-biz-toggle-icon');
                    if (bizFields) bizFields.classList.remove('hidden');
                    if (toggleIcon) toggleIcon.classList.add('rotate-180');
                }
                
                document.getElementById('cust-name').dispatchEvent(new Event('input'));
                document.getElementById('cust-phone').dispatchEvent(new Event('input'));
                
                listEl.classList.add('hidden');
            };
            listEl.appendChild(li);
        });
        listEl.classList.remove('hidden');
    }

    phoneInput.addEventListener('input', () => { renderList(phoneInput, phoneList, 'phoneId'); nameList.classList.add('hidden'); });
    nameInput.addEventListener('input', () => { renderList(nameInput, nameList, 'name'); phoneList.classList.add('hidden'); });

    document.addEventListener('click', (e) => {
        if (e.target !== phoneInput && e.target !== phoneList) phoneList.classList.add('hidden');
        if (e.target !== nameInput && e.target !== nameList) nameList.classList.add('hidden');
    });
}

// ==========================================
// PAYMENT NOTIFICATIONS
// ==========================================
function showPaymentNotification(name, amount, invId) {
    // Thử phát tiếng "Ting" (trình duyệt có thể chặn nếu user chưa từng click vào web)
    try {
        // Âm thanh máy tính tiền (Cash Register)
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
        audio.play().catch(e => console.warn('Trình duyệt ẩn âm thanh tự động:', e));
    } catch(e) {}

    const custName = name || 'Khách vãng lai';
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Ting Ting! Tiền Về!',
        html: `Phiếu <b>${invId}</b> của <b>${custName}</b> vừa được thanh toán xong!<br><span class="text-green-600 font-bold text-lg">${formatVND(amount)}</span>`,
        showConfirmButton: false,
        timer: 6000,
        timerProgressBar: true,
        background: '#f0fdf4', // Xanh nhạt
        color: '#166534',
        iconColor: '#22c55e',
        customClass: {
            title: 'font-bold text-green-800'
        }
    });
}

// ==========================================
// TICKET RENEWAL / GIA HẠN PHIẾU (TÍCH HỢP TỰ ĐỘNG BÙ SÂN)
// ==========================================

let currentRenewData = null;
let currentRenewCalculatedItems = [];
let currentRenewAvailableCompensations = [];
let currentRenewSelectedCompIds = new Set();
let currentRenewCompDeduction = 0;

async function openRenewModal(dataStrEncoded) {
    const data = JSON.parse(decodeURIComponent(dataStrEncoded));
    currentRenewData = data;
    currentRenewSelectedCompIds.clear();
    currentRenewCompDeduction = 0;
    currentRenewAvailableCompensations = [];

    const el = (id) => document.getElementById(id);
    if (!el('renew-modal')) return;

    const origId = data.id || `CŨ-${(data.docId || '').slice(0, 6).toUpperCase()}`;
    el('rn-original-id').textContent = origId;
    el('rn-cust-name').textContent = data.customerName || 'Vãng lai';
    el('rn-cust-phone').textContent = data.customerPhone ? `(${data.customerPhone})` : '';

    let origStartStr = data.startDate || '---';
    let origEndStr = data.endDate || '---';
    if (origStartStr.includes('-')) { const [y, m, d] = origStartStr.split('-'); origStartStr = `${d}/${m}/${y}`; }
    if (origEndStr.includes('-')) { const [y, m, d] = origEndStr.split('-'); origEndStr = `${d}/${m}/${y}`; }
    el('rn-original-dates').textContent = `${origStartStr} - ${origEndStr}`;

    // Xác định mốc thời gian kết thúc thực tế của phiếu cũ (quét cả items) để gợi ý tháng mới chính xác
    const effectiveDates = getEffectiveTransactionDates(data);
    let baseDate = effectiveDates.endDateObj || new Date();

    // Tạo các options gợi ý tháng tiếp theo (+1 tháng, +2 tháng, +3 tháng)
    const monthSelect = el('rn-month-select');
    monthSelect.innerHTML = '';

    const monthOptions = [];
    for (let i = 1; i <= 3; i++) {
        const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
        const y = nextMonthDate.getFullYear();
        const m = nextMonthDate.getMonth() + 1; // 1-indexed
        const lastDay = new Date(y, m, 0).getDate();
        
        const startISO = `${y}-${m.toString().padStart(2, '0')}-01`;
        const endISO = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        const label = i === 1 
            ? `Tháng ${m}/${y} (Tháng tiếp theo)` 
            : `Tháng ${m}/${y} (+${i} tháng)`;

        monthOptions.push({ value: `${startISO}|${endISO}`, label: label, startISO, endISO });
    }

    monthOptions.forEach((opt, idx) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (idx === 0) option.selected = true;
        monthSelect.appendChild(option);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Tùy chỉnh khoảng ngày...';
    monthSelect.appendChild(customOpt);

    // Mặc định chọn tháng kế tiếp
    el('rn-start-date').value = monthOptions[0].startISO;
    el('rn-end-date').value = monthOptions[0].endISO;

    // Ghi chú và trạng thái
    el('rn-note').value = `Gia hạn cố định`;
    el('rn-status').value = 'unpaid';
    el('rn-payment-method').value = data.paymentMethod || 'Chuyển khoản';

    // KIỂM TRA CÁC BUỔI CHỜ BÙ CỦA KHÁCH ĐỂ HIỂN THỊ CHỌN BÙ TRỪ
    const phone = data.customerPhone || '';
    const compContainer = el('rn-comp-container');
    const compList = el('rn-comp-list');
    
    if (phone && db) {
        try {
            const snap = await db.collection('compensations')
                .where('customerPhone', '==', phone)
                .get();

            const pendingComps = [];
            snap.forEach(d => {
                const c = d.data();
                if (c.status !== 'completed') {
                    pendingComps.push({ id: d.id, ...c });
                }
            });

            currentRenewAvailableCompensations = pendingComps;

            if (pendingComps.length > 0 && compContainer && compList) {
                el('rn-comp-avail-count').textContent = `${pendingComps.length} buổi chờ bù`;
                compList.innerHTML = '';

                pendingComps.forEach(c => {
                    let dStr = c.missedDate || '';
                    if (dStr.includes('-')) {
                        const [cy, cm, cd] = dStr.split('-');
                        dStr = `${cd}/${cm}/${cy}`;
                    }

                    const div = document.createElement('div');
                    div.className = "flex items-center justify-between p-2 bg-white rounded border border-amber-200 text-xs";
                    div.innerHTML = `
                        <label class="flex items-center gap-2 cursor-pointer font-medium text-gray-800 flex-1 min-w-0">
                            <input type="checkbox" value="${c.id}" onchange="toggleRenewCompensation('${c.id}', this.checked)" class="rounded text-amber-600 focus:ring-amber-500">
                            <span class="truncate">Ngày <b>${dStr}</b>: ${c.reason || 'Nghỉ'} (${c.sessionsCount || 1} buổi)</span>
                        </label>
                        <span class="font-bold text-amber-700 font-mono text-[11px] whitespace-nowrap ml-2">${c.courtName || ''}</span>
                    `;
                    compList.appendChild(div);
                });

                compContainer.classList.remove('hidden');
            } else if (compContainer) {
                compContainer.classList.add('hidden');
            }
        } catch (e) {
            console.warn("Lỗi tải buổi bù khi gia hạn:", e);
            if (compContainer) compContainer.classList.add('hidden');
        }
    } else if (compContainer) {
        compContainer.classList.add('hidden');
    }

    // Render xem trước lịch và tính toán số buổi
    renderRenewPreview();

    // Hiển thị modal
    el('renew-modal').classList.remove('hidden');
}

function toggleRenewCompensation(compId, checked) {
    if (checked) {
        currentRenewSelectedCompIds.add(compId);
    } else {
        currentRenewSelectedCompIds.delete(compId);
    }
    renderRenewPreview();
}

function closeRenewModal() {
    const modal = document.getElementById('renew-modal');
    if (modal) modal.classList.add('hidden');
    currentRenewData = null;
    currentRenewCalculatedItems = [];
    currentRenewAvailableCompensations = [];
    currentRenewSelectedCompIds.clear();
    currentRenewCompDeduction = 0;
}

function renderRenewPreview() {
    if (!currentRenewData) return;

    const el = (id) => document.getElementById(id);
    const startDateVal = el('rn-start-date').value;
    const endDateVal = el('rn-end-date').value;

    const tbody = el('rn-items-table');
    tbody.innerHTML = '';

    if (!startDateVal || !endDateVal) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-500 font-medium">Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.</td></tr>';
        el('rn-total-sessions').textContent = '0 buổi';
        el('rn-total-amount').textContent = '0 ₫';
        currentRenewCalculatedItems = [];
        return;
    }

    const [sy, sm, sd] = startDateVal.split('-').map(Number);
    const [ey, em, ed] = endDateVal.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);

    if (startDate > endDate) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-500 font-medium">Ngày kết thúc phải sau hoặc bằng ngày bắt đầu!</td></tr>';
        el('rn-total-sessions').textContent = '0 buổi';
        el('rn-total-amount').textContent = '0 ₫';
        currentRenewCalculatedItems = [];
        return;
    }

    const origItems = currentRenewData.items || [];
    currentRenewCalculatedItems = [];

    let totalSessions = 0;
    let subTotal = 0;

    origItems.forEach(orig => {
        let weekdays = [];
        if (orig.weekdays && Array.isArray(orig.weekdays) && orig.weekdays.length > 0) {
            weekdays = orig.weekdays.map(Number);
        } else {
            const str = (orig.desc || '') + ' ' + (orig.name || '');
            const map = { 'CN': 0, 'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6 };
            for (let k in map) {
                if (str.includes(k)) weekdays.push(map[k]);
            }
            if (weekdays.length === 0) weekdays = [1, 2, 3, 4, 5, 6, 0];
        }

        // Đếm số buổi thực tế trong khoảng ngày mới
        let count = 0;
        let cur = new Date(startDate);
        while (cur <= endDate) {
            const dayOfWeek = cur.getDay();
            if (weekdays.includes(dayOfWeek)) {
                count++;
            }
            cur.setDate(cur.getDate() + 1);
        }

        // Trích xuất khung giờ từ desc cũ (VD: "(18:00-20:00)")
        let timeStr = '---';
        const matchTime = (orig.desc || '').match(/\((\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\)/);
        if (matchTime) {
            timeStr = `${matchTime[1]}-${matchTime[2]}`;
        }

        let duration = parseFloat(orig.duration);
        if (isNaN(duration) || duration <= 0) {
            if (matchTime) duration = calculateHours(matchTime[1], matchTime[2]);
            else duration = 1;
        }

        const price = parseFloat(orig.price) || 0;
        const itemTotal = count * duration * price;

        totalSessions += count;
        subTotal += itemTotal;

        const daysText = weekdays.length === 7 ? 'Tất cả các ngày' : weekdays.map(d => d === 0 ? 'CN' : 'T' + (d + 1)).join(', ');

        const newItem = {
            id: Date.now() + Math.random(),
            name: orig.name,
            weekdays: weekdays,
            desc: `${formatDate(startDate)} - ${formatDate(endDate)} (${timeStr})`,
            startDateStr: startDateVal,
            endDateStr: endDateVal,
            originalCount: count,
            timeRange: timeStr,
            skipped: [],
            count: count,
            duration: duration,
            price: price,
            total: itemTotal
        };
        currentRenewCalculatedItems.push(newItem);

        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-teal-50/50 transition";
        tr.innerHTML = `
            <td class="p-2.5 border-r font-bold text-gray-800">${orig.name}</td>
            <td class="p-2.5 border-r text-indigo-600 font-semibold">${daysText}</td>
            <td class="p-2.5 border-r text-center font-mono text-gray-600">${timeStr}</td>
            <td class="p-2.5 border-r text-center font-bold text-teal-700 bg-teal-50/40">${count} buổi</td>
            <td class="p-2.5 border-r text-right font-medium text-gray-700">${formatVND(price)}</td>
            <td class="p-2.5 text-right font-bold text-gray-800">${formatVND(itemTotal)}</td>
        `;
        tbody.appendChild(tr);
    });

    if (origItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-gray-400 italic">Phiếu gốc không chứa thông tin chi tiết dịch vụ/sân đặt.</td></tr>';
    }

    // TÍNH TOÁN BÙ SÂN NẾU ĐƯỢC CHỌN
    let compSessionsCount = 0;
    currentRenewAvailableCompensations.forEach(c => {
        if (currentRenewSelectedCompIds.has(c.id)) {
            compSessionsCount += (parseInt(c.sessionsCount, 10) || 1);
        }
    });

    let deduction = 0;
    if (compSessionsCount > 0 && totalSessions > 0) {
        const avgSessionPrice = subTotal / totalSessions;
        deduction = Math.round(compSessionsCount * avgSessionPrice);
    }
    currentRenewCompDeduction = deduction;

    if (el('rn-comp-deduction-text')) {
        el('rn-comp-deduction-text').textContent = deduction > 0 ? `-${formatVND(deduction)} (${compSessionsCount} buổi)` : '-0 ₫';
    }

    // Tổng sau khi trừ buổi bù
    const totalAfterComp = Math.max(0, subTotal - deduction);

    // Tính thuế VAT nếu phiếu gốc có thuế
    let vatAmount = 0;
    if (currentRenewData.vatAmount && currentRenewData.vatAmount > 0) {
        vatAmount = Math.round(totalAfterComp * 0.10);
    }
    const finalTotal = totalAfterComp + vatAmount;

    el('rn-total-sessions').textContent = `${totalSessions} buổi` + (compSessionsCount > 0 ? ` (Bù trừ ${compSessionsCount} buổi)` : '');
    el('rn-total-amount').textContent = formatVND(finalTotal);
}

async function submitRenewDirect() {
    if (!currentRenewData || currentRenewCalculatedItems.length === 0) {
        Swal.fire('Lỗi', 'Không có lịch sân hợp lệ để gia hạn!', 'error');
        return;
    }

    if (!db) {
        Swal.fire('Lỗi', 'Không thể kết nối cơ sở dữ liệu!', 'error');
        return;
    }

    const el = (id) => document.getElementById(id);
    const startDateVal = el('rn-start-date').value;
    const endDateVal = el('rn-end-date').value;

    let subTotal = currentRenewCalculatedItems.reduce((sum, i) => sum + i.total, 0);
    const totalAfterComp = Math.max(0, subTotal - currentRenewCompDeduction);
    let vatAmount = (currentRenewData.vatAmount && currentRenewData.vatAmount > 0) ? Math.round(totalAfterComp * 0.10) : 0;
    let finalTotal = totalAfterComp + vatAmount;

    const payMethod = el('rn-payment-method').value;
    const status = el('rn-status').value;
    const userNote = el('rn-note').value.trim();

    const origId = currentRenewData.id || `CŨ-${(currentRenewData.docId || '').slice(0, 6).toUpperCase()}`;
    
    // Ghi chú bù sân nếu có
    let compNoteAdd = '';
    const selectedCompItems = currentRenewAvailableCompensations.filter(c => currentRenewSelectedCompIds.has(c.id));
    if (selectedCompItems.length > 0) {
        const compDatesStr = selectedCompItems.map(c => c.missedDate).join(', ');
        compNoteAdd = ` [Đã bù ${selectedCompItems.length} buổi: ${compDatesStr}, trừ ${formatVND(currentRenewCompDeduction)}]`;
    }

    const note = userNote 
        ? `Gia hạn từ phiếu ${origId}. ${userNote}${compNoteAdd}` 
        : `Gia hạn từ phiếu ${origId}${compNoteAdd}`;

    // Cấp mã phiếu mới
    const d = new Date();
    const dateStr = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newInvoiceId = `HBA-${dateStr}-${randNum}`;

    const newTransaction = {
        id: newInvoiceId,
        status: status,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        customerName: currentRenewData.customerName || '',
        customerPhone: currentRenewData.customerPhone || '',
        team: currentRenewData.team || '',
        company: currentRenewData.company || '',
        taxCode: currentRenewData.taxCode || '',
        taxAddress: currentRenewData.taxAddress || '',
        gender: currentRenewData.gender || 'Anh',
        paymentMethod: payMethod,
        note: note,
        subTotal: subTotal,
        discountAmount: currentRenewCompDeduction,
        vatAmount: vatAmount,
        totalAmount: finalTotal,
        paidAmount: status === 'paid' ? finalTotal : 0,
        remainingAmount: status === 'paid' ? 0 : finalTotal,
        startDate: startDateVal,
        endDate: endDateVal,
        items: currentRenewCalculatedItems
    };

    try {
        Swal.fire({ title: 'Đang tạo phiếu gia hạn...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const batch = db.batch();
        const docRef = db.collection('transactions').doc(newInvoiceId);
        batch.set(docRef, newTransaction);

        // ĐÁNH DẤU CÁC BUỔI BÙ ĐÃ HOÀN TẤT
        selectedCompItems.forEach(c => {
            const cRef = db.collection('compensations').doc(c.id);
            batch.update(cRef, {
                status: 'completed',
                compensatedInvoiceId: newInvoiceId,
                compensatedDate: startDateVal,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        // Cập nhật thống kê khách hàng
        if (currentRenewData.customerPhone) {
            const cRef = db.collection('customers').doc(currentRenewData.customerPhone);
            cRef.get().then(snap => {
                if (snap.exists) {
                    cRef.update({
                        totalSpent: firebase.firestore.FieldValue.increment(finalTotal),
                        ticketCount: firebase.firestore.FieldValue.increment(1),
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }).catch(e => console.error(e));
        }

        closeRenewModal();
        fetchReports(); // Cập nhật lại bảng báo cáo
        if (currentViewingPhone && document.getElementById('view-customer-modal') && !document.getElementById('view-customer-modal').classList.contains('hidden')) {
            loadCustomerInvoices(currentViewingPhone);
            fetchCustomerCompensations(currentViewingPhone);
            fetchCustomers();
        }

        const totalSessions = currentRenewCalculatedItems.reduce((sum, i) => sum + i.count, 0);
        let [sy, sm, sd] = startDateVal.split('-');
        let [ey, em, ed] = endDateVal.split('-');

        let compSuccessMsg = selectedCompItems.length > 0 ? `<br><span class="text-amber-700 font-bold">✓ Đã tự động bù trừ ${selectedCompItems.length} buổi (${formatVND(currentRenewCompDeduction)})</span>` : '';

        Swal.fire({
            icon: 'success',
            title: 'Gia hạn thành công!',
            html: `Đã tạo phiếu mới: <b class="text-teal-700 font-mono text-base">${newInvoiceId}</b><br>Kỳ: <b>${sd}/${sm}/${sy} - ${ed}/${em}/${ey}</b> (${totalSessions} buổi)${compSuccessMsg}<br>Tổng tiền: <b class="text-indigo-700 font-bold">${formatVND(finalTotal)}</b>`,
            confirmButtonColor: '#0d9488',
            confirmButtonText: '<i class="fa-solid fa-eye mr-1"></i> Xem Chi Tiết Phiếu',
            showCancelButton: true,
            cancelButtonText: 'Đóng'
        }).then((res) => {
            if (res.isConfirmed) {
                const encoded = encodeURIComponent(JSON.stringify({ ...newTransaction, docId: newInvoiceId }));
                viewReceipt(encoded);
            }
        });

    } catch (e) {
        console.error("Lỗi tạo phiếu gia hạn:", e);
        Swal.fire('Lỗi', 'Không thể tạo phiếu gia hạn. Vui lòng kiểm tra kết nối mạng!', 'error');
    }
}

function transferRenewToBooking() {
    if (!currentRenewData || currentRenewCalculatedItems.length === 0) {
        Swal.fire('Lỗi', 'Không có lịch sân hợp lệ để chuyển sang bảng Tính Tiền!', 'error');
        return;
    }

    const el = (id) => document.getElementById(id);
    const startDateVal = el('rn-start-date').value;
    const endDateVal = el('rn-end-date').value;
    const userNote = el('rn-note').value.trim();
    const origId = currentRenewData.id || `CŨ-${(currentRenewData.docId || '').slice(0, 6).toUpperCase()}`;

    const selectedCompItems = currentRenewAvailableCompensations.filter(c => currentRenewSelectedCompIds.has(c.id));
    let compNoteAdd = '';
    if (selectedCompItems.length > 0) {
        const compDatesStr = selectedCompItems.map(c => c.missedDate).join(', ');
        compNoteAdd = ` [Bù ${selectedCompItems.length} buổi: ${compDatesStr}, giảm trừ ${formatVND(currentRenewCompDeduction)}]`;

        // Tự động đánh dấu hoàn tất trên Firestore
        if (db) {
            selectedCompItems.forEach(c => {
                db.collection('compensations').doc(c.id).update({
                    status: 'completed',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.warn(e));
            });
        }
    }

    const fullNote = userNote ? `Gia hạn từ phiếu ${origId}. ${userNote}${compNoteAdd}` : `Gia hạn từ phiếu ${origId}${compNoteAdd}`;

    const itemsToTransfer = JSON.parse(JSON.stringify(currentRenewCalculatedItems));
    const customerName = currentRenewData.customerName || '';
    const customerPhone = currentRenewData.customerPhone || '';
    const team = currentRenewData.team || '';
    const company = currentRenewData.company || '';
    const taxCode = currentRenewData.taxCode || '';
    const taxAddress = currentRenewData.taxAddress || '';
    const gender = currentRenewData.gender || 'Anh';
    const vatChecked = (currentRenewData.vatAmount && currentRenewData.vatAmount > 0);

    closeRenewModal();

    // Chuyển sang Tab Booking
    switchTab('booking');

    // Cấp mã phiếu mới
    generateNewInvoiceId();

    // Điền thông tin khách
    if (el('cust-name')) el('cust-name').value = customerName;
    if (el('cust-phone')) el('cust-phone').value = customerPhone;
    if (el('cust-team')) el('cust-team').value = team;
    if (el('cust-company')) el('cust-company').value = company;
    if (el('cust-tax-code')) el('cust-tax-code').value = taxCode;
    if (el('cust-tax-address')) el('cust-tax-address').value = taxAddress;
    if (el('cust-gender')) el('cust-gender').value = gender;
    if (el('inv-note')) el('inv-note').value = fullNote;

    if (company || taxCode || taxAddress) {
        const bizFields = document.getElementById('cust-biz-fields');
        const toggleIcon = document.getElementById('cust-biz-toggle-icon');
        if (bizFields) bizFields.classList.remove('hidden');
        if (toggleIcon) toggleIcon.classList.add('rotate-180');
    }

    ['cust-name', 'cust-phone', 'cust-team', 'cust-company', 'cust-tax-code', 'cust-tax-address', 'cust-gender'].forEach(id => {
        if (el(id)) el(id).dispatchEvent(new Event('input'));
    });

    // Điền ngày bắt đầu và kết thúc
    if (el('start-date')) el('start-date').value = startDateVal;
    if (el('end-date')) el('end-date').value = endDateVal;

    // Gán danh sách items
    billItems = itemsToTransfer;

    // Điền giảm giá bù sân nếu có
    if (currentRenewCompDeduction > 0) {
        if (el('discount-type')) el('discount-type').value = 'money';
        if (el('discount-val')) el('discount-val').value = currentRenewCompDeduction;
    }

    // VAT
    if (el('vat-check')) el('vat-check').checked = vatChecked;

    // Render lại giao diện hóa đơn
    renderInvoice();

    Swal.fire({
        icon: 'success',
        title: 'Đã chuyển sang Bảng Tính Tiền!',
        html: `Lịch gia hạn cho khách <b>${customerName}</b> đã được nạp vào hóa đơn.${selectedCompItems.length > 0 ? `<br><b class="text-amber-700">Đã áp dụng giảm trừ bù sân: ${formatVND(currentRenewCompDeduction)}</b>` : ''}`,
        timer: 3500,
        showConfirmButton: true,
        confirmButtonText: 'Đã hiểu'
    });
}

// ==========================================
// DRAGGABLE & MULTI-MODAL STACK MANAGER
// ==========================================

const ALL_MANAGED_MODALS = [
    'customer-modal',
    'view-customer-modal',
    'receipt-modal',
    'edit-bill-modal',
    'renew-modal',
    'comp-modal',
    'vat-export-modal',
    'vat-preview-modal',
    'manual-payment-modal',
    'rule-modal',
    'staff-modal',
    'change-password-modal',
    'reset-password-modal'
];

let globalModalMaxZIndex = 100;

function bringModalToFront(modalEl) {
    if (!modalEl) return;
    globalModalMaxZIndex += 2;
    modalEl.style.zIndex = globalModalMaxZIndex;
    syncModalStack();
}

function syncModalStack() {
    // Lọc các modal đang mở (không có class hidden)
    const openModals = ALL_MANAGED_MODALS
        .map(id => document.getElementById(id))
        .filter(el => el && !el.classList.contains('hidden'));

    if (openModals.length === 0) return;

    // Sắp xếp theo zIndex hiện tại tăng dần
    openModals.sort((a, b) => {
        const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 50;
        const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 50;
        return za - zb;
    });

    // Modal ở dưới cùng đảm nhận nền mờ đen chặn thao tác trang chính
    const bottomModal = openModals[0];
    bottomModal.style.pointerEvents = 'auto';
    bottomModal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';

    // Các modal xếp chồng phía trên: nền trong suốt, không chặn click vào modal bên dưới
    for (let i = 1; i < openModals.length; i++) {
        const modal = openModals[i];
        modal.style.pointerEvents = 'none';
        modal.style.backgroundColor = 'transparent';
        const dialog = modal.querySelector('.bg-white');
        if (dialog) dialog.style.pointerEvents = 'auto';
    }
}

function resetModalPosition(modalEl) {
    if (!modalEl) return;
    const dialog = modalEl.querySelector('.bg-white');
    if (dialog) {
        dialog.style.transform = 'translate(0px, 0px)';
        dialog._dragPos = { x: 0, y: 0 };
    }
}

function makeModalDraggable(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;
    const dialog = modalEl.querySelector('.bg-white');
    if (!dialog) return;

    // Header handle là phần tử con đầu tiên của dialog
    const header = dialog.firstElementChild;
    if (!header) return;

    header.style.cursor = 'move';
    header.style.userSelect = 'none';
    if (!header.getAttribute('title')) {
        header.setAttribute('title', 'Nhấp giữ để di chuyển popup - Nhấp đúp để về giữa màn hình');
    }

    dialog.style.pointerEvents = 'auto';
    dialog._dragPos = { x: 0, y: 0 };

    let isDragging = false;
    let startPointerX = 0, startPointerY = 0;
    let startDialogX = 0, startDialogY = 0;
    let initialRect = null;

    function onPointerDown(e) {
        // Đưa modal lên trên cùng khi nhấp
        bringModalToFront(modalEl);

        // Bỏ qua nếu nhấp vào các nút, input, textarea, link, nút đóng
        if (e.target.closest('button, input, select, textarea, a, .cursor-pointer')) {
            return;
        }

        // Chỉ nhận chuột trái hoặc cảm ứng đơn
        if (e.button !== undefined && e.button !== 0) return;

        isDragging = true;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        startDialogX = dialog._dragPos.x || 0;
        startDialogY = dialog._dragPos.y || 0;
        initialRect = dialog.getBoundingClientRect();

        header.style.cursor = 'grabbing';
        dialog.style.transition = 'none';

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!isDragging || !initialRect) return;
        const dx = e.clientX - startPointerX;
        const dy = e.clientY - startPointerY;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let targetX = startDialogX + dx;
        let targetY = startDialogY + dy;

        // Giới hạn biên an toàn: không kéo tiêu đề ra ngoài màn hình
        const predLeft = initialRect.left + dx;
        const predRight = initialRect.right + dx;
        const predTop = initialRect.top + dy;

        if (predRight < 100) targetX = startDialogX + (100 - initialRect.right);
        if (predLeft > winW - 100) targetX = startDialogX + (winW - 100 - initialRect.left);
        if (predTop < 5) targetY = startDialogY + (5 - initialRect.top);
        if (predTop > winH - 60) targetY = startDialogY + (winH - 60 - initialRect.top);

        dialog._dragPos.x = targetX;
        dialog._dragPos.y = targetY;
        dialog.style.transform = `translate(${targetX}px, ${targetY}px)`;
    }

    function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        header.style.cursor = 'move';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
    }

    header.addEventListener('pointerdown', onPointerDown);

    // Nhấp đúp chuột lên header để đưa modal về lại chính giữa
    header.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, input, select, textarea, a, .cursor-pointer')) return;
        dialog.style.transition = 'transform 0.25s ease-out';
        dialog.style.transform = 'translate(0px, 0px)';
        dialog._dragPos = { x: 0, y: 0 };
    });

    // Khi nhấp vào bất kỳ đâu trong dialog, nâng modal lên mặt trước
    dialog.addEventListener('pointerdown', () => {
        bringModalToFront(modalEl);
    });
}

function initModalManager() {
    ALL_MANAGED_MODALS.forEach(id => {
        makeModalDraggable(id);

        const modalEl = document.getElementById(id);
        if (!modalEl) return;

        // Theo dõi thay đổi class để tự động đồng bộ hóa lớp phủ và z-index
        let wasHidden = modalEl.classList.contains('hidden');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                if (m.attributeName === 'class') {
                    const isHidden = modalEl.classList.contains('hidden');
                    if (wasHidden && !isHidden) {
                        // Vừa mới mở modal
                        resetModalPosition(modalEl);
                        bringModalToFront(modalEl);
                    } else if (!wasHidden && isHidden) {
                        // Vừa mới đóng modal
                        syncModalStack();
                    }
                    wasHidden = isHidden;
                }
            });
        });
        observer.observe(modalEl, { attributes: true, attributeFilter: ['class'] });
    });
}



