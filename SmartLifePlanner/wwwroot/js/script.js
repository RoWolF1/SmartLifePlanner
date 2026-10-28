let currentSpunMeal = null;
let timerInterval = null;
let timerSeconds = 0;
let currentWater = 0.0;
let targetWater = 2.5;
let chartCaloInstance = null;
let chartWaterInstance = null;

// ================= 0. JWT TOKEN & AUTHENTICATION =================
function getToken() { return localStorage.getItem("jwtToken"); }
function setToken(token) { localStorage.setItem("jwtToken", token); }
function removeToken() { localStorage.removeItem("jwtToken"); }

function checkAuthStatus() {
    const token = getToken();
    const modal = document.getElementById("authModalOverlay");
    if (!token) {
        if (modal) modal.style.display = "flex";
        toggleAuthBox('login');
    } else {
        if (modal) modal.style.display = "none";
        loadUserProfile();
    }
}

function toggleAuthBox(mode) {
    const boxLogin = document.getElementById("boxLogin");
    const boxReg = document.getElementById("boxRegister");
    if (boxLogin) boxLogin.style.display = (mode === 'login') ? "block" : "none";
    if (boxReg) boxReg.style.display = (mode === 'register') ? "block" : "none";
}

async function handleLoginSubmit() {
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;
    if (!email || !password) return alert("Vui lòng nhập email và mật khẩu!");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (res.ok) {
            const data = await res.json();
            setToken(data.token);
            showNotification("🎉 Đăng nhập thành công! Token JWT đã được cấp.");
            const modal = document.getElementById("authModalOverlay");
            if (modal) modal.style.display = "none";
            loadDashboardData();
            loadUserProfile();
        } else {
            const err = await res.json();
            alert("Đăng nhập thất bại: " + (err.message || "Sai thông tin!"));
        }
    } catch {
        alert("Lỗi kết nối máy chủ backend!");
    }
}

async function handleRegisterSubmit() {
    const fullName = document.getElementById("regFullName")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const password = document.getElementById("regPassword")?.value;
    const gender = document.getElementById("regGender")?.value || "Nam";
    const age = parseInt(document.getElementById("regAge")?.value) || 20;
    const height = parseFloat(document.getElementById("regHeight")?.value) || 170;
    const weight = parseFloat(document.getElementById("regWeight")?.value) || 60;
    const activityLevel = document.getElementById("regActivity")?.value || "Vận động vừa";
    const goal = document.getElementById("regGoal")?.value || "Duy trì";

    if (!fullName || !email || !password) {
        return alert("Vui lòng điền đủ họ tên, email và mật khẩu!");
    }

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email, password, gender, age, height, weight, activityLevel, goal })
        });

        if (res.ok) {
            alert("🎉 Đăng ký thành công! Hãy đăng nhập bằng tài khoản mới.");
            toggleAuthBox('login');
        } else {
            const msg = await res.text();
            alert("Lỗi đăng ký: " + msg);
        }
    } catch {
        alert("Lỗi gửi dữ liệu đăng ký!");
    }
}

async function loadUserProfile() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch("/api/auth/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 401) {
            removeToken();
            checkAuthStatus();
            return;
        }

        if (res.ok) {
            const profile = await res.json();
            const pageTitle = document.getElementById("page-title");
            const headerName = document.getElementById("headerUserName");
            const headerRole = document.getElementById("headerUserRole");
            const headerAvatar = document.getElementById("headerUserAvatar");

            if (pageTitle) pageTitle.innerText = `Xin chào, ${profile.fullName} 👋`;
            if (headerName) headerName.innerText = profile.fullName;
            if (headerRole) headerRole.innerText = profile.role || "Thành viên";
            if (headerAvatar) headerAvatar.innerText = profile.fullName.charAt(0).toUpperCase();
        }
    } catch (err) {
        console.error("Lỗi tải User Profile:", err);
    }
}

function handleLogout() {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất?")) return;
    removeToken();
    showNotification("Đã đăng xuất khỏi hệ thống!");
    checkAuthStatus();
}

