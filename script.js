// ==========================================
// 1. DATA INITIALIZATION & CONFIG
// ==========================================

const BANK_INFO = {
    PERSONAL: {
        name: 'MB NGÂN HÀNG QUÂN ĐỘI',
        accName: 'NGUYEN THI THU TRANG',
        accNum: 'VQRQ0002k28ju',
        qrString: 'MB-VQRQ0002k28ju' 
    },
    COMPANY: {
        name: 'NGÂN HÀNG ACB',
        accName: 'CÔNG TY TNHH DÁNG TIÊN',
        accNum: '80808668',
        qrString: 'ACB-80808668'
    }
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
    // Cập nhật Tết Âm Lịch 2026 (Ví dụ)
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

// Hàm mới: Tính thứ từ chuỗi ngày "dd/mm/yyyy"
function getDayOfWeekString(dateStr) {
    const [d, m, y] = dateStr.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[date.getDay()];
}

function findBestPrice(group, dayOfWeek, checkTime) {
    const candidates = pricingRules.filter(r => r.group === group && r.days.includes(dayOfWeek));
    const match = candidates.find(r => checkTime >= r.start && checkTime < r.end);
    return match ? match.price : 0;
}

// ==========================================
// 3. MAIN LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    renderWeekdays('weekday-container', []);

    // INIT FLATPICKR
    excludeDatePicker = flatpickr("#exclude-dates", {
        mode: "multiple",
        dateFormat: "d/m/Y",
        locale: "vn"
    });

    const today = new Date();
    document.getElementById('inv-date').textContent = formatDateFull(today);
    document.getElementById('inv-id').textContent = Math.floor(Math.random()*8999 + 1000);
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
        const courtSelect = document.getElementById('court-select');
        courtSelect.innerHTML = '<option value="">-- Chọn sân --</option>';
        const group = this.value;
        if(group && COURT_MAP[group]) {
            COURT_MAP[group].forEach(court => {
                const opt = document.createElement('option');
                opt.value = court;
                opt.textContent = court;
                courtSelect.appendChild(opt);
            });
        }
        updateEstimatedPrice();
    });

    document.getElementById('time-start').addEventListener('change', () => { updateDuration(); updateEstimatedPrice(); });
    document.getElementById('time-end').addEventListener('change', () => { updateDuration(); updateEstimatedPrice(); });

    document.getElementById('add-to-bill-btn').addEventListener('click', addToBill);
    document.getElementById('discount-val').addEventListener('input', renderInvoice);
    document.getElementById('discount-type').addEventListener('change', renderInvoice);
    document.getElementById('vat-check').addEventListener('change', renderInvoice);
    
    renderInvoice(); 

    document.getElementById('print-btn').addEventListener('click', () => {
        const note = document.getElementById('inv-note').value;
        document.getElementById('print-note').textContent = note;
        const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
        document.getElementById('print-pay-method').textContent = payMethod;
        window.print();
    });
});

// --- UPDATED POPUP LOGIC ---
function fillHolidays() {
    let htmlContent = '<div class="text-left space-y-2 max-h-60 overflow-y-auto p-2 border rounded bg-gray-50">';
    
    HOLIDAYS_DATA.forEach((h) => {
        // Tự động tính thứ
        const dayOfWeek = getDayOfWeekString(h.date); 
        
        // Style màu sắc cho thứ: T7, CN màu đỏ, ngày thường màu xanh
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
