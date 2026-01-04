// --- DATA INITIALIZATION ---
// Bảng giá được cập nhật theo hình ảnh cung cấp (Đơn vị: VNĐ/Giờ)
// Lưu ý: Với Cầu lông khung giờ hành chính T2-T6, tôi để mặc định giá "Vãng lai" (220k) để an toàn. 
const DEFAULT_RULES = [
    // --- CẦU LÔNG (BADMINTON) ---
    // T2-T6: 06h - 17h30 (Giá Vãng lai: 220k)
    { id: 1, group: 'Cầu lông', name: 'Sân Cầu lông (Sáng/Chiều T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '17:30', price: 220000 },
    // T2-T6: 17h30 - 22h
    { id: 2, group: 'Cầu lông', name: 'Sân Cầu lông (Tối T2-T6)', days: [1,2,3,4,5], start: '17:30', end: '22:00', price: 220000 },
    // T7-CN: 06h - 22h
    { id: 3, group: 'Cầu lông', name: 'Sân Cầu lông (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 220000 },

    // --- BÓNG RỔ 1/2 SÂN (HALF COURT) ---
    // T2-T6: 06h - 22h
    { id: 4, group: 'Bóng rổ 1/2', name: 'Bóng rổ 1 rổ (T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 240000 },
    // T7-CN: 06h - 22h
    { id: 5, group: 'Bóng rổ 1/2', name: 'Bóng rổ 1 rổ (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 270000 },

    // --- BÓNG RỔ FULL SÂN (FULL COURT) ---
    // T2-T6: 06h - 22h
    { id: 6, group: 'Bóng rổ Full', name: 'Bóng rổ Full (T2-T6)', days: [1,2,3,4,5], start: '06:00', end: '22:00', price: 450000 },
    // T7-CN: 06h - 22h
    { id: 7, group: 'Bóng rổ Full', name: 'Bóng rổ Full (Cuối tuần)', days: [6,0], start: '06:00', end: '22:00', price: 500000 },

    // --- BÓNG ĐÁ (FOOTBALL) ---
    // T2-CN: 06h - 17h
    { id: 8, group: 'Bóng đá', name: 'Sân Bóng đá (Sáng)', days: [0,1,2,3,4,5,6], start: '06:00', end: '17:00', price: 450000 },
    // T2-CN: 17h - 22h
    { id: 9, group: 'Bóng đá', name: 'Sân Bóng đá (Tối)', days: [0,1,2,3,4,5,6], start: '17:00', end: '22:00', price: 550000 },
];
