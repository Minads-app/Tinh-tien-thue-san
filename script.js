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

// Dữ liệu ngày lễ mẫu (Bạn có thể sửa đổi năm tại đây)
const CURRENT_YEAR = new Date().getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;
const HOLIDAYS_DATA = [
    { date: `01/01/${CURRENT_YEAR}`, name: `Tết Dương Lịch ${CURRENT_YEAR}` },
    { date: `30/04/${CURRENT_YEAR}`, name: `Giải phóng Miền Nam` },
    { date: `01/05/${CURRENT_YEAR}`, name: `Quốc tế Lao động` },
    { date: `02/09/${CURRENT_YEAR}`, name: `Quốc khánh Việt Nam` },
    // Ví dụ Tết Âm Lịch 2026 (Cần cập nhật theo lịch vạn niên thực tế từng năm)
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

// --- NEW FUNCTION: POPUP CHỌN LỄ TẾT ---
function fillHolidays() {
    // 1. Tạo HTML cho danh sách checkbox
    let htmlContent = '<div class="text-left space-y-2 max-h-60 overflow-y-auto p-2 border rounded bg-gray-50">';
    HOLIDAYS_DATA.forEach((h) => {
        htmlContent += `
            <label class="flex items-center space-x-3 p-2 bg-white border border-gray-200 rounded cursor-pointer hover:bg-indigo-50 transition">
                <input type="checkbox" value="${h.date}" class="holiday-checkbox w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-gray-800">${h.date}</span>
                    <span class="text-xs text-indigo-600 font-medium">${h.name}</span>
                </div>
            </label>
        `;
    });
    htmlContent += '</div>';

    // 2. Hiển thị Popup
    Swal.fire({
        title: 'Gợi ý Ngày Lễ & Tết',
        html: htmlContent,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check mr-1"></i> Thêm ngày đã chọn',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#4f46e5', // Indigo 600
        focusConfirm: false,
        preConfirm: () => {
            // Lấy danh sách user đã tick
            const checkboxes = document.querySelectorAll('.holiday-checkbox:checked');
            const selectedDates = Array.from(checkboxes).map(cb => cb.value);
            return selectedDates;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (result.value.length > 0) {
                // Merge với ngày đã có trong input (tránh mất ngày user đã nhập tay)
                const currentDates = excludeDatePicker.selectedDates.map(d => flatpickr.formatDate(d, "d/m/Y"));
                const newDates = [...new Set([...currentDates, ...result.value])]; // Unique
                
                excludeDatePicker.setDate(newDates);
                Swal.fire({
                    icon: 'success',
                    title: 'Đã cập nhật',
                    text: `Đã thêm ${result.value.length} ngày lễ vào danh sách nghỉ.`,
                    timer: 1500,
                    showConfirmButton: false
                });
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
    if(!group || !startTime) {
        document.getElementById('estimated-price').textContent = "---";
        return;
    }
    const todayDay = new Date().getDay();
    const price = findBestPrice(group, todayDay, startTime);
    document.getElementById('estimated-price').textContent = price > 0 ? formatVND(price) + "/h (Hôm nay)" : "Chưa có giá";
}

function addToBill() {
    const group = document.getElementById('sport-select').value;
    const courtName = document.getElementById('court-select').value;
    if(!group || !courtName) { Swal.fire('Lỗi', 'Vui lòng chọn Môn và Sân', 'error'); return; }

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    
    // Lấy ngày từ Flatpickr (đã là mảng Date objects)
    const excludeDates = excludeDatePicker.selectedDates.map(d => d.toDateString());

    const duration = calculateHours(startTime, endTime);
    if(duration <= 0) { Swal.fire('Lỗi', 'Giờ kết thúc phải lớn hơn bắt đầu', 'error'); return; }

    const selectedDays = [];
    document.querySelectorAll('input[name="weekday"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
    if(selectedDays.length === 0) { Swal.fire('Lỗi', 'Chọn thứ trong tuần', 'error'); return; }

    let count = 0;
    let totalPriceItem = 0;
    let skippedDates = [];
    let current = new Date(startDate);
    
    while(current <= endDate) {
        const currentDayOfWeek = current.getDay();
        if(selectedDays.includes(currentDayOfWeek)) {
            if(excludeDates.includes(current.toDateString())) {
                skippedDates.push(formatDate(current));
            } else {
                const priceToday = findBestPrice(group, currentDayOfWeek, startTime);
                if(priceToday > 0) {
                    count++;
                    totalPriceItem += (priceToday * duration);
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }

    if(count === 0 && skippedDates.length === 0) { Swal.fire('Thông báo', 'Không có ngày phù hợp', 'warning'); return; }
    if(totalPriceItem === 0 && count > 0) { Swal.fire('Cảnh báo', 'Không tìm thấy cấu hình giá cho khung giờ này!', 'warning'); return; }

    const itemName = `${group} [${courtName}]`;
    const avgPrice = totalPriceItem / (count * duration);

    billItems.push({
        id: Date.now(),
        name: itemName,
        weekdays: selectedDays, // Lưu lại thứ đã chọn
        desc: `${formatDate(startDate)} - ${formatDate(endDate)} (${startTime}-${endTime})`,
        skipped: skippedDates,
        count: count,
        duration: duration,
        price: avgPrice,
        total: totalPriceItem
    });

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
            
            // Format weekdays: "Thứ: T2, T4, CN"
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
                <td class="p-3 text-right text-gray-600">~${formatVND(displayPrice)}</td>
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

    let selectedBank;
    if(isVatChecked && finalTotal >= 5000000) {
        selectedBank = BANK_INFO.COMPANY;
        qrSection.classList.remove('bg-indigo-50', 'border-indigo-200');
        qrSection.classList.add('bg-blue-50', 'border-blue-300');
    } else {
        selectedBank = BANK_INFO.PERSONAL;
        qrSection.classList.add('bg-indigo-50', 'border-indigo-200');
        qrSection.classList.remove('bg-blue-50', 'border-blue-300');
    }

    bankNameEl.textContent = selectedBank.name;
    accNameEl.textContent = selectedBank.accName;
    accNumEl.textContent = selectedBank.accNum;
    qrImageEl.src = `https://img.vietqr.io/image/${selectedBank.qrString}-compact.png`;
}

function removeItem(id) {
    billItems = billItems.filter(i => i.id !== id);
    renderInvoice();
}

function switchTab(tabName) {
    document.querySelectorAll('[id^="tab-booking"], [id^="tab-config"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    const btnBooking = document.getElementById('tab-btn-booking');
    const btnConfig = document.getElementById('tab-btn-config');
    
    if(tabName === 'booking') {
        btnBooking.className = "tab-active py-4 px-1 inline-flex items-center text-sm border-b-2 font-medium cursor-pointer";
        btnConfig.className = "tab-inactive py-4 px-1 inline-flex items-center text-sm border-b-2 border-transparent font-medium cursor-pointer";
    } else {
        btnConfig.className = "tab-active py-4 px-1 inline-flex items-center text-sm border-b-2 font-medium cursor-pointer";
        btnBooking.className = "tab-inactive py-4 px-1 inline-flex items-center text-sm border-b-2 border-transparent font-medium cursor-pointer";
        renderConfigTable();
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
    localStorage.setItem('pricingRules', JSON.stringify(pricingRules));
    renderConfigTable();
    closeModal();
}
function deleteRule(id) {
    if(confirm("Xóa quy tắc này?")) {
        pricingRules = pricingRules.filter(r => r.id !== id);
        localStorage.setItem('pricingRules', JSON.stringify(pricingRules));
        renderConfigTable();
    }
}
