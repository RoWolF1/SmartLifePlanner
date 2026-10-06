// LifeSmart - App Engine Script
let waterAmount = 1.8;
const waterGoal = 2.5;

function showNotification(message) {
    let notification = document.querySelector(".notification");
    if (!notification) {
        notification = document.createElement("div");
        notification.className = "notification";
        document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.opacity = "1";
    clearTimeout(notification.timer);
    notification.timer = setTimeout(() => { notification.style.opacity = "0"; }, 2200);
}

// 1. TẢI DỮ LIỆU DASHBOARD TỪ SQL SERVER
async function loadDashboardData() {
    try {
        const res = await fetch("/api/lifestyle/dashboard-data?userId=1");
        if (!res.ok) return;
        const data = await res.json();

        const bmiEl = document.getElementById("dash-bmi");
        if (bmiEl) bmiEl.innerText = data.bmi;

        const caloEl = document.getElementById("dash-calo");
        if (caloEl) caloEl.innerText = data.caloriesConsumed.toLocaleString();

        const caloProg = document.getElementById("dash-calo-progress");
        if (caloProg) caloProg.style.width = Math.min((data.caloriesConsumed / data.targetCalories) * 100, 100) + "%";

        waterAmount = data.waterConsumed;
        updateWaterUI();

        const stepsEl = document.getElementById("dash-steps");
        if (stepsEl) stepsEl.innerText = data.stepsCount.toLocaleString();

    } catch (e) {
        console.error("Lỗi nạp dashboard:", e);
    }
}

function updateWaterUI() {
    const valueEl = document.querySelectorAll(".water-value");
    valueEl.forEach(el => el.textContent = waterAmount.toFixed(1) + " L");

    const progressEl = document.getElementById("dash-water-progress");
    if (progressEl) {
        const percent = Math.min((waterAmount / waterGoal) * 100, 100);
        progressEl.style.width = percent + "%";
    }

    document.querySelectorAll(".water-glass").forEach((glass, index) => {
        if (waterAmount >= (index + 1) * 0.25) {
            glass.classList.add("active");
        } else {
            glass.classList.remove("active");
        }
    });
}

// Gọi API Thêm nước
async function addWater() {
    try {
        const res = await fetch("/api/lifestyle/add-water?userId=1&amount=0.25", { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            waterAmount = data.currentWater;
            updateWaterUI();
            showNotification("💧 Đã thêm 250ml nước vào Database!");
        }
    } catch {
        showNotification("Lỗi kết nối cơ sở dữ liệu!");
    }
}

// 2. RANDOM MÓN ĂN TỪ DATABASE
function openMealModal() { document.getElementById('mealModal').classList.add('open'); }
function closeMealModal() { document.getElementById('mealModal').classList.remove('open'); }

async function spinRandomMealFromAPI() {
    const type = document.getElementById("mealTypeSelect").value;
    const resEl = document.getElementById("spinResult");
    resEl.innerText = "Đang kết nối SQL Server... 🎲";

    try {
        const res = await fetch(`/api/lifestyle/random-meal?mealType=${type}`);
        const meal = await res.json();

        resEl.innerText = `✨ ${meal.name} (~${meal.calories} kcal)`;

        if (type === "Breakfast") document.getElementById("meal-breakfast-name").innerText = `Bữa sáng - ${meal.name}`;
        if (type === "Lunch") document.getElementById("meal-lunch-name").innerText = `Bữa trưa - ${meal.name}`;
        if (type === "Dinner") document.getElementById("meal-dinner-name").innerText = `Bữa tối - ${meal.name}`;

        showNotification(`🍱 Đã chọn: ${meal.name}`);
    } catch {
        resEl.innerText = "Lỗi khi lấy món từ CSDL!";
    }
}

// 3. TỰ ĐỘNG KHỞI CHẠY KHI MỞ TRANG
document.addEventListener("DOMContentLoaded", function () {
    loadDashboardData();
    loadOverviewTimelines();

    const waterBtn = document.querySelector(".water-add-btn");
    if (waterBtn) waterBtn.addEventListener("click", addWater);

    const menuBtn = document.querySelector(".menu-recommend-btn");
    if (menuBtn) {
        menuBtn.addEventListener("click", function () {
            showNotification("🍱 AI gợi ý: Bữa ăn hôm nay cần bổ sung thêm rau xanh!");
        });
    }
});

// 4. LOAD TIMELINE SẢNH TỔNG QUAN (CHỈ XEM)
async function loadOverviewTimelines() {
    const container = document.getElementById("overviewTimelineList");
    if (!container) return;

    try {
        const res = await fetch("/api/lifestyle/timelines?userId=1");
        const list = await res.json();

        if (list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem; padding: 10px 0;">Chưa có lịch trình nào. Vào tab "Kế hoạch & Lịch trình" để thiết lập mốc đầu tiên!</p>';
            return;
        }

        container.innerHTML = list.map(item => `
            <div class="timeline-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:var(--light-gray); border-radius:8px; margin-bottom:10px; border-left:4px solid ${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--success)' : 'var(--primary)'};">
                <div>
                    <strong style="font-size:0.85rem; color:var(--dark); margin-right:8px;">${item.timeSlot}</strong>
                    <span style="font-size:0.9rem; text-decoration:${item.isCompleted ? 'line-through' : 'none'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--dark)'};">${item.title}</span>
                </div>
                <span class="badge ${item.isCompleted ? '' : 'badge-blue'}" style="background:${item.isCompleted ? '#e1e8ed' : 'var(--primary-light)'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--primary)'};">
                    ${item.isCompleted ? 'Đã xong ✓' : 'Sắp tới'}
                </span>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red; font-size:0.85rem;">Không thể kết nối SQL Server.</p>';
    }
}

// 5. LOAD TIMELINE QUẢN LÝ (THÊM / SỬA / XÓA)
async function loadManageTimelines() {
    const container = document.getElementById("manageTimelineList");
    const countBadge = document.getElementById("timelineCountBadge");
    if (!container) return;

    try {
        const res = await fetch("/api/lifestyle/timelines?userId=1");
        const list = await res.json();

        if (countBadge) countBadge.textContent = `${list.length} mốc giờ`;

        if (list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem; padding: 15px 0;">Lịch trình hôm nay chưa có mốc nào. Hãy điền khung giờ ở trên và bấm lưu!</p>';
            return;
        }

        container.innerHTML = list.map(item => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#fff; border:1px solid var(--border); border-radius:10px; box-shadow:var(--card-shadow); border-left:5px solid ${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--success)' : 'var(--primary)'};">
                <div style="flex:1;">
                    <div style="font-weight:700; color:var(--dark); font-size:0.95rem; margin-bottom:4px;">
                        ⏰ ${item.timeSlot}
                        <span style="font-size:0.75rem; font-weight:normal; padding:2px 8px; border-radius:12px; margin-left:8px; background:${item.category === 'Meal' ? 'var(--warning-light)' : item.category === 'Rest' ? 'var(--success-light)' : 'var(--primary-light)'}; color:${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--success)' : 'var(--primary)'};">
                            ${item.category === 'Meal' ? 'Bữa ăn' : item.category === 'Rest' ? 'Nghỉ ngơi' : 'Việc làm'}
                        </span>
                    </div>
                    <div style="font-size:0.95rem; color:${item.isCompleted ? 'var(--gray)' : 'var(--dark)'}; text-decoration:${item.isCompleted ? 'line-through' : 'none'};">
                        ${item.title}
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn" style="background:${item.isCompleted ? '#e1e8ed' : 'var(--success)'}; color:${item.isCompleted ? 'var(--gray)' : '#fff'}; font-size:0.8rem; padding:6px 12px;" onclick="handleToggleStatus(${item.timelineId})">
                        ${item.isCompleted ? 'Hoàn tác' : 'Xong ✓'}
                    </button>
                    <button class="btn" style="background:var(--light-gray); color:var(--dark); font-size:0.8rem; padding:6px 10px;" onclick="handleEditTimeline(${item.timelineId}, '${item.timeSlot}', '${item.title}', '${item.category}')">✏️ Sửa</button>
                    <button class="btn" style="background:#fee2e2; color:#ef4444; font-size:0.8rem; padding:6px 10px;" onclick="handleDeleteTimeline(${item.timelineId})">🗑️ Xóa</button>
                </div>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red;">Lỗi tải dữ liệu từ SQL Server!</p>';
    }
}

// Xử lý tạo mới
async function handleCreateTimeline() {
    const timeSlot = document.getElementById("inputTimeSlot").value.trim();
    const title = document.getElementById("inputTitle").value.trim();
    const category = document.getElementById("inputCategory").value;

    if (!timeSlot || !title) {
        showNotification("⚠️ Vui lòng nhập khung giờ và nội dung!");
        return;
    }

    const res = await fetch("/api/lifestyle/timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSlot, title, category })
    });

    if (res.ok) {
        document.getElementById("inputTimeSlot").value = "";
        document.getElementById("inputTitle").value = "";
        showNotification("✅ Đã lưu vào SQL Server!");
        loadManageTimelines();
    }
}

// Đổi trạng thái Hoàn thành / Chưa xong
async function handleToggleStatus(id) {
    const res = await fetch(`/api/lifestyle/timelines/${id}/toggle`, { method: "PATCH" });
    if (res.ok) loadManageTimelines();
}

// Xóa mốc thời gian
async function handleDeleteTimeline(id) {
    if (!confirm("Bạn có chắc chắn muốn xóa mốc này khỏi Database?")) return;
    const res = await fetch(`/api/lifestyle/timelines/${id}`, { method: "DELETE" });
    if (res.ok) {
        showNotification("🗑️ Đã xóa thành công!");
        loadManageTimelines();
    }
}

// Sửa mốc thời gian
async function handleEditTimeline(id, oldTime, oldTitle, oldCategory) {
    const newTime = prompt("Nhập khung giờ mới:", oldTime);
    if (!newTime) return;
    const newTitle = prompt("Nhập nội dung mới:", oldTitle);
    if (!newTitle) return;

    const res = await fetch(`/api/lifestyle/timelines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSlot: newTime, title: newTitle, category: oldCategory })
    });

    if (res.ok) {
        showNotification("✏️ Đã cập nhật thành công!");
        loadManageTimelines();
    }
}