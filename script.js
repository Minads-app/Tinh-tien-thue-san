// ==========================================
// 1. DATA INITIALIZATION & CONFIG
// ==========================================

// BANK_INFO is now dynamic, loaded from Firebase settings
let unsubscribeReports = null;
let knownTransactions = {};

let siteSettings = {
    venueName: '',
    venueSub: '',
    venueAddress: '',
    bankPersonal: { name: '', accName: '', accNum: '', qrString: '' },
    bankCompany: { name: '', accName: '', accNum: '', qrString: '' }
};

const COURT_MAP = {
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

    // Tải danh sách ngân hàng trước
    fetchBankList();

    // Tải dữ liệu từ Firebase
    fetchPricingRules();
    fetchReports();
    fetchSettings();
    fetchCustomers();
    setupAutocomplete();

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

    const today = new Date();
    document.getElementById('inv-date').textContent = formatDateFull(today);
    generateNewInvoiceId();
    document.getElementById('start-date').valueAsDate = today;
    document.getElementById('end-date').valueAsDate = today;

    // Listeners
    ['cust-name', 'cust-phone', 'cust-company', 'cust-gender'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            document.getElementById('display-name').textContent = document.getElementById('cust-name').value || '---';
            document.getElementById('display-phone').textContent = document.getElementById('cust-phone').value || '---';
            document.getElementById('display-company').textContent = document.getElementById('cust-company').value;
            const gender = document.getElementById('cust-gender').value;
            document.getElementById('display-gender').textContent = gender ? `(${gender})` : '';
        });
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

        const customerName = document.getElementById('cust-name').value || 'Khách Vãng Lai';
        const customerPhone = document.getElementById('cust-phone').value || '';
        
        const finalTotalStr = document.getElementById('final-total').textContent.replace(/[^0-9]/g, '');
        const finalTotalNum = parseInt(finalTotalStr) || 0;

        const subTotalStr = document.getElementById('sub-total').textContent.replace(/[^0-9]/g, '');
        const subTotalNum = parseInt(subTotalStr) || 0;

        const vatAmountStr = document.getElementById('vat-amount').textContent.replace(/[^0-9]/g, '');
        const vatAmountNum = document.getElementById('vat-check').checked ? (parseInt(vatAmountStr) || 0) : 0;

        const startDateVal = document.getElementById('start-date').value || '';
        const endDateVal = document.getElementById('end-date').value || '';
        
        // Dùng mã phiếu hiện tại đã cấp
        const invoiceId = currentInvoiceId;

        // Cập nhật tự động thông tin Khách hàng vào kho dữ liệu mới
        if (customerPhone && db) {
            const cRef = db.collection('customers').doc(customerPhone);
            cRef.get().then(docSnap => {
                const gender = document.getElementById('cust-gender') ? document.getElementById('cust-gender').value : 'Anh';
                const comp = document.getElementById('cust-company') ? document.getElementById('cust-company').value : '';
                if (docSnap.exists) {
                    cRef.update({
                        name: customerName,
                        gender: gender,
                        company: comp,
                        totalSpent: firebase.firestore.FieldValue.increment(finalTotalNum),
                        ticketCount: firebase.firestore.FieldValue.increment(1),
                        lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    const code = 'KH' + Math.floor(1000 + Math.random() * 9000);
                    cRef.set({
                        customerCode: code,
                        name: customerName,
                        gender: gender,
                        company: comp,
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
            paymentMethod: payMethod,
            note: note,
            subTotal: subTotalNum,
            vatAmount: vatAmountNum,
            totalAmount: finalTotalNum,
            startDate: startDateVal,
            endDate: endDateVal,
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
                
                // Chờ Swal đóng hoàn toàn trước khi in
                setTimeout(() => { 
                    window.print(); 
                    
                    // Xóa giao diện Edit Mode (nếu đang bật)
                    if (document.getElementById('cancel-edit-btn')) {
                        document.getElementById('inv-id').parentElement.classList.remove('text-orange-600', 'bg-orange-100', 'p-1', 'rounded');
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
                    // Cấp mã phiếu mới sau khi in xong
                    generateNewInvoiceId();
                    renderInvoice(); // Cập nhật lại ảnh QR và xoá Items hiện tại
                }, 300);
            } catch (error) {
                console.error("Lỗi khi lưu Firebase:", error);
                Swal.fire('Cảnh báo Mạng', 'Lưu dữ liệu thất bại, phiếu này có thể bị mất sau khi in!', 'warning').then(() => {
                    window.print();
                });
            }
        } else {
            window.print();
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

function addToBill() {
    const group = document.getElementById('sport-select').value;
    const selectedCourts = Array.from(document.querySelectorAll('input[name="court-checkbox"]:checked')).map(cb => cb.value);
    
    if(!group || selectedCourts.length === 0) { Swal.fire('Lỗi', 'Vui lòng chọn Môn và ít nhất 1 Sân', 'error'); return; }

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    
    const excludeDates = excludeDatePicker.selectedDates.map(d => d.toDateString());

    const duration = calculateHours(startTime, endTime);
    if(duration <= 0) { Swal.fire('Lỗi', 'Giờ kết thúc phải lớn hơn bắt đầu', 'error'); return; }

    const selectedDays = [];
    document.querySelectorAll('input[name="weekday"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
    if(selectedDays.length === 0) { Swal.fire('Lỗi', 'Chọn thứ trong tuần', 'error'); return; }

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
                skipped: skippedDates,
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
    Swal.fire({ icon: 'success', title: 'Đã thêm', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
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
            let skippedText = item.skipped && item.skipped.length > 0 ? `<br><span class="text-xs text-red-500 italic font-medium">Trừ ngày: ${item.skipped.join(', ')}</span>` : '';
            
            const daysText = item.weekdays.map(d => getDayName(d)).join(', ');
            const weekdayDisplay = `<div class="text-xs text-indigo-600 font-semibold mt-0.5">Thứ: ${daysText}</div>`;

            const displayPrice = Math.round(item.price);

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-100";
            tr.innerHTML = `
                <td class="p-3">
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500">
                        ${item.desc}
                        ${weekdayDisplay}
                        ${skippedText}
                    </div>
                </td>
                <td class="p-3 text-center font-medium">${item.count} buổi</td>
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
    
    if(isVatChecked) {
        vatAmount = preTaxTotal * 0.10;
        document.getElementById('vat-amount').style.display = 'block';
        document.getElementById('vat-label-print').style.display = 'block';
    } else {
        document.getElementById('vat-amount').style.display = 'none';
        document.getElementById('vat-label-print').style.display = 'none';
    }

    const finalTotal = preTaxTotal + vatAmount;

    document.getElementById('sub-total').textContent = formatVND(subTotal);
    document.getElementById('print-discount').textContent = formatVND(discount);
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

function switchTab(tabName) {
    document.querySelectorAll('[id^="tab-booking"], [id^="tab-config"], [id^="tab-reports"], [id^="tab-settings"], [id^="tab-customers"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    const btnBooking = document.getElementById('tab-btn-booking');
    const btnConfig = document.getElementById('tab-btn-config');
    const btnReports = document.getElementById('tab-btn-reports');
    const btnSettings = document.getElementById('tab-btn-settings');
    
    const activeClass = "tab-active py-4 px-1 inline-flex items-center text-sm border-b-2 border-indigo-600 font-bold text-indigo-700 cursor-pointer";
    const inactiveClass = "tab-inactive py-4 px-1 inline-flex items-center text-sm border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-800 transition cursor-pointer";

    [btnBooking, btnConfig, btnReports, btnSettings].forEach(btn => { if(btn) btn.className = inactiveClass; });

    if(tabName === 'booking') {
        if(btnBooking) btnBooking.className = activeClass;
    } else if(tabName === 'config') {
        if(btnConfig) btnConfig.className = activeClass;
        renderConfigTable();
    } else if(tabName === 'reports') {
        if(btnReports) btnReports.className = activeClass;
        fetchReports();
    } else if(tabName === 'settings') {
        if(btnSettings) btnSettings.className = activeClass;
        populateSettingsForm();
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

                // Lọc theo trạng thái. (Cũ chưa có trường status thì ngầm định là 'paid' nếu tùy ý, ở đây set mặc định là 'paid' nếu null)
                const status = data.status || 'paid';
                if (filterStatus !== 'all' && filterStatus !== status) return;

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
    const invId = data.id || `CŨ-${data.docId.slice(0,6).toUpperCase()}`;
    const status = data.status || 'paid';
    
    document.getElementById('rm-id').textContent = invId;
    
    // Xây dựng nội dung chi tiết
    const itemsHtml = (data.items || []).map(i => {
        const daysText = (i.weekdays || []).map(d => d === 0 ? 'CN' : 'T'+(d+1)).join(', ');
        return `<div class="border-b py-2 flex justify-between text-sm">
            <div>
                <p class="font-bold text-gray-800">${i.name}</p>
                <p class="text-xs text-gray-500">Thứ: ${daysText} | ${i.desc || ''}</p>
                ${i.skipped && i.skipped.length > 0 ? `<p class="text-[10px] text-red-500 mt-1">Nghỉ bù: ${i.skipped.join(', ')}</p>` : ''}
            </div>
            <div class="text-right">
                <p class="text-gray-600">${i.count} buổi x ${formatVND(i.price)}</p>
                <p class="font-bold text-indigo-700">${formatVND(i.total)}</p>
            </div>
        </div>`;
    }).join('');

    const html = `
        <div class="grid grid-cols-2 gap-4 mb-4 text-sm bg-gray-50 p-3 rounded">
            <div><span class="text-gray-500 font-medium">Khách hàng:</span> <br><b>${data.customerName || 'Vãng lai'}</b></div>
            <div><span class="text-gray-500 font-medium">SĐT:</span> <br><b>${data.customerPhone || '---'}</b></div>
            <div><span class="text-gray-500 font-medium">Chi nhánh:</span> <br><b>${data.note || '---'}</b></div>
            <div><span class="text-gray-500 font-medium">Thanh toán:</span> <br><b>${data.paymentMethod || '---'}</b></div>
        </div>
        <div class="mb-4">
            <h3 class="font-bold text-gray-700 mb-2 border-b pb-1">DỊCH VỤ ĐÃ ĐẶT</h3>
            ${itemsHtml}
        </div>
        <div class="bg-indigo-50 p-3 rounded text-right space-y-1">
            <p class="text-sm text-gray-600">Tiền hàng: ${formatVND(data.subTotal || 0)}</p>
            <p class="text-sm text-gray-600">Thuế VAT: ${formatVND(data.vatAmount || 0)}</p>
            <p class="font-bold text-lg text-indigo-700 mt-2 pt-2 border-t border-indigo-100">Tổng V/A: ${formatVND(data.totalAmount || 0)}</p>
            <p class="text-sm font-bold text-green-700">Đã thanh toán: ${formatVND(data.paidAmount !== undefined ? data.paidAmount : (status==='paid' ? data.totalAmount : 0))}</p>
            <p class="text-sm font-bold ${data.remainingAmount > 0 ? "text-red-600" : (data.remainingAmount < 0 ? "text-purple-600" : "text-gray-600")}">Còn nợ: ${formatVND(data.remainingAmount !== undefined ? data.remainingAmount : (status==='paid' ? 0 : (data.totalAmount||0)))}</p>
        </div>
    `;

    document.getElementById('rm-content').innerHTML = html;

    const historyTableBody = document.getElementById('payment-history-table');
    const historyEmpty = document.getElementById('payment-history-empty');
    if (historyTableBody && historyEmpty && db) {
        historyTableBody.innerHTML = '';
        historyEmpty.classList.remove('hidden');
        historyEmpty.textContent = 'Đang tải lịch sử thanh toán...';

        db.collection('transactions').doc(data.docId).collection('payments').orderBy('paidAt', 'desc').get().then(snap => {
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
                    const tr = document.createElement('tr');
                    tr.className = "border-b text-gray-700 hover:bg-gray-50";
                    tr.innerHTML = `
                        <td class="p-2 border text-[11px] font-medium">${dateStr}</td>
                        <td class="p-2 border font-bold text-green-700 text-xs text-right">${formatVND(payData.amount)}</td>
                        <td class="p-2 border font-mono text-[10px] text-gray-500">${payData.sepayTransactionId || '---'}</td>
                    `;
                    historyTableBody.appendChild(tr);
                });
            }
        }).catch(err => {
            console.error("Lỗi lấy lịch sử thanh toán:", err);
            historyEmpty.textContent = 'Lỗi kết nối khi tải lịch sử thanh toán.';
        });
    }

    const statusBtn = document.getElementById('rm-status-btn');
    if (status === 'unpaid' || status === 'partial') {
        statusBtn.style.display = 'block';
        statusBtn.innerHTML = status === 'partial' 
            ? `<i class="fa-solid fa-check-double mr-1"></i> Thu phần nợ còn lại (Tiền mặt)`
            : `<i class="fa-solid fa-check mr-1"></i> Xác Nhận Đã Thanh Toán (Tiền mặt)`;
        statusBtn.onclick = () => confirmPayment(data.docId);
    } else {
        statusBtn.style.display = 'none';
    }

    // Gán sự kiện cho nút Sửa và Xóa trong modal xem chi tiết
    const editBtn = document.getElementById('rm-edit-btn');
    const editFullBtn = document.getElementById('rm-edit-full-btn');
    const deleteBtn = document.getElementById('rm-delete-btn');
    
    editBtn.onclick = () => { closeReceiptModal(); editBill(dataStrEncoded); };
    if (editFullBtn) editFullBtn.onclick = () => { editFullBill(data.docId, dataStrEncoded); };
    deleteBtn.onclick = () => { closeReceiptModal(); deleteBill(data.docId, invId); };

    // Gán sự kiện cho nút In
    const printBtn = document.getElementById('rm-print-btn');
    if (printBtn) {
        printBtn.onclick = () => { printReceipt(data); };
    }

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
    document.getElementById('display-company').textContent = data.company || '';
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
    document.getElementById('discount-val').value = '';
    
    // Set VAT
    const vatAmount = data.vatAmount || 0;
    document.getElementById('vat-check').checked = (vatAmount > 0);
    
    // Render invoice (sẽ tính sub-total từ items)
    renderInvoice();
    
    // Override lại tổng tiền từ dữ liệu gốc để chính xác
    document.getElementById('sub-total').textContent = formatVND(data.subTotal || 0);
    document.getElementById('vat-amount').textContent = formatVND(vatAmount);
    document.getElementById('final-total').textContent = formatVND(data.totalAmount || 0);
    
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
            document.getElementById('inv-id').parentElement.classList.add('text-orange-600', 'bg-orange-100', 'p-1', 'rounded');
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            document.getElementById('print-btn-text').textContent = 'Lưu Phiếu (Ghi đè)';
            document.getElementById('print-btn').classList.replace('bg-blue-600', 'bg-orange-600');
            document.getElementById('print-btn').classList.replace('hover:bg-blue-700', 'hover:bg-orange-700');

            // Điền Khách hàng
            if(document.getElementById('cust-name')) document.getElementById('cust-name').value = data.customerName || '';
            if(document.getElementById('cust-phone')) document.getElementById('cust-phone').value = data.customerPhone || '';
            if(document.getElementById('cust-company')) document.getElementById('cust-company').value = data.company || '';
            
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
            
            // Calculate discount backward:
            // subTotal = data.subTotal
            // totalAmount = data.totalAmount
            // vatAmount = data.vatAmount
            // PreTax = totalAmount - vatAmount
            // discount = subTotal - PreTax
            if(data.subTotal) {
                const discount = data.subTotal - (data.totalAmount - (data.vatAmount || 0));
                if (discount > 0) {
                    document.getElementById('discount-type').value = 'money';
                    document.getElementById('discount-val').value = discount;
                } else {
                    document.getElementById('discount-type').value = 'money';
                    document.getElementById('discount-val').value = '';
                }
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
    document.getElementById('inv-id').parentElement.classList.remove('text-orange-600', 'bg-orange-100', 'p-1', 'rounded');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('print-btn-text').textContent = 'Lưu & Xuất Phiếu';
    document.getElementById('print-btn').classList.replace('bg-orange-600', 'bg-blue-600');
    document.getElementById('print-btn').classList.replace('hover:bg-orange-700', 'hover:bg-blue-700');
    
    // Clear data
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-company').value = '';
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
            customersList.push({ phoneId: doc.id, ...data });
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
        filtered = customersList.filter(c => 
            (c.name || '').toLowerCase().includes(searchVal) || 
            (c.phoneId || '').includes(searchVal)
        );
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

            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-blue-50 transition text-sm text-gray-700";
            tr.innerHTML = `
                <td class="p-3 border-r font-mono text-xs font-bold text-gray-500">${c.customerCode || '---'}</td>
                <td class="p-3 border-r font-bold text-blue-700">${c.name || '---'}</td>
                <td class="p-3 border-r font-mono font-bold">${c.phoneId || '---'}</td>
                <td class="p-3 border-r text-gray-600">${c.gender || '---'}</td>
                <td class="p-3 border-r text-gray-600">${c.company || '---'}</td>
                <td class="p-3 border-r text-center font-bold text-gray-800">${c.ticketCount || 0}</td>
                <td class="p-3 border-r text-right font-bold text-green-700 text-base">${formatVND(c.totalSpent || 0)}</td>
                <td class="p-3 text-gray-500 whitespace-nowrap"><i class="fa-regular fa-calendar mr-1"></i> ${lastVisitStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

if(document.getElementById('customer-search')) {
    document.getElementById('customer-search').addEventListener('input', renderCustomerTable);
}

function openAddCustomerModal() {
    document.getElementById('c-phone').value = '';
    document.getElementById('c-name').value = '';
    document.getElementById('c-company').value = '';
    document.getElementById('c-gender').value = 'Anh';
    document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomerModal() {
    const phone = document.getElementById('c-phone').value.trim();
    const name = document.getElementById('c-name').value.trim();
    const gender = document.getElementById('c-gender').value;
    const company = document.getElementById('c-company').value.trim();

    if(!phone || !name) {
        Swal.fire('Lỗi', 'Vui lòng nhập đủ SĐT và Họ Tên!', 'error');
        return;
    }

    if (!db) return;

    try {
        Swal.fire({ title: 'Đang lưu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
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
            company: company,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastVisit: firebase.firestore.FieldValue.serverTimestamp(),
            totalSpent: 0,
            ticketCount: 0
        });

        closeCustomerModal();
        Swal.fire({ icon: 'success', title: 'Thành công', text: 'Đã thêm khách hàng mới!', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error("Lỗi lưu khách hàng:", e);
        Swal.fire('Lỗi', 'Không thể lưu. Vui lòng kiểm tra mạng!', 'error');
    }
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
                document.getElementById('cust-company').value = m.company || '';
                if(m.gender) document.getElementById('cust-gender').value = m.gender;
                
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


