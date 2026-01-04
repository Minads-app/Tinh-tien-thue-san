// ==========================================
// 1. DATA INITIALIZATION (Cấu hình gốc)
// ==========================================

const COURT_MAP = {
    'Bóng đá': ['Sân bóng đá'],
    'Cầu lông': ['Sân cầu lông 1', 'Sân cầu lông 2', 'Sân cầu lông 3', 'Sân cầu lông 4'],
    'Bóng rổ Full': ['Bóng rổ 1', 'Bóng rổ 2'],
    'Bóng rổ 1/2': ['BR 1A', 'BR 1B', 'BR 2A', 'BR 2B', 'Bóng rổ 3'],
    'Khác': ['Sân mặc định']
};

const DEFAULT_RULES = [
    { id: 1, group: 'Cầu lông', name: 'Sân Cầu lông (Sáng/Chiều T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '17:30', price: 220000 },
    { id: 2, group: 'Cầu lông', name: 'Sân Cầu lông (Tối T2-T6)', days: [1,2,3,4,5], start: '17:30', end: '22:00', price: 220000 },
    { id: 3, group: 'Cầu lông', name: 'Sân Cầu lông (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 220000 },
    { id: 4, group: 'Bóng rổ 1/2', name: 'Bóng rổ 1 rổ (T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 240000 },
    { id: 5, group: 'Bóng rổ 1/2', name: 'Bóng rổ 1 rổ (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 270000 },
    { id: 6, group: 'Bóng rổ Full', name: 'Bóng rổ Full (T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 450000 },
    { id: 7, group: 'Bóng rổ Full', name: 'Bóng rổ Full (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 500000 },
    { id: 8, group: 'Bóng đá', name: 'Sân Bóng đá (Sáng)', days: [0,1,2,3,4,5,6], start: '06:00', end: '17:00', price: 450000 },
    { id: 9, group: 'Bóng đá', name: 'Sân Bóng đá (Tối)', days: [0,1,2,3,4,5,6], start: '17:00', end: '22:00', price: 550000 },
];

let pricingRules = JSON.parse(localStorage.getItem('pricingRules')) || DEFAULT_RULES;
let billItems = [];
let currentEditingRuleId = null;

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

function formatDate(d) {
    return `${d.getDate()}/${d.getMonth()+1}`;
}
function formatDateFull(d) {
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

// ==========================================
// 3. MAIN LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    populateFieldSelect();
    renderWeekdays('weekday-container', []);

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

    document.getElementById('field-select').addEventListener('change', function() {
        const subSelect = document.getElementById('sub-field-select');
        subSelect.innerHTML = ''; 
        const option = this.options[this.selectedIndex];

        if(option.value) {
            const price = parseInt(option.dataset.price);
            document.getElementById('unit-price').value = price;
            document.getElementById('unit-price-display').value = formatVND(price);
            document.getElementById('time-start').value = option.dataset.start;
            document.getElementById('time-end').value = option.dataset.end;
            
            const days = JSON.parse(option.dataset.days);
            renderWeekdays('weekday-container', days);
            updateDuration();

            const ruleId = parseInt(this.value);
            const rule = pricingRules.find(r => r.id === ruleId);
            
            if (rule && COURT_MAP[rule.group]) {
                COURT_MAP[rule.group].forEach(courtName => {
                    const opt = document.createElement('option');
                    opt.value = courtName;
                    opt.textContent = courtName;
                    subSelect.appendChild(opt);
                });
            } else {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "Không có tùy chọn sân";
                subSelect.appendChild(opt);
            }
        } else {
             subSelect.innerHTML = '<option value="">-- Vui lòng chọn dịch vụ trước --</option>';
        }
    });

    document.getElementById('time-start').addEventListener('change', updateDuration);
    document.getElementById('time-end').addEventListener('change', updateDuration);

    document.getElementById('add-to-bill-btn').addEventListener('click', addToBill);
    document.getElementById('discount-val').addEventListener('input', renderInvoice);
    document.getElementById('discount-type').addEventListener('change', renderInvoice);
    
    document.getElementById('print-btn').addEventListener('click', () => {
        const note = document.getElementById('inv-note').value;
        document.getElementById('print-note').textContent = note;
        const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
        document.getElementById('print-pay-method').textContent = payMethod;
        window.print();
    });
});

function updateDuration() {
    const s = document.getElementById('time-start').value;
    const e = document.getElementById('time-end').value;
    const hours = calculateHours(s, e);
    document.getElementById('calculated-duration').textContent = hours + " giờ";
}

function addToBill() {
    const select = document.getElementById('field-select');
    if(!select.value) { Swal.fire('Lỗi', 'Vui lòng chọn loại sân/dịch vụ', 'error'); return; }

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    const unitPrice = parseFloat(document.getElementById('unit-price').value) || 0;
    const excludeText = document.getElementById('exclude-dates').value;
    
    const startTime = document.getElementById('time-start').value;
    const endTime = document.getElementById('time-end').value;
    const duration = calculateHours(startTime, endTime);
    
    if(duration <= 0) { Swal.fire('Lỗi', 'Giờ kết thúc phải lớn hơn giờ bắt đầu', 'error'); return; }
    if(isNaN(startDate) || isNaN(endDate) || endDate < startDate) { Swal.fire('Lỗi', 'Ngày không hợp lệ', 'error'); return; }

    const selectedDays = [];
    document.querySelectorAll('input[name="weekday"]:checked').forEach(cb => selectedDays.push(parseInt(cb.value)));
    if(selectedDays.length === 0) { Swal.fire('Lỗi', 'Vui lòng chọn thứ trong tuần', 'error'); return; }

    // Parse Excludes
    const excludes = new Set();
    excludeText.split('\n').forEach(line => {
        const parts = line.trim().split('/');
        if(parts.length === 3) excludes.add(new Date(parts[2], parts[1]-1, parts[0]).toDateString());
    });

    let count = 0;
    let skippedDates = []; // Lưu danh sách ngày bị trừ
    let current = new Date(startDate);
    
    while(current <= endDate) {
        // Chỉ xét những ngày đúng thứ trong tuần
        if(selectedDays.includes(current.getDay())) {
            if(excludes.has(current.toDateString())) {
                // Nếu nằm trong danh sách loại trừ -> Thêm vào skipped
                skippedDates.push(formatDate(current));
            } else {
                // Nếu không bị loại trừ -> Tính tiền
                count++;
            }
        }
        current.setDate(current.getDate() + 1);
    }

    if(count === 0 && skippedDates.length === 0) { 
        Swal.fire('Thông báo', 'Không có ngày nào phù hợp bộ lọc thứ', 'warning'); return; 
    }
    if(count === 0 && skippedDates.length > 0) { 
        Swal.fire('Thông báo', 'Tất cả các ngày đều rơi vào ngày nghỉ', 'warning'); return; 
    }

    const serviceName = select.options[select.selectedIndex].text;
    const subFieldName = document.getElementById('sub-field-select').value;
    const itemName = subFieldName ? `${serviceName} [${subFieldName}]` : serviceName;
    const total = count * duration * unitPrice;

    billItems.push({
        id: Date.now(),
        name: itemName,
        desc: `${formatDate(startDate)} - ${formatDate(endDate)} (${startTime}-${endTime})`,
        skipped: skippedDates, // Lưu mảng ngày nghỉ
        count: count,
        duration: duration,
        price: unitPrice,
        total: total
    });

    renderInvoice();
    Swal.fire({ icon: 'success', title: 'Đã thêm vào phiếu', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
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
            
            // Xử lý hiển thị ngày nghỉ
            let skippedText = '';
            if(item.skipped && item.skipped.length > 0) {
                skippedText = `<br><span class="text-xs text-red-500 italic font-medium">Trừ ngày: ${item.skipped.join(', ')}</span>`;
            }

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-100";
            tr.innerHTML = `
                <td class="p-3">
                    <div class="font-bold text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500">
                        ${item.desc}
                        ${skippedText}
                    </div>
                </td>
                <td class="p-3 text-center font-medium">${item.count} buổi</td>
                <td class="p-3 text-center font-medium">${item.duration}h</td>
                <td class="p-3 text-right text-gray-600">${formatVND(item.price)}</td>
                <td class="p-3 text-right font-bold text-gray-800">${formatVND(item.total)}</td>
                <td class="p-3 text-center no-print">
                    <button onclick="removeItem(${item.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-xmark"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('sub-total').textContent = formatVND(subTotal);
    
    let discount = 0;
    const discVal = parseFloat(document.getElementById('discount-val').value) || 0;
    const discType = document.getElementById('discount-type').value;
    if(discType === 'percent') discount = subTotal * (discVal / 100);
    else discount = discVal;

    document.getElementById('print-discount').textContent = formatVND(discount);
    document.getElementById('final-total').textContent = formatVND(subTotal - discount);
}

function removeItem(id) {
    billItems = billItems.filter(i => i.id !== id);
    renderInvoice();
}

// ==========================================
// 4. CONFIGURATION & BACKUP
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('[id^="tab-booking"], [id^="tab-config"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    const btnBooking = document.getElementById('tab-btn-booking');
    const btnConfig = document.getElementById('tab-btn-config');
    
    if(tabName === 'booking') {
        btnBooking.className = "tab-active py-4 px-1 inline-flex items-center text-sm border-b-2 font-medium cursor-pointer";
        btnConfig.className = "tab-inactive py-4 px-1 inline-flex items-center text-sm border-b-2 border-transparent font-medium cursor-pointer";
        populateFieldSelect();
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

function populateFieldSelect() {
    const select = document.getElementById('field-select');
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Chọn dịch vụ --</option>';
    
    const groups = {};
    pricingRules.forEach(rule => {
        if(!groups[rule.group]) groups[rule.group] = [];
        groups[rule.group].push(rule);
    });

    for(const [groupName, rules] of Object.entries(groups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        rules.forEach(rule => {
            const option = document.createElement('option');
            option.value = rule.id;
            option.textContent = rule.name;
            option.dataset.price = rule.price;
            option.dataset.start = rule.start;
            option.dataset.end = rule.end;
            option.dataset.days = JSON.stringify(rule.days);
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    }
    if(currentVal) select.value = currentVal;
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
    populateFieldSelect();
}
function deleteRule(id) {
    if(confirm("Xóa quy tắc này?")) {
        pricingRules = pricingRules.filter(r => r.id !== id);
        localStorage.setItem('pricingRules', JSON.stringify(pricingRules));
        renderConfigTable();
        populateFieldSelect();
    }
}