function showNotification(message) {
    let notification = document.getElementById("toastBox") || document.querySelector(".notification");
    if (!notification) {
        notification = document.createElement("div");
        notification.className = "notification";
        notification.id = "toastBox";
        document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.opacity = "1";
    clearTimeout(notification.timer);
    notification.timer = setTimeout(() => { notification.style.opacity = "0"; }, 2400);
}

function formatDuration(totalSeconds) {
    if (totalSeconds < 60) return `${totalSeconds} giây`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (secs === 0) return `${mins} phút`;
    return `${mins} phút ${secs} giây`;
}

// ================= ĐIỀU HƯỚNG TAB =================
function switchTab(tabName) {
    const tabs = ['dashboard', 'schedule', 'meals', 'activity', 'water', 'sleep', 'statistics', 'profile'];
    tabs.forEach(t => {
        const view = document.getElementById(`view-${t}`);
        const nav = document.getElementById(`tab-nav-${t}`);
        if (view) view.style.display = (t === tabName) ? "block" : "none";
        if (nav) nav.classList.toggle("active", t === tabName);
    });

    const titleEl = document.getElementById("page-title");
    const subEl = document.getElementById("page-subtitle");
    const currentName = document.getElementById("headerUserName")?.innerText || "Bạn";

    if (tabName === "dashboard") {
        if (titleEl) titleEl.textContent = `Xin chào, ${currentName} 👋`;
        if (subEl) subEl.textContent = "Cùng theo dõi kế hoạch sinh hoạt và duy trì lối sống khoa học hôm nay.";
        loadDashboardData();
        loadTodayMealsOverview();
        loadOverviewTimelines();
    } else if (tabName === "schedule") {
        if (titleEl) titleEl.textContent = "Kế hoạch & Lịch trình 📅";
        if (subEl) subEl.textContent = "Tự do điều chỉnh, thêm, sửa hoặc xóa các mốc thời gian trong ngày.";
        loadManageTimelines();
    } else if (tabName === "meals") {
        if (titleEl) titleEl.textContent = "Thực đơn & Random món ăn 🥗";
        if (subEl) subEl.textContent = "Quay món ngẫu nhiên, áp dụng vào thực đơn ngày và tính toán Calo tự động.";
        loadMealInventory();
    } else if (tabName === "activity") {
        if (titleEl) titleEl.textContent = "Nhật ký Hoạt động & Vận động 🏃";
        if (subEl) subEl.textContent = "Theo dõi thời gian tập luyện và quy đổi bước chân chuẩn xác từng giây.";
        loadTodayActivities();
    } else if (tabName === "water") {
        if (titleEl) titleEl.textContent = "Theo dõi Lượng nước Uống 💧";
        if (subEl) subEl.textContent = "Quản lý lượng nước cá nhân hóa và ghi nhật ký từng ly nước trong ngày.";
        loadWaterSummary();
    } else if (tabName === "sleep") {
        if (titleEl) titleEl.textContent = "Giấc ngủ & Điểm hồi phục 😴";
        if (subEl) subEl.textContent = "Tính toán chu kỳ ngủ 90 phút và chấm điểm chất lượng giấc ngủ.";
        calculateBedtimes();
        loadSleepToday();
    } else if (tabName === "statistics") {
        if (titleEl) titleEl.textContent = "Thống kê & Khai phá dữ liệu 📊";
        if (subEl) subEl.textContent = "Trực quan hóa cân bằng năng lượng, thói quen và quy luật lối sống.";
        loadStatistics();
    } else if (tabName === "profile") {
        if (titleEl) titleEl.textContent = "Hồ sơ thể trạng & Trao đổi chất 👤";
        if (subEl) subEl.textContent = "Ước tính năng lượng nền BMR, tổng tiêu hao TDEE và thiết lập số đo.";
        fetchUserProfileDetails();
    }
}

// ================= 1. DASHBOARD TỔNG QUAN =================
async function loadDashboardData() {
    try {
        const res = await fetch("/api/lifestyle/dashboard-data?userId=1");
        if (!res.ok) return;
        const data = await res.json();

        const bmiEl = document.getElementById("dash-bmi");
        if (bmiEl) bmiEl.innerText = data.bmi;

        const caloEl = document.getElementById("dash-calo");
        if (caloEl) caloEl.innerText = data.caloriesConsumed.toLocaleString();

        const caloUnit = document.getElementById("dash-calo-unit");
        if (caloUnit) caloUnit.innerText = `/ ${data.targetCalories.toLocaleString()} kcal`;

        const caloPercent = Math.min((data.caloriesConsumed / data.targetCalories) * 100, 100);
        const caloProg = document.getElementById("dash-calo-progress");
        if (caloProg) caloProg.style.width = caloPercent + "%";

        currentWater = data.waterConsumed;
        targetWater = data.targetWater;

        const waterTarget = document.getElementById("dash-water-target");
        if (waterTarget) waterTarget.innerText = `/ ${targetWater.toFixed(1)} L`;

        const waterGoalSpan = document.getElementById("dashWaterGoalSpan");
        if (waterGoalSpan) waterGoalSpan.innerText = `${targetWater.toFixed(1)} L`;

        updateWaterUI();

        const stepsEl = document.getElementById("dash-steps");
        if (stepsEl) stepsEl.innerText = data.stepsCount.toLocaleString();

        const sleepBadge = document.getElementById("dashSleepStatusBadge");
        const sleepBox = document.getElementById("dashSleepDetailBox");
        const recText = document.getElementById("dashRecommendationText");

        if (data.latestSleep) {
            const hours = (data.latestSleep.durationMinutes / 60.0).toFixed(1);
            if (sleepBadge) sleepBadge.innerText = `${data.latestSleep.sleepScore} Điểm`;
            if (sleepBox) {
                sleepBox.innerHTML = `
                    <div style="font-size:1.1rem; font-weight:700; color:var(--dark); margin-bottom:4px;">Đêm qua ngủ ${hours} tiếng</div>
                    <div style="font-size:0.9rem; color:var(--gray);">Chất lượng: <strong>${data.latestSleep.qualityRating === 'Energetic' ? 'Rất khỏe khoắn ⚡' : data.latestSleep.qualityRating === 'Normal' ? 'Bình thường 🙂' : 'Mệt mỏi 😴'}</strong></div>
                `;
            }
            if (recText) {
                if (data.latestSleep.durationMinutes < 360) {
                    recText.innerText = "⚠️ Đêm qua bạn ngủ dưới 6 tiếng. Hãy bổ sung nước thường xuyên và tránh các bài tập nặng nhé!";
                } else {
                    recText.innerText = "✨ Giấc ngủ đêm qua rất tốt! Bạn đã sẵn sàng năng lượng cho ngày làm việc hôm nay.";
                }
            }
        } else {
            if (sleepBadge) sleepBadge.innerText = "Chưa ghi nhận";
            if (sleepBox) sleepBox.innerHTML = `<p style="color:var(--gray); font-size:0.95rem;">Bạn chưa ghi nhận giấc ngủ đêm qua. Hãy bấm vào để tính chu kỳ và ghi nhận điểm phục hồi!</p>`;
        }
    } catch (err) {
        console.error("Lỗi nạp dashboard:", err);
    }
}

function updateWaterUI() {
    const valueEls = document.querySelectorAll(".water-value");
    valueEls.forEach(el => el.innerText = currentWater.toFixed(1) + " L");

    const percent = Math.min((currentWater / targetWater) * 100, 100);
    const prog = document.getElementById("dash-water-progress");
    if (prog) prog.style.width = percent + "%";

    const badge = document.getElementById("waterGoalPercentBadge");
    if (badge) badge.innerText = Math.round(percent) + "% mục tiêu";

    document.querySelectorAll(".water-glass").forEach((glass, index) => {
        if (currentWater >= (index + 1) * 0.25) {
            glass.classList.add("active");
        } else {
            glass.classList.remove("active");
        }
    });
}

async function loadTodayMealsOverview() {
    try {
        const res = await fetch("/api/lifestyle/today-meals?userId=1");
        if (!res.ok) return;
        const data = await res.json();

        const bName = document.getElementById("overview-meal-breakfast");
        const bTag = document.getElementById("overview-tag-breakfast");
        const bCal = document.getElementById("overview-calo-breakfast");
        if (bName && bTag && bCal) {
            if (data.breakfast) {
                bName.innerText = `Bữa sáng - ${data.breakfast.mealName}`;
                bTag.innerText = data.breakfast.tag || "Đã chốt món";
                bCal.innerText = `${data.breakfast.calories} kcal`;
            } else {
                bName.innerText = "Bữa sáng - Chưa chọn món";
                bTag.innerText = "Bấm đổi món để chọn";
                bCal.innerText = "0 kcal";
            }
        }

        const lName = document.getElementById("overview-meal-lunch");
        const lTag = document.getElementById("overview-tag-lunch");
        const lCal = document.getElementById("overview-calo-lunch");
        if (lName && lTag && lCal) {
            if (data.lunch) {
                lName.innerText = `Bữa trưa - ${data.lunch.mealName}`;
                lTag.innerText = data.lunch.tag || "Đã chốt món";
                lCal.innerText = `${data.lunch.calories} kcal`;
            } else {
                lName.innerText = "Bữa trưa - Chưa chọn món";
                lTag.innerText = "Bấm đổi món để chọn";
                lCal.innerText = "0 kcal";
            }
        }

        const dName = document.getElementById("overview-meal-dinner");
        const dTag = document.getElementById("overview-tag-dinner");
        const dCal = document.getElementById("overview-calo-dinner");
        if (dName && dTag && dCal) {
            if (data.dinner) {
                dName.innerText = `Bữa tối - ${data.dinner.mealName}`;
                dTag.innerText = data.dinner.tag || "Đã chốt món";
                dCal.innerText = `${data.dinner.calories} kcal`;
            } else {
                dName.innerText = "Bữa tối - Chưa chọn món";
                dTag.innerText = "Bấm đổi món để chọn";
                dCal.innerText = "0 kcal";
            }
        }
    } catch (err) {
        console.error("Lỗi nạp thực đơn hôm nay:", err);
    }
}

// ================= 2. QUẢN LÝ NƯỚC UỐNG =================
async function loadWaterSummary() {
    try {
        const res = await fetch("/api/lifestyle/water-summary?userId=1");
        if (!res.ok) return;
        const data = await res.json();

        targetWater = data.targetWater;
        currentWater = data.consumedWater;

        const targetDisp = document.getElementById("waterTargetLitersDisplay");
        if (targetDisp) targetDisp.innerText = `${data.targetWater} L`;

        const desc = document.getElementById("waterFormulaDesc");
        if (desc) desc.innerText = `Hôm nay bạn đã vận động ${data.workoutMinutes} phút. Hệ thống tự động điều chỉnh mục tiêu nước lên ${data.targetWater} L.`;

        const badge = document.getElementById("waterLogCountBadge");
        const listContainer = document.getElementById("waterLogList");
        if (badge) badge.innerText = `${data.logs.length} lần`;

        if (listContainer) {
            if (data.logs.length === 0) {
                listContainer.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Chưa có lần uống nước nào hôm nay. Hãy uống một ly nước lọc để khởi đầu nhé!</p>';
                return;
            }

            listContainer.innerHTML = data.logs.map(l => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#fff; border:1px solid var(--border); border-radius:8px;">
                    <div>
                        <strong>${l.waterType === 'Water' ? '💧 Nước lọc' : l.waterType === 'Tea' ? '🍵 Trà' : l.waterType === 'Coffee' ? '☕ Cà phê' : l.waterType === 'Milk' ? '🥛 Sữa' : '🍊 Nước ép'}</strong>
                        <span style="color:var(--gray); font-size:0.85rem; margin-left:8px;">Lúc ${l.time} • Dung tích: ${l.amountMl}ml</span>
                        ${l.calories > 0 ? `<span style="color:var(--warning); font-size:0.8rem; margin-left:6px;">(+${l.calories} kcal)</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:700; color:#0284c7;">+${l.hydrationAmountMl}ml bù nước</span>
                        <button class="btn" style="background:#fee2e2; color:#ef4444; font-size:0.75rem; padding:4px 8px;" onclick="handleDeleteWaterLog(${l.logId})">🗑️</button>
                    </div>
                </div>
            `).join("");
        }
    } catch (err) {
        console.error("Lỗi nạp tổng kết nước:", err);
    }
}

async function saveWaterToBackend(amountMl, waterType) {
    try {
        const res = await fetch("/api/lifestyle/water-logs?userId=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountMl: amountMl, waterType: waterType })
        });

        if (res.ok) {
            const data = await res.json();
            showNotification(`💧 ${data.message} (+${data.hydrationMl}ml)`);
            loadWaterSummary();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi ghi nhận lượng nước!");
    }
}

function handleQuickWater(ml) {
    const type = document.getElementById("waterTypeSelect")?.value || "Water";
    saveWaterToBackend(ml, type);
}

function handleCustomWater() {
    const val = parseInt(document.getElementById("customWaterAmount")?.value);
    const type = document.getElementById("waterTypeSelect")?.value || "Water";
    if (!val || val <= 0) return alert("Vui lòng nhập số ml hợp lệ!");
    saveWaterToBackend(val, type);
    const input = document.getElementById("customWaterAmount");
    if (input) input.value = "";
}

async function handleDeleteWaterLog(id) {
    if (!confirm("Bạn có chắc muốn xóa lần uống nước này?")) return;
    try {
        const res = await fetch(`/api/lifestyle/water-logs/${id}?userId=1`, { method: "DELETE" });
        if (res.ok) {
            showNotification("🗑️ Đã xóa lần uống nước!");
            loadWaterSummary();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi khi xóa bản ghi nước!");
    }
}

// ================= 3. GIẤC NGỦ & CHU KỲ (90 PHÚT) =================
function calculateBedtimes() {
    const wakeVal = document.getElementById("calcWakeTime")?.value;
    if (!wakeVal) return;

    const [hours, minutes] = wakeVal.split(":").map(Number);
    const wakeDate = new Date();
    wakeDate.setHours(hours, minutes, 0, 0);

    const cycles = [6, 5, 4, 3];
    const container = document.getElementById("suggestedBedtimesContainer");
    if (!container) return;

    container.innerHTML = cycles.map(c => {
        const totalMinutesBack = (c * 90) + 15;
        const bedDate = new Date(wakeDate.getTime() - totalMinutesBack * 60000);
        const timeString = bedDate.toTimeString().substring(0, 5);
        const sleepHours = (c * 1.5).toFixed(1);

        return `
            <div class="sleep-cycle-card" style="border-top: 4px solid ${c >= 5 ? 'var(--success)' : c === 4 ? 'var(--warning)' : '#ef4444'};">
                <div style="font-size:1.3rem; font-weight:800; color:#4c1d95;">${timeString}</div>
                <div style="font-size:0.85rem; font-weight:700; color:var(--dark); margin:4px 0;">${c} chu kỳ (${sleepHours}h)</div>
                <small style="color:var(--gray); font-size:0.75rem;">${c >= 5 ? 'Khuyên dùng ⭐' : c === 4 ? 'Vừa đủ' : 'Hơi ít'}</small>
            </div>
        `;
    }).join("");
}

async function handleSaveSleepLog() {
    const bedVal = document.getElementById("inputSleepBed")?.value;
    const wakeVal = document.getElementById("inputSleepWake")?.value;
    const rating = document.getElementById("inputSleepRating")?.value || "Normal";

    if (!bedVal || !wakeVal) return alert("Vui lòng nhập đủ giờ ngủ và thức dậy!");

    const todayStr = new Date().toISOString().split("T")[0];
    const bedTime = `${todayStr}T${bedVal}:00`;
    const wakeTime = `${todayStr}T${wakeVal}:00`;

    try {
        const res = await fetch("/api/lifestyle/sleep-logs?userId=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bedTime, wakeTime, qualityRating: rating })
        });

        if (res.ok) {
            const result = await res.json();
            showNotification(`🌙 ${result.message} (${result.durationHours}h - Điểm: ${result.sleepScore})`);
            loadSleepToday();
            loadDashboardData();
        } else {
            const err = await res.text();
            alert("Lỗi: " + err);
        }
    } catch {
        alert("Lỗi lưu giấc ngủ!");
    }
}

async function loadSleepToday() {
    try {
        const res = await fetch("/api/lifestyle/sleep-today?userId=1");
        const data = await res.json();
        const badge = document.getElementById("sleepScoreBadge");
        const resultBox = document.getElementById("sleepDetailResult");

        if (!data) {
            if (badge) badge.innerText = "-- Điểm";
            if (resultBox) resultBox.innerHTML = '<p style="color:var(--gray); font-size:0.95rem;">Chưa có dữ liệu giấc ngủ hôm nay.</p>';
            return;
        }

        if (badge) badge.innerText = `${data.sleepScore} / 100 Điểm`;
        const hours = Math.floor(data.durationMinutes / 60);
        const mins = data.durationMinutes % 60;

        if (resultBox) {
            resultBox.innerHTML = `
                <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:18px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:1.2rem; font-weight:800; color:var(--dark);">
                            ⏱️ Tổng thời gian ngủ: ${hours} giờ ${mins} phút
                        </div>
                        <div style="color:var(--gray); margin-top:6px; font-size:0.9rem;">
                            Chu kỳ đạt được: <strong>${data.sleepCycles} chu kỳ</strong> • Trạng thái:
                            <strong style="color:${data.qualityRating === 'Energetic' ? 'var(--success)' : 'var(--primary)'};">
                                ${data.qualityRating === 'Energetic' ? 'Tràn đầy năng lượng ⚡' : data.qualityRating === 'Normal' ? 'Bình thường 🙂' : 'Mệt mỏi 😴'}
                            </strong>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:2.2rem; font-weight:800; color:#7c3aed;">${data.sleepScore}</div>
                        <small style="color:var(--gray);">Điểm phục hồi</small>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Lỗi tải thông tin giấc ngủ:", err);
    }
}

// ================= 4. THỰC ĐƠN & VÒNG QUAY MÓN ĂN =================
async function handleSpinFood() {
    const type = document.getElementById("wheelMealType")?.value || "Lunch";
    const resCard = document.getElementById("spinResultCard");
    const nameEl = document.getElementById("spinFoodName");
    const metaEl = document.getElementById("spinFoodMeta");
    const tagEl = document.getElementById("spinFoodTag");

    if (resCard) resCard.style.display = "block";
    if (nameEl) nameEl.innerText = "Đang quay món... 🎲";
    if (metaEl) metaEl.innerText = "Đang kết nối kho dữ liệu SQL Server...";
    if (tagEl) tagEl.innerText = "";

    try {
        const res = await fetch(`/api/lifestyle/random-meal?mealType=${type}`);
        if (!res.ok) throw new Error();
        const meal = await res.json();
        currentSpunMeal = meal;

        setTimeout(() => {
            if (nameEl) nameEl.innerText = meal.mealName;
            if (metaEl) metaEl.innerText = `🔥 ${meal.calories} kcal • ${Number(meal.price).toLocaleString()} đ`;
            if (tagEl) tagEl.innerText = meal.tag || "Món ăn ngon miệng";

            const btnApply = document.getElementById("btnApplySpinFood");
            if (btnApply) btnApply.onclick = () => applyMealToToday(meal.mealId, type);
        }, 400);
    } catch {
        if (nameEl) nameEl.innerText = "Chưa có món ăn trong kho!";
    }
}

async function applyMealToToday(mealId, mealType) {
    try {
        const res = await fetch("/api/lifestyle/apply-today-meal?userId=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mealId: mealId, mealType: mealType })
        });

        if (res.ok) {
            const result = await res.json();
            showNotification(`✅ Đã áp dụng ${result.meal.mealName}! Tổng Calo: ${result.totalCaloriesToday} kcal`);
            loadDashboardData();
            loadTodayMealsOverview();
        } else {
            alert("Lỗi áp dụng món ăn!");
        }
    } catch {
        alert("Lỗi kết nối khi chọn món!");
    }
}

async function loadMealInventory() {
    const grid = document.getElementById("mealGridList");
    const badge = document.getElementById("totalMealsBadge");
    if (!grid) return;

    try {
        const res = await fetch("/api/lifestyle/meals");
        const list = await res.json();
        if (badge) badge.innerText = `${list.length} món ăn`;

        grid.innerHTML = list.map(m => `
            <div class="food-card">
                <div>
                    <div style="font-weight:700; font-size:1.05rem; color:var(--dark); margin-bottom:4px;">${m.mealName}</div>
                    <div style="font-size:0.85rem; color:var(--gray); margin-bottom:8px;">
                        Phù hợp: <strong>${m.mealType === 'Breakfast' ? 'Bữa sáng' : m.mealType === 'Lunch' ? 'Bữa trưa' : 'Bữa tối'}</strong>
                    </div>
                    <div style="font-size:0.9rem; color:var(--warning); font-weight:600;">🔥 ${m.calories} kcal • ${Number(m.price).toLocaleString()} đ</div>
                </div>
                <button class="btn" style="background:var(--primary-light); color:var(--primary); font-size:0.85rem; margin-top:12px;" onclick="applyMealToToday(${m.mealId}, '${m.mealType}')">
                    Chọn cho hôm nay
                </button>
            </div>
        `).join("");
    } catch {
        grid.innerHTML = "<p>Lỗi tải danh sách món ăn!</p>";
    }
}

async function handleCreateMeal() {
    const name = document.getElementById("newMealName")?.value.trim();
    const type = document.getElementById("newMealType")?.value || "Lunch";
    const calo = parseInt(document.getElementById("newMealCalo")?.value);
    const price = parseFloat(document.getElementById("newMealPrice")?.value) || 0;

    if (!name || isNaN(calo) || calo <= 0) {
        alert("Vui lòng nhập tên món và lượng calo hợp lệ!");
        return;
    }

    const res = await fetch("/api/lifestyle/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealName: name, mealType: type, calories: calo, price: price, tag: `${calo} kcal` })
    });

    if (res.ok) {
        document.getElementById("newMealName").value = "";
        document.getElementById("newMealCalo").value = "";
        document.getElementById("newMealPrice").value = "";
        showNotification("✅ Đã thêm món mới vào Database!");
        loadMealInventory();
    }
}

// ================= 5. HOẠT ĐỘNG VẬN ĐỘNG (THEO GIÂY) =================
function startWorkoutTimer() {
    const btnStart = document.getElementById("btnTimerStart");
    const btnStop = document.getElementById("btnTimerStop");
    if (btnStart) btnStart.style.display = "none";
    if (btnStop) btnStop.style.display = "inline-block";

    timerSeconds = 0;
    const display = document.getElementById("stopwatchDisplay");
    if (display) display.innerText = "00:00";

    timerInterval = setInterval(() => {
        timerSeconds++;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const secs = String(timerSeconds % 60).padStart(2, '0');
        if (display) display.innerText = `${mins}:${secs}`;
    }, 1000);
}

async function stopWorkoutTimer() {
    clearInterval(timerInterval);
    const btnStart = document.getElementById("btnTimerStart");
    const btnStop = document.getElementById("btnTimerStop");
    if (btnStart) btnStart.style.display = "inline-block";
    if (btnStop) btnStop.style.display = "none";

    const elapsed = timerSeconds;
    const display = document.getElementById("stopwatchDisplay");
    if (display) display.innerText = "00:00";

    if (elapsed <= 0) return;
    const sportType = document.getElementById("timerSportType")?.value || "Walking";
    await saveActivityToBackend(sportType, elapsed);
}

async function handleLogActivityManual() {
    const type = document.getElementById("inputActType")?.value || "Walking";
    const val = parseInt(document.getElementById("inputActValue")?.value);
    const unit = document.getElementById("inputActUnit")?.value || "minutes";

    if (!val || val <= 0) return alert("Vui lòng nhập thời gian hợp lệ!");

    const totalSeconds = unit === "minutes" ? val * 60 : val;
    await saveActivityToBackend(type, totalSeconds);
    const input = document.getElementById("inputActValue");
    if (input) input.value = "";
}

async function saveActivityToBackend(type, durationSeconds) {
    try {
        const res = await fetch("/api/lifestyle/log-activity?userId=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityType: type, durationSeconds: durationSeconds })
        });

        if (res.ok) {
            const data = await res.json();
            showNotification(`✅ Đã lưu: ${formatDuration(durationSeconds)} (+${data.stepsAdded} bước, ~${data.caloriesBurned} kcal)`);
            loadTodayActivities();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi kết nối cơ sở dữ liệu!");
    }
}

async function loadTodayActivities() {
    const container = document.getElementById("todayActivityList");
    const badge = document.getElementById("activityCountBadge");
    if (!container) return;

    try {
        const res = await fetch("/api/lifestyle/today-activities?userId=1");
        const list = await res.json();
        if (badge) badge.innerText = `${list.length} buổi tập`;

        if (list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Hôm nay bạn chưa có buổi tập nào. Hãy bấm bắt đầu tập để đếm giờ chính xác!</p>';
            return;
        }

        container.innerHTML = list.map(a => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#fff; border:1px solid var(--border); border-radius:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div>
                    <strong>${a.activityType === 'Running' ? '🏃 Chạy bộ' : a.activityType === 'Walking' ? '🚶 Đi bộ' : a.activityType === 'Cycling' ? '🚴 Đạp xe' : '🏋️ Tập Gym'}</strong>
                    <span style="color:var(--gray); font-size:0.85rem; margin-left:8px;">
                        Thời lượng: <strong>${formatDuration(a.durationSeconds)}</strong>
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-weight:700; color:var(--primary);">
                        +${a.stepsEquivalent.toLocaleString()} bước (~${a.caloriesBurned} kcal)
                    </span>
                    <button class="btn" style="background:#fee2e2; color:#ef4444; font-size:0.8rem; padding:4px 8px;" onclick="handleDeleteActivity(${a.activityId})">
                        🗑️ Xóa
                    </button>
                </div>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red;">Lỗi tải dữ liệu hoạt động!</p>';
    }
}

async function handleDeleteActivity(id) {
    if (!confirm("Bạn có chắc muốn xóa buổi tập này và trừ lại số bước hôm nay?")) return;
    try {
        const res = await fetch(`/api/lifestyle/activities/${id}?userId=1`, { method: "DELETE" });
        if (res.ok) {
            showNotification("🗑️ Đã xóa buổi tập!");
            loadTodayActivities();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi khi xóa!");
    }
}

async function handleResetAllActivities() {
    if (!confirm("Bạn có chắc muốn reset toàn bộ hoạt động hôm nay về 0 bước?")) return;
    try {
        const res = await fetch("/api/lifestyle/reset-today-activities?userId=1", { method: "POST" });
        if (res.ok) {
            showNotification("🔄 Đã reset hoạt động hôm nay về 0!");
            loadTodayActivities();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi kết nối cơ sở dữ liệu!");
    }
}

// ================= 6. LỊCH TRÌNH TIMELINE =================
async function loadOverviewTimelines() {
    const container = document.getElementById("overviewTimelineList");
    if (!container) return;
    try {
        const res = await fetch("/api/lifestyle/timelines?userId=1");
        const list = await res.json();
        if (!list || list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Chưa có lịch trình nào.</p>';
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
        container.innerHTML = '<p style="color:red;">Lỗi kết nối CSDL.</p>';
    }
}

async function loadManageTimelines() {
    const container = document.getElementById("manageTimelineList");
    const countBadge = document.getElementById("timelineCountBadge");
    if (!container) return;
    try {
        const res = await fetch("/api/lifestyle/timelines?userId=1");
        const list = await res.json();
        if (countBadge) countBadge.textContent = `${list ? list.length : 0} công việc`;

        if (!list || list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Chưa có mốc lịch trình nào.</p>';
            return;
        }
        container.innerHTML = list.map(item => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#fff; border:1px solid var(--border); border-radius:10px; box-shadow:var(--card-shadow); border-left:5px solid ${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--success)' : 'var(--primary)'};">
                <div style="flex:1;">
                    <div style="font-weight:700; color:var(--dark); font-size:0.95rem;">⏰ ${item.timeSlot}</div>
                    <div style="font-size:0.95rem; text-decoration:${item.isCompleted ? 'line-through' : 'none'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--dark)'};">${item.title}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn" style="background:${item.isCompleted ? '#e1e8ed' : 'var(--success)'}; color:${item.isCompleted ? 'var(--gray)' : '#fff'}; font-size:0.8rem;" onclick="handleToggleStatus(${item.timelineId})">${item.isCompleted ? 'Hoàn tác' : 'Xong ✓'}</button>
                    <button class="btn" style="background:var(--light-gray); color:var(--dark); font-size:0.8rem; padding:6px 10px;" onclick="handleEditTimeline(${item.timelineId}, '${item.timeSlot}', '${item.title}', '${item.category}')">✏️ Sửa</button>
                    <button class="btn" style="background:#fee2e2; color:#ef4444; font-size:0.8rem; padding:6px 10px;" onclick="handleDeleteTimeline(${item.timelineId})">🗑️ Xóa</button>
                </div>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red;">Lỗi CSDL.</p>';
    }
}

async function handleCreateTimeline() {
    const timeSlot = document.getElementById("inputTimeSlot")?.value.trim();
    const title = document.getElementById("inputTitle")?.value.trim();
    const category = document.getElementById("inputCategory")?.value || "Task";
    if (!timeSlot || !title) return alert("Vui lòng nhập đủ thông tin!");

    const res = await fetch("/api/lifestyle/timelines?userId=1", {
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

async function handleToggleStatus(id) {
    await fetch(`/api/lifestyle/timelines/${id}/toggle`, { method: "PATCH" });
    loadManageTimelines();
}

async function handleDeleteTimeline(id) {
    if (!confirm("Xác nhận xóa?")) return;
    await fetch(`/api/lifestyle/timelines/${id}`, { method: "DELETE" });
    showNotification("🗑️ Đã xóa mốc thời gian!");
    loadManageTimelines();
}

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

// ================= 7. THỐNG KÊ (DATA MINING & CHART.JS) =================
async function loadStatistics() {
    try {
        const res = await fetch('/api/lifestyle/statistics?userId=1&days=7');
        if (!res.ok) return;
        const data = await res.json();

        const insightBox = document.getElementById('statInsightBox');
        if (insightBox) insightBox.innerText = '💡 ' + data.insight;

        // 1. Biểu đồ Calo Nạp vs Calo Đốt
        const chartCaloEl = document.getElementById('caloChart');
        if (chartCaloEl) {
            const ctxCalo = chartCaloEl.getContext('2d');
            if (chartCaloInstance) chartCaloInstance.destroy();

            chartCaloInstance = new Chart(ctxCalo, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [
                        {
                            label: 'Calo nạp (kcal)',
                            data: data.caloriesIn,
                            backgroundColor: '#f59e0b',
                            borderRadius: 6
                        },
                        {
                            label: 'Calo đốt từ vận động (kcal)',
                            data: data.caloriesBurned,
                            backgroundColor: '#ef4444',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // 2. Biểu đồ Nước uống
        const chartWaterEl = document.getElementById('waterStepsChart');
        if (chartWaterEl) {
            const ctxWater = chartWaterEl.getContext('2d');
            if (chartWaterInstance) chartWaterInstance.destroy();

            chartWaterInstance = new Chart(ctxWater, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Nước uống (Lít)',
                        data: data.water,
                        borderColor: '#0284c7',
                        backgroundColor: 'rgba(2, 132, 199, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (e) {
        console.error("Lỗi vẽ biểu đồ Thống kê:", e);
    }
}

// ================= 8. HỒ SƠ THỂ TRẠNG CÁ NHÂN =================
async function fetchUserProfileDetails() {
    try {
        let profile = null;
        const token = getToken();

        if (token) {
            const res = await fetch('/api/auth/profile', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) profile = await res.json();
        }

        if (!profile) {
            const dRes = await fetch('/api/lifestyle/dashboard-data?userId=1');
            const dData = await dRes.json();
            const w = 60; const h = 173; const a = 20;
            const bmrCalc = Math.round(10 * w + 6.25 * h - 5 * a + 5);
            const tdeeCalc = Math.round(bmrCalc * 1.55);

            profile = {
                fullName: dData.fullName || "Dương Thu Hậu",
                gender: "Nam",
                age: a,
                height: h,
                weight: w,
                activityLevel: "Vận động vừa",
                goal: "Duy trì",
                bmi: dData.bmi || 20.0,
                bmiCategory: "Bình thường",
                bmr: bmrCalc,
                tdee: tdeeCalc,
                targetCalories: dData.targetCalories || 2150,
                targetWater: dData.targetWater || 2.3,
                naturalBurnDesc: `Nam ${a} tuổi, cao ${h}cm, nặng ${w}kg thì dù nằm ngủ cả ngày vẫn đốt tự nhiên khoảng ${bmrCalc} kcal`
            };
        }

        const fName = document.getElementById('profFullName');
        const fGen = document.getElementById('profGender');
        const fAge = document.getElementById('profAge');
        const fHeight = document.getElementById('profHeight');
        const fWeight = document.getElementById('profWeight');
        const fAct = document.getElementById('profActivity');
        const fGoal = document.getElementById('profGoal');

        if (fName) fName.value = profile.fullName;
        if (fGen) fGen.value = profile.gender || 'Nam';
        if (fAge) fAge.value = profile.age || 20;
        if (fHeight) fHeight.value = profile.height;
        if (fWeight) fWeight.value = profile.weight;
        if (fAct) fAct.value = profile.activityLevel || 'Vận động vừa';
        if (fGoal) fGoal.value = profile.goal || 'Duy trì';

        const desc = document.getElementById('profileBurnDesc');
        const bmiVal = document.getElementById('profBmiVal');
        const bmiCat = document.getElementById('profBmiCat');
        const bmrVal = document.getElementById('profBmrVal');
        const tdeeVal = document.getElementById('profTdeeVal');
        const targetCal = document.getElementById('profTargetCalo');
        const targetWat = document.getElementById('profTargetWater');

        if (desc) desc.innerText = profile.naturalBurnDesc;
        if (bmiVal) bmiVal.innerText = profile.bmi;
        if (bmiCat) bmiCat.innerText = profile.bmiCategory || "Bình thường";
        if (bmrVal) bmrVal.innerText = profile.bmr + ' kcal';
        if (tdeeVal) tdeeVal.innerText = profile.tdee + ' kcal';
        if (targetCal) targetCal.innerText = profile.targetCalories + ' kcal';
        if (targetWat) targetWat.innerText = profile.targetWater + ' L';
    } catch (err) {
        console.error("Lỗi tải thông tin cá nhân:", err);
    }
}

async function saveProfileChanges() {
    const fullName = document.getElementById('profFullName')?.value.trim();
    const gender = document.getElementById('profGender')?.value || "Nam";
    const age = parseInt(document.getElementById('profAge')?.value) || 20;
    const height = parseFloat(document.getElementById('profHeight')?.value) || 170;
    const weight = parseFloat(document.getElementById('profWeight')?.value) || 60;
    const activityLevel = document.getElementById('profActivity')?.value || "Vận động vừa";
    const goal = document.getElementById('profGoal')?.value || "Duy trì";

    if (!fullName) return alert("Vui lòng nhập họ và tên!");

    const payload = {
        userId: 1,
        fullName,
        gender,
        age,
        height,
        weight,
        activityLevel,
        goal
    };

    try {
        const res = await fetch('/api/lifestyle/update-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showNotification('🎉 Cập nhật hồ sơ thể trạng thành công!');
            fetchUserProfileDetails();
            loadDashboardData();
        } else {
            alert('Không thể cập nhật hồ sơ!');
        }
    } catch {
        alert('Lỗi kết nối máy chủ!');
    }
}

// ================= 9. KHỞI CHẠY HỆ THỐNG KHI TẢI TRANG =================
document.addEventListener("DOMContentLoaded", function () {
    checkAuthStatus();
    loadDashboardData();
    loadTodayMealsOverview();
    loadOverviewTimelines();
});