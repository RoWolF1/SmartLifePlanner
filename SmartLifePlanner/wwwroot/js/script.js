// ==========================================
// BIẾN TRẠNG THÁI TOÀN CỤC (GLOBAL STATE)
// ==========================================
let currentSpunMeal = null;
let timerInterval = null;
let timerSeconds = 0;
let currentWater = 0.0;
let targetWater = 2.3;
let chartCaloInstance = null;
let chartWaterInstance = null;
let macroWheelChartInstance = null;
let currentStatDays = 7;
let currentPlanDate = new Date();
let currentDayPlanData = null;
let currentEtmMode = 'plan'; // 'plan' (Kế hoạch) hoặc 'track' (Theo dõi)

// ==========================================
// 0. XÁC THỰC BẢO MẬT JWT & ĐIỀU KHIỂN CHẾ ĐỘ KHÁCH
// ==========================================
function getToken() {
    return localStorage.getItem("jwtToken") || localStorage.getItem("token") || localStorage.getItem("authToken");
}

function setToken(token) {
    localStorage.setItem("jwtToken", token);
}

function getCurrentUserId() {
    const uid = localStorage.getItem("currentUserId");
    return uid ? parseInt(uid) : 1;
}

function setCurrentUserId(id) {
    localStorage.setItem("currentUserId", id);
}

function removeToken() {
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUserId");
    sessionStorage.clear();
}

// Bật/tắt xem mật khẩu (Icon con mắt mở/nhắm)
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }
}

// Chuyển đổi qua lại giữa các hộp trong Modal: Đăng nhập / Đăng ký / Quên mật khẩu
function toggleAuthBox(mode) {
    const boxLogin = document.getElementById("boxLogin");
    const boxReg = document.getElementById("boxRegister");
    const boxForgot = document.getElementById("boxForgot");
    const subTitle = document.getElementById("authModalSubTitle");

    if (boxLogin) boxLogin.style.display = (mode === 'login') ? "block" : "none";
    if (boxReg) boxReg.style.display = (mode === 'register') ? "block" : "none";
    if (boxForgot) boxForgot.style.display = (mode === 'forgot') ? "block" : "none";

    if (subTitle) {
        if (mode === 'login') subTitle.innerText = "Đăng nhập tài khoản để đồng bộ dữ liệu sinh trắc";
        if (mode === 'register') subTitle.innerText = "Điền đầy đủ thông tin để thuật toán AI tính toán BMR/TDEE";
        if (mode === 'forgot') subTitle.innerText = "Khôi phục quyền truy cập tài khoản";
    }

    if (mode === 'forgot') {
        const s1 = document.getElementById("forgotStep1");
        const s2 = document.getElementById("forgotStep2");
        if (s1) s1.style.display = "flex";
        if (s2) s2.style.display = "none";
    }
}

function openAuthModal(mode = 'login') {
    const modal = document.getElementById("authModalOverlay");
    if (modal) {
        modal.style.display = "flex";
        toggleAuthBox(mode);
    }
}

function closeAuthModal() {
    const modal = document.getElementById("authModalOverlay");
    if (modal) modal.style.display = "none";
}

// Kiểm tra trạng thái đăng nhập: Nếu chưa có Token -> Chuyển sang giao diện Khách
async function checkAuthStatus() {
    const token = getToken();
    if (!token) {
        applyGuestMode();
    } else {
        await loadUserProfile();
        await loadDashboardData();
        await loadTodayMealsOverview();
    }
}

// Chế độ Khách (Guest Mode)
function applyGuestMode() {
    const titleName = document.getElementById("headerUserNameTitle");
    const headerAvatar = document.getElementById("headerAvatar");
    const roleBadge = document.getElementById("badgeUserRole");
    const btnAuth = document.getElementById("btnHeaderAuth") || document.querySelector(".btn-auth-header") || document.querySelector(".btn-logout-header");

    if (titleName) titleName.innerText = "Xin chào, Bạn (Chế độ Khách) 👋";
    if (headerAvatar) headerAvatar.innerText = "G";
    if (roleBadge) {
        roleBadge.innerText = "CHƯA ĐĂNG NHẬP";
        roleBadge.style.background = "#f1f5f9";
        roleBadge.style.color = "#64748b";
    }
    if (btnAuth) {
        btnAuth.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập`;
        btnAuth.onclick = () => openAuthModal('login');
        btnAuth.style.background = "#dcfce7";
        btnAuth.style.color = "#15803d";
        btnAuth.style.borderColor = "#86efac";
    }

    const bmiEl = document.getElementById("dash-bmi");
    if (bmiEl) bmiEl.innerText = "--";
    const caloEl = document.getElementById("dash-calo");
    if (caloEl) caloEl.innerText = "0";
    const waterEls = document.querySelectorAll(".water-value");
    waterEls.forEach(el => el.innerText = "0.0 L");

    const profBmi = document.getElementById('profBmiVal');
    const profBmiCat = document.getElementById('profBmiCat');
    const profBmr = document.getElementById('profBmrVal');
    const profTdee = document.getElementById('profTdeeVal');
    const profWater = document.getElementById('profTargetWater');
    const profDesc = document.getElementById('profileBurnDesc');

    if (profBmi) profBmi.innerText = "--";
    if (profBmiCat) profBmiCat.innerText = "Chưa xác định";
    if (profBmr) profBmr.innerText = "-- kcal";
    if (profTdee) profTdee.innerText = "-- kcal";
    if (profWater) profWater.innerText = "-- L";
    if (profDesc) profDesc.innerText = "Đăng nhập tài khoản để hệ thống tính toán chính xác mức năng lượng nền và lượng nước cần bổ sung cho thể trạng của bạn.";

    const fName = document.getElementById('profFullName');
    if (fName) fName.value = "";

    const guestNotice = `
        <div style="background:#fff; border:2px dashed #cbd5e1; border-radius:16px; padding:36px; text-align:center;">
            <span style="font-size:2.6rem;">🔒</span>
            <h3 style="margin:10px 0 6px 0; color:var(--dark);">Dữ liệu Cá Nhân Được Bảo Vệ</h3>
            <p style="color:var(--gray); font-size:0.9rem; max-width:500px; margin:0 auto 16px;">
                Bạn đang duyệt web ở chế độ Khách. Vui lòng đăng nhập để hệ thống đối chiếu thể trạng, cá nhân hóa thực đơn và lưu tiến trình.
            </p>
            <button class="btn btn-primary" onclick="openAuthModal('login')">Đăng nhập Ngay</button>
            <button class="btn btn-orange" style="margin-left:8px;" onclick="openAuthModal('register')">Đăng ký Mới</button>
        </div>
    `;

    const mealsContainer = document.getElementById("mealsContainerList");
    if (mealsContainer) mealsContainer.innerHTML = guestNotice;

    const waterList = document.getElementById("waterLogList");
    if (waterList) waterList.innerHTML = '<p style="color:var(--gray); text-align:center; padding:16px;">Vui lòng đăng nhập để xem lịch sử uống nước.</p>';

    const sleepDetail = document.getElementById("sleepDetailResult");
    if (sleepDetail) sleepDetail.innerHTML = '<p style="color:var(--gray); text-align:center; padding:16px;">Vui lòng đăng nhập để ghi nhận và chấm điểm giấc ngủ.</p>';

    const statTable = document.getElementById("statHistoryTableBody");
    if (statTable) statTable.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--gray);">Dữ liệu thống kê chỉ hiển thị khi đã đăng nhập tài khoản.</td></tr>`;
}

// Xử lý Đăng xuất
function handleLogout() {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc?")) return;
    removeToken();
    showNotification("Đã đăng xuất! Chuyển về chế độ Khách.");
    applyGuestMode();
    openAuthModal('login');
}

// Xử lý gửi Form Đăng nhập
async function handleLoginSubmit() {
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;
    if (!email || !password) return alert("Vui lòng nhập đầy đủ email và mật khẩu!");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        if (res.ok) {
            const data = await res.json();
            setToken(data.token);

            const uid = data.user?.userId || data.userId;
            if (uid) {
                setCurrentUserId(uid);
            }

            closeAuthModal();
            showNotification("🎉 Đăng nhập thành công!");

            await loadUserProfile();
            await loadDashboardData();
            await loadTodayMealsOverview();
            loadEtmPlanForCurrentDate();
        } else {
            const err = await res.json().catch(() => ({ message: "Sai tài khoản hoặc mật khẩu!" }));
            alert(err.message || "Đăng nhập thất bại!");
        }
    } catch {
        alert("Lỗi kết nối máy chủ xác thực backend!");
    }
}

// Xử lý gửi Form Đăng ký
async function handleRegisterSubmit() {
    const fullName = document.getElementById("regFullName")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const password = document.getElementById("regPassword")?.value;
    const gender = document.getElementById("regGender")?.value || "Nam";
    const age = parseInt(document.getElementById("regAge")?.value);
    const height = parseFloat(document.getElementById("regHeight")?.value);
    const weight = parseFloat(document.getElementById("regWeight")?.value);
    const activityLevel = document.getElementById("regActivity")?.value || "Vận động vừa";
    const goal = document.getElementById("regGoal")?.value || "Duy trì";

    if (!fullName || !email || !password || isNaN(age) || isNaN(height) || isNaN(weight)) {
        return alert("Vui lòng điền đầy đủ tất cả các thông tin thể trạng bắt buộc!");
    }

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email, password, gender, age, height, weight, activityLevel, goal })
        });

        if (res.ok) {
            alert("🎉 Đăng ký tài khoản thành công! Hãy đăng nhập để kích hoạt lộ trình calo & nước của bạn.");
            toggleAuthBox('login');
        } else {
            const msg = await res.text();
            alert("Lỗi đăng ký: " + msg);
        }
    } catch {
        alert("Lỗi gửi dữ liệu đăng ký!");
    }
}

// Xử lý Gửi mã OTP Quên mật khẩu
async function handleSendOtp() {
    const email = document.getElementById("forgotEmail")?.value.trim();
    if (!email) return alert("Vui lòng nhập địa chỉ email đăng ký!");

    const btn = event.target;
    const oldText = btn.innerText;
    btn.innerText = "Đang gửi mail...";
    btn.disabled = true;

    try {
        const res = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById("forgotStep1").style.display = "none";
            document.getElementById("forgotStep2").style.display = "flex";

            const notice = document.getElementById("forgotOtpNotice");
            if (notice) notice.innerText = data.message;

            const codeInput = document.getElementById("forgotOtpCode");
            if (codeInput) {
                codeInput.value = "";
                codeInput.focus();
            }
        } else {
            alert(data.message || data || "Không tìm thấy tài khoản!");
        }
    } catch {
        alert("Lỗi kết nối khi gửi email xác thực!");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// Xử lý Xác nhận OTP và đặt lại mật khẩu mới
async function handleResetPasswordSubmit() {
    const email = document.getElementById("forgotEmail")?.value.trim();
    const otp = document.getElementById("forgotOtpCode")?.value.trim();
    const newPassword = document.getElementById("forgotNewPassword")?.value;

    if (!otp || !newPassword) return alert("Vui lòng nhập đủ mã OTP và mật khẩu mới!");

    try {
        const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            toggleAuthBox('login');
        } else {
            alert("Lỗi: " + (data.message || data));
        }
    } catch {
        alert("Lỗi kết nối khi đặt lại mật khẩu!");
    }
}

// Tải thông tin hồ sơ người dùng qua JWT Token (Đã chuẩn hóa bóc tách dữ liệu)
async function loadUserProfile() {
    const token = getToken();
    if (!token) {
        applyGuestMode();
        return;
    }

    try {
        const res = await fetch("/api/auth/profile", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            removeToken();
            applyGuestMode();
            return;
        }

        const rawData = await res.json();
        const profile = rawData.user ? rawData.user : rawData;

        const uid = profile.userId || rawData.userId;
        if (uid) {
            setCurrentUserId(uid);
        }

        const titleName = document.getElementById("headerUserNameTitle");
        const headerAvatar = document.getElementById("headerAvatar");
        const roleBadge = document.getElementById("badgeUserRole");
        const btnAuth = document.getElementById("btnHeaderAuth") || document.querySelector(".btn-auth-header") || document.querySelector(".btn-logout-header");

        const displayName = profile.fullName || rawData.fullName || "Người dùng";
        if (titleName) titleName.innerText = `Xin chào, ${displayName} 👋`;
        if (headerAvatar) headerAvatar.innerText = displayName.charAt(0).toUpperCase();

        const roleName = profile.role || rawData.role || "User";
        if (roleBadge) {
            const isVip = roleName.toUpperCase() === "VIP";
            roleBadge.innerText = isVip ? "TÀI KHOẢN VIP" : "GÓI FREE";
            roleBadge.style.background = isVip ? "#dcfce7" : "#fee2e2";
            roleBadge.style.color = isVip ? "#166534" : "#ef4444";
        }

        if (btnAuth) {
            btnAuth.innerHTML = `<i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất`;
            btnAuth.onclick = handleLogout;
            btnAuth.style.background = "#fee2e2";
            btnAuth.style.color = "#dc2626";
            btnAuth.style.borderColor = "#fecaca";
        }

        const bmiVal = document.getElementById('profBmiVal');
        const bmiCat = document.getElementById('profBmiCat');
        const bmrVal = document.getElementById('profBmrVal');
        const tdeeVal = document.getElementById('profTdeeVal');
        const targetWat = document.getElementById('profTargetWater');
        const desc = document.getElementById('profileBurnDesc');

        const bmrValue = rawData.bmr ?? profile.bmr ?? 0;
        const tdeeValue = rawData.tdee ?? profile.tdee ?? 0;
        const bmiValue = rawData.bmi ?? profile.bmi ?? "--";
        const bmiCategory = rawData.bmiCategory ?? profile.bmiCategory ?? "Bình thường";
        const waterValue = profile.targetWater ?? rawData.targetWater ?? 2.3;

        if (bmiVal) bmiVal.innerText = bmiValue;
        if (bmiCat) bmiCat.innerText = bmiCategory;
        if (bmrVal) bmrVal.innerText = `${bmrValue} kcal`;
        if (tdeeVal) tdeeVal.innerText = `${tdeeValue} kcal`;
        if (targetWat) targetWat.innerText = `${waterValue} L`;
        if (desc) desc.innerText = rawData.naturalBurnDesc || `${displayName} có mức tiêu hao BMR là ${bmrValue} kcal.`;

        const fName = document.getElementById('profFullName');
        const fGen = document.getElementById('profGender');
        const fAge = document.getElementById('profAge');
        const fHeight = document.getElementById('profHeight');
        const fWeight = document.getElementById('profWeight');
        const fAct = document.getElementById('profActivity');
        const fGoal = document.getElementById('profGoal');

        if (fName) fName.value = displayName;
        if (fGen) fGen.value = profile.gender || rawData.gender || 'Nam';
        if (fAge) fAge.value = profile.age || rawData.age || 20;
        if (fHeight) fHeight.value = profile.height || rawData.height || 170;
        if (fWeight) fWeight.value = profile.weight || rawData.weight || 60;
        if (fAct) fAct.value = profile.activityLevel || rawData.activityLevel || 'Vận động vừa';
        if (fGoal) fGoal.value = profile.goal || rawData.goal || 'Duy trì';
    } catch (err) {
        console.error("Lỗi nạp User Profile:", err);
    }
}

// Hiệu chỉnh thông tin hồ sơ thể trạng
async function saveProfileChanges() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const fullName = document.getElementById('profFullName')?.value.trim();
    const gender = document.getElementById('profGender')?.value || "Nam";
    const age = parseInt(document.getElementById('profAge')?.value) || 20;
    const height = parseFloat(document.getElementById('profHeight')?.value) || 173;
    const weight = parseFloat(document.getElementById('profWeight')?.value) || 60;
    const activityLevel = document.getElementById('profActivity')?.value || "Vận động vừa";
    const goal = document.getElementById('profGoal')?.value || "Duy trì";

    if (!fullName) return alert("Vui lòng nhập họ và tên!");

    const payload = { userId: uid, fullName, gender, age, height, weight, activityLevel, goal };

    try {
        const res = await fetch('/api/lifestyle/update-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showNotification('🎉 Cập nhật hồ sơ thể trạng thành công!');
            await loadUserProfile();
            await loadDashboardData();
        } else {
            alert('Không thể cập nhật hồ sơ!');
        }
    } catch {
        alert('Lỗi kết nối máy chủ!');
    }
}

// ==========================================
// 1. PHÂN HỆ EAT THIS MUCH: PLAN VS TRACK & LANDING
// ==========================================
function switchEtmTab(tabName) {
    const tabs = ['landing', 'plan', 'track', 'statistics', 'water', 'sleep', 'profile'];
    tabs.forEach(t => {
        const n = document.getElementById(`tab-nav-${t}`);
        if (n) n.classList.toggle('active', t === tabName);
    });

    ['landing', 'planner', 'statistics', 'water', 'sleep', 'profile'].forEach(t => {
        const v = document.getElementById(`view-etm-${t}`);
        if (v) v.style.display = 'none';
    });

    const plannerView = document.getElementById('view-etm-planner');

    if (tabName === 'landing') {
        const landingView = document.getElementById('view-etm-landing');
        if (landingView) landingView.style.display = 'block';
    } else if (tabName === 'plan' || tabName === 'track') {
        currentEtmMode = tabName;
        if (plannerView) plannerView.style.display = 'block';

        const btnGenerator = document.querySelector('.btn-orange[onclick="openGeneratorDrawer()"]');
        const macroTitle = document.querySelector('.macro-column h3');
        const macroSub = document.querySelector('.macro-column small');

        if (currentEtmMode === 'plan') {
            if (btnGenerator) btnGenerator.style.display = 'inline-flex';
            if (macroTitle) macroTitle.innerText = 'Dự kiến Kế hoạch (Totals)';
            if (macroSub) macroSub.innerText = 'Phân bổ năng lượng nếu tuân thủ thực đơn dự kiến';
        } else {
            if (btnGenerator) btnGenerator.style.display = 'none';
            if (macroTitle) macroTitle.innerText = 'Đã ăn Thực tế (Tracked)';
            if (macroSub) macroSub.innerText = 'Chỉ tính các món đã được đánh dấu tích [✓]';
        }

        if (getToken()) {
            loadEtmPlanForCurrentDate();
        } else {
            applyGuestMode();
        }
    } else {
        const targetView = document.getElementById(`view-etm-${tabName}`);
        if (targetView) targetView.style.display = 'block';

        if (getToken()) {
            if (tabName === 'statistics') {
                loadStatistics(currentStatDays);
                loadMachineLearningPrediction(); 
            }
            if (tabName === 'water') loadWaterSummary();
            if (tabName === 'sleep') { loadSleepToday(); calculateBedtimes(); }
            if (tabName === 'profile') loadUserProfile();
        } else {
            applyGuestMode();
        }
    }
}

function navigateDate(offset) {
    currentPlanDate.setDate(currentPlanDate.getDate() + offset);
    if (getToken()) loadEtmPlanForCurrentDate();
}

async function loadEtmPlanForCurrentDate() {
    const token = getToken();
    if (!token) return applyGuestMode();

    const uid = getCurrentUserId();
    const dateStr = currentPlanDate.toISOString().split('T')[0];

    try {
        const res = await fetch(`/api/lifestyle/plan-by-date?userId=${uid}&dateStr=${dateStr}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        currentDayPlanData = data;

        const roleBadge = document.getElementById('badgeUserRole');
        const vipBtn = document.getElementById('btnSidebarVip');
        const txtToggle = document.getElementById('txtToggleRole');
        const adminSection = document.getElementById('menuAdminSection');

        if (data.isVip) {
            if (roleBadge) { roleBadge.innerText = 'TÀI KHOẢN VIP'; roleBadge.style.background = '#dcfce7'; roleBadge.style.color = '#166534'; }
            if (vipBtn) vipBtn.style.display = 'none';
            if (txtToggle) txtToggle.innerText = 'Hạ cấp về Gói Free (Test)';
        } else {
            if (roleBadge) { roleBadge.innerText = 'GÓI FREE'; roleBadge.style.background = '#fee2e2'; roleBadge.style.color = '#ef4444'; }
            if (vipBtn) vipBtn.style.display = 'flex';
            if (txtToggle) txtToggle.innerText = 'Nâng cấp lên VIP (Demo)';
        }

        if (adminSection) adminSection.style.display = (data.roleName === 'Admin') ? 'block' : 'none';

        const noticeBox = document.getElementById('cardVipLockNotice');
        const contentArea = document.getElementById('etmMainContentArea');

        if (data.isLockedForFree) {
            if (noticeBox) noticeBox.style.display = 'block';
            if (contentArea) contentArea.style.display = 'none';
            const curDisplay = document.getElementById('currentDateDisplay');
            if (curDisplay) curDisplay.innerText = data.dateDisplay || dateStr;
            return;
        } else {
            if (noticeBox) noticeBox.style.display = 'none';
            if (contentArea) contentArea.style.display = 'grid';
        }

        const dateDisp = document.getElementById('currentDateDisplay');
        if (dateDisp) dateDisp.innerText = data.dateDisplay;

        const tarCal = document.getElementById('targetCaloVal');
        if (tarCal) tarCal.innerText = data.targetCalories;

        const mTarCarbs = document.getElementById('macroTargetCarbsVal');
        if (mTarCarbs) mTarCarbs.innerText = `${data.macro.targetCarbs}g`;

        const mTarFat = document.getElementById('macroTargetFatVal');
        if (mTarFat) mTarFat.innerText = `${data.macro.targetFat}g`;

        const mTarPro = document.getElementById('macroTargetProteinVal');
        if (mTarPro) mTarPro.innerText = `${data.macro.targetProtein}g`;

        renderMealsColumn(data.meals);
        updateMacroSummaryDisplay();
    } catch (err) {
        console.error("Lỗi nạp thực đơn ETM:", err);
    }
}

function renderMealsColumn(meals) {
    const container = document.getElementById('mealsContainerList');
    if (!container) return;

    if (!meals || meals.length === 0) {
        container.innerHTML = '<p style="color:var(--gray); text-align:center; padding:20px;">Chưa có món ăn nào trong thực đơn ngày này.</p>';
        return;
    }

    const bMeals = meals.filter(m => m.mealType.toLowerCase() === 'breakfast');
    const lMeals = meals.filter(m => m.mealType.toLowerCase() === 'lunch');
    const dMeals = meals.filter(m => m.mealType.toLowerCase() === 'dinner');

    const isTrackingMode = (currentEtmMode === 'track');

    const renderGroup = (title, icon, groupList) => `
        <div class="meal-group-card">
            <div class="meal-group-header">
                <div>
                    <h3 style="font-size:1.15rem; font-weight:800;">${icon} ${title}</h3>
                    <small style="color:var(--gray);">${groupList.reduce((s, x) => s + x.calories, 0)} Calories</small>
                </div>
                ${!isTrackingMode
            ? `<span class="badge" style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">Đang lên kế hoạch</span>`
            : `<span class="badge" style="background:#dbeafe; color:#1d4ed8; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">Đánh dấu đã ăn</span>`
        }
            </div>
            ${groupList.map(item => `
                <div class="meal-item-row" data-meal-id="${item.dailyMealId}" data-calories="${item.calories}">
                    <div style="display:flex; align-items:center; gap:12px;">
                        ${isTrackingMode ? `
                            <input type="checkbox" ${item.isEaten ? 'checked' : ''} class="meal-check-box" style="width:20px; height:20px; cursor:pointer; accent-color:var(--primary);" onchange="toggleMealEatenStatus(${item.dailyMealId})" />
                        ` : `
                            <span style="color:var(--gray); font-size:1.1rem;">📌</span>
                        `}
                        <div class="meal-item-img">${icon}</div>
                        <div>
                            <div style="font-weight:700; font-size:1.02rem;">${item.mealName}</div>
                            <small style="color:var(--gray);">${item.servingUnit} • ${Number(item.price).toLocaleString()} đ</small>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-weight:800; color:#f97316;">${item.calories} kcal</span>
                        ${!isTrackingMode ? `
                            <button class="btn" style="background:#f1f5f9; padding:5px 10px; font-size:0.8rem;" onclick="handleSwapMeal(${item.dailyMealId})">🔄 Đổi món</button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = `
        ${renderGroup('Bữa sáng (Breakfast)', '🍳', bMeals)}
        ${renderGroup('Bữa trưa (Lunch)', '🍗', lMeals)}
        ${renderGroup('Bữa tối (Dinner)', '🐟', dMeals)}
    `;
}

function handleMealCheckboxChange() {
    updateMacroSummaryDisplay();
}

function updateMacroSummaryDisplay() {
    if (!currentDayPlanData) return;

    let caloSum = 0;

    if (currentEtmMode === 'plan') {
        caloSum = currentDayPlanData.totalCalories;
    } else {
        const rows = document.querySelectorAll('.meal-item-row');
        rows.forEach(row => {
            const chk = row.querySelector('.meal-check-box');
            if (chk && chk.checked) {
                const c = parseInt(row.getAttribute('data-calories')) || 0;
                caloSum += c;
            }
        });
    }

    const carbsG = Math.round(caloSum * 0.50 / 4.0);
    const fatG = Math.round(caloSum * 0.25 / 9.0);
    const proteinG = Math.round(caloSum * 0.25 / 4.0);

    const tCal = document.getElementById('trackedCaloVal');
    if (tCal) tCal.innerText = caloSum;

    const mCarbs = document.getElementById('macroCarbsVal');
    if (mCarbs) mCarbs.innerText = `${carbsG}g`;

    const mFat = document.getElementById('macroFatVal');
    if (mFat) mFat.innerText = `${fatG}g`;

    const mPro = document.getElementById('macroProteinVal');
    if (mPro) mPro.innerText = `${proteinG}g`;

    renderMacroPieChart(50, 25, 25);
}

async function handleSwapMeal(dailyMealId) {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const res = await fetch(`/api/lifestyle/swap-meal/${dailyMealId}?userId=${uid}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
        loadEtmPlanForCurrentDate();
    } else {
        alert("Không thể đổi món!");
    }
}

function renderMacroPieChart(cPercent, fPercent, pPercent) {
    const canvas = document.getElementById('canvasMacroWheel');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (macroWheelChartInstance) macroWheelChartInstance.destroy();

    const dataValues = (cPercent === 0 && fPercent === 0 && pPercent === 0) ? [1] : [cPercent, fPercent, pPercent];
    const dataColors = (cPercent === 0 && fPercent === 0 && pPercent === 0) ? ['#e2e8f0'] : ['#eab308', '#06b6d4', '#a855f7'];
    const dataLabels = (cPercent === 0 && fPercent === 0 && pPercent === 0) ? ['Chưa nạp'] : [`Carbs ${cPercent}%`, `Fat ${fPercent}%`, `Protein ${pPercent}%`];

    macroWheelChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dataLabels,
            datasets: [{
                data: dataValues,
                backgroundColor: dataColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '65%'
        }
    });
}

function openDetailedNutritionModal() {
    if (!currentDayPlanData) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    setVal('dnCaloriesVal', currentDayPlanData.totalCalories);
    setVal('dnCarbsVal', `${currentDayPlanData.macro.carbs}g`);
    setVal('dnFiberVal', `${currentDayPlanData.macro.fiber}g`);
    setVal('dnFatVal', `${currentDayPlanData.macro.fat}g`);
    setVal('dnProteinVal', `${currentDayPlanData.macro.protein}g`);
    setVal('dnSodiumVal', `${currentDayPlanData.macro.sodium}mg`);
    setVal('dnCholesterolVal', `${currentDayPlanData.macro.cholesterol}mg`);

    const modal = document.getElementById('modalDetailedNutrition');
    if (modal) modal.style.display = 'flex';
}

function closeDetailedNutritionModal() {
    const modal = document.getElementById('modalDetailedNutrition');
    if (modal) modal.style.display = 'none';
}

function openPricingModal() {
    const modal = document.getElementById('modalPricingVip');
    if (modal) modal.style.display = 'flex';
}

function closePricingModal() {
    const modal = document.getElementById('modalPricingVip');
    if (modal) modal.style.display = 'none';
}

function openGeneratorDrawer() {
    const modal = document.getElementById('modalGenerator');
    if (modal) modal.style.display = 'flex';
}

function closeGeneratorDrawer() {
    const modal = document.getElementById('modalGenerator');
    if (modal) modal.style.display = 'none';
}

async function executeMealGenerator() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const focus = document.getElementById('genSelectFocus')?.value || "Balanced";
    const priceLimit = document.getElementById('genDailyPriceLimit')?.value || "No limit";
    const carbsTarget = document.getElementById('genTargetCarbsAs')?.value || "Total carbs";
    const allowHalf = document.getElementById('genAllowHalfServings')?.checked || false;
    const glp1 = document.getElementById('genAdjustGlp1')?.checked || false;
    const dateStr = currentPlanDate.toISOString().split('T')[0];

    const payload = {
        dateStr: dateStr,
        focus: focus,
        dailyPriceLimit: priceLimit,
        targetCarbsAs: carbsTarget,
        allowHalfServings: allowHalf,
        adjustForGlp1: glp1
    };

    try {
        const res = await fetch(`/api/lifestyle/generate-meal-plan?userId=${uid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeGeneratorDrawer();
            showNotification(`⚡ Đã tạo thực đơn: ${focus} (${priceLimit})!`);
            loadEtmPlanForCurrentDate();
        } else {
            const msg = await res.text();
            alert(msg);
        }
    } catch {
        alert("Lỗi kết nối khi sinh thực đơn AI!");
    }
}

async function toggleUserVipRole() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const res = await fetch(`/api/lifestyle/toggle-vip-role?userId=${uid}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
        loadEtmPlanForCurrentDate();
    }
}

async function activateVipDemo() {
    await toggleUserVipRole();
    closePricingModal();
}

// ==========================================
// 2. DASHBOARD OVERVIEW & CHỈ SỐ SINH TRẮC
// ==========================================
async function loadDashboardData() {
    const token = getToken();
    if (!token) return applyGuestMode();

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/dashboard-data?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);

        const bmiEl = document.getElementById("dash-bmi");
        if (bmiEl) bmiEl.innerText = data.bmi || 20.05;

        const caloEl = document.getElementById("dash-calo");
        if (caloEl) caloEl.innerText = (data.caloriesConsumed || 0).toLocaleString();

        const caloUnit = document.getElementById("dash-calo-unit");
        if (caloUnit) caloUnit.innerText = `/ ${(data.targetCalories || 2150).toLocaleString()} kcal (BMR: ${data.bmr || 1586} kcal)`;

        const caloPercent = Math.min(((data.caloriesConsumed || 0) / (data.targetCalories || 2150)) * 100, 100);
        const caloProg = document.getElementById("dash-calo-progress");
        if (caloProg) caloProg.style.width = caloPercent + "%";

        currentWater = data.waterConsumed || 0.0;
        targetWater = data.targetWater || 2.3;

        const waterValueEls = document.querySelectorAll(".water-value");
        waterValueEls.forEach(el => el.innerText = currentWater.toFixed(1) + " L");

        const waterTarget = document.getElementById("dash-water-target");
        if (waterTarget) waterTarget.innerText = `/ ${targetWater.toFixed(1)} L (Tự động bù vận động)`;

        const waterGoalSpan = document.getElementById("dashWaterGoalSpan");
        if (waterGoalSpan) waterGoalSpan.innerText = `${targetWater.toFixed(1)} L`;

        updateWaterUI();

        const stepsEl = document.getElementById("dash-steps");
        const stepsCount = (data.stepsCount !== undefined && data.stepsCount !== null) ? data.stepsCount : (data.stepCount || 0);
        if (stepsEl) stepsEl.innerText = `${stepsCount.toLocaleString()} bước`;

        const burnedSub = document.getElementById("dash-burned-calories-sub");
        if (burnedSub) burnedSub.innerText = `${data.caloriesBurned || 0} kcal đốt hôm nay`;

        const sleepBadge = document.getElementById("dashSleepStatusBadge");
        const sleepBox = document.getElementById("dashSleepDetailBox");
        const recText = document.getElementById("dashRecommendationText");

        if (data.latestSleep) {
            const hours = (data.latestSleep.durationMinutes / 60.0).toFixed(1);
            if (sleepBadge) sleepBadge.innerText = `${data.latestSleep.sleepScore} Điểm`;
            if (sleepBox) {
                sleepBox.innerHTML = `
                    <div style="font-size:1.05rem; font-weight:700; color:var(--dark); margin-bottom:4px;">Đêm qua ngủ ${hours} tiếng</div>
                    <div style="font-size:0.88rem; color:var(--gray);">Chất lượng: <strong>${data.latestSleep.qualityRating === 'Energetic' ? 'Rất khỏe khoắn ⚡' : data.latestSleep.qualityRating === 'Normal' ? 'Bình thường 🙂' : 'Mệt mỏi 😴'}</strong></div>
                `;
            }
            if (recText) {
                recText.innerText = data.latestSleep.durationMinutes < 360
                    ? "⚠️ Đêm qua bạn ngủ dưới 6 tiếng. Hệ thống đã tự động tính bù lượng nước cần nạp thêm!"
                    : "✨ Giấc ngủ đêm qua rất tốt! Cơ thể đã sẵn sàng chuyển hóa năng lượng tối ưu hôm nay.";
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
async function toggleMealEatenStatus(dailyMealId) {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/toggle-meal-eaten/${dailyMealId}?userId=${uid}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            showNotification(data.isEaten ? "✅ Đã đánh dấu đã ăn món này!" : "🔄 Đã bỏ đánh dấu!");
            // Cập nhật lại tổng calo thực tế trên giao diện và macro
            await loadDashboardData();
            updateMacroSummaryDisplay();
        } else {
            alert("Không thể cập nhật trạng thái món ăn!");
        }
    } catch (err) {
        console.error("Lỗi khi thay đổi trạng thái món ăn:", err);
        alert("Lỗi kết nối máy chủ!");
    }
}

async function loadTodayMealsOverview() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/today-meals?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);

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

// ==========================================
// 3. QUẢN LÝ LƯỢNG NƯỚC UỐNG (HYDRATION)
// ==========================================
async function loadWaterSummary() {
    const token = getToken();
    if (!token) return applyGuestMode();

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/water-summary?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);

        targetWater = data.targetWater || 2.3;
        currentWater = data.consumedWater || 0.0;

        const targetDisp = document.getElementById("waterTargetLitersDisplay");
        if (targetDisp) targetDisp.innerText = `${data.targetWater} L`;

        const desc = document.getElementById("waterFormulaDesc");
        if (desc) desc.innerText = `Hôm nay bạn đã vận động ${data.workoutMinutes || 0} phút. Hệ thống tự động điều chỉnh mục tiêu nước lên ${data.targetWater} L theo khuyến nghị WHO.`;

        const badge = document.getElementById("waterLogCountBadge");
        const listContainer = document.getElementById("waterLogList");
        if (badge) badge.innerText = `${data.logs ? data.logs.length : 0} lần`;

        if (listContainer) {
            if (!data.logs || data.logs.length === 0) {
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/water-logs?userId=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ amountMl: amountMl, waterType: waterType })
        });

        if (res.ok) {
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            showNotification(`💧 ${data.message || 'Đã thêm nước'} (+${data.hydrationMl || amountMl}ml)`);
            loadWaterSummary();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi ghi nhận nước!");
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    if (!confirm("Bạn có chắc muốn xóa lần uống nước này?")) return;
    try {
        const res = await fetch(`/api/lifestyle/water-logs/${id}?userId=${uid}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            showNotification("🗑️ Đã xóa lần uống nước!");
            loadWaterSummary();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi khi xóa!");
    }
}

// ==========================================
// 4. GIẤC NGỦ & CHU KỲ 90 PHÚT (AASM)
// ==========================================
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
            <div style="background:#fff; border:1px solid var(--border); border-top: 4px solid ${c >= 5 ? 'var(--primary)' : c === 4 ? 'var(--warning)' : '#ef4444'}; border-radius:10px; padding:15px; text-align:center; flex:1; min-width:130px;">
                <div style="font-size:1.3rem; font-weight:800; color:#4c1d95;">${timeString}</div>
                <div style="font-size:0.85rem; font-weight:700; color:var(--dark); margin:4px 0;">${c} chu kỳ (${sleepHours}h)</div>
                <small style="color:var(--gray); font-size:0.75rem;">${c >= 5 ? 'Khuyên dùng ⭐' : c === 4 ? 'Vừa đủ' : 'Hơi ít'}</small>
            </div>
        `;
    }).join("");
}

async function handleSaveSleepLog() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const bedVal = document.getElementById("inputSleepBed")?.value;
    const wakeVal = document.getElementById("inputSleepWake")?.value;
    const rating = document.getElementById("inputSleepRating")?.value || "Normal";

    if (!bedVal || !wakeVal) return alert("Vui lòng nhập đủ giờ ngủ và thức dậy!");

    const todayStr = new Date().toISOString().split("T")[0];
    const bedTime = `${todayStr}T${bedVal}:00`;
    const wakeTime = `${todayStr}T${wakeVal}:00`;

    try {
        const res = await fetch(`/api/lifestyle/sleep-logs?userId=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ bedTime, wakeTime, qualityRating: rating })
        });

        if (res.ok) {
            const text = await res.text();
            const result = text ? JSON.parse(text) : {};
            showNotification(`🌙 ${result.message || 'Đã lưu giấc ngủ'} (${result.durationHours || 0}h - Điểm: ${result.sleepScore || 0})`);
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
    const token = getToken();
    if (!token) return applyGuestMode();

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/sleep-today?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const badge = document.getElementById("sleepScoreBadge");
        const resultBox = document.getElementById("sleepDetailResult");

        if (!res.ok) {
            if (badge) badge.innerText = "-- Điểm";
            if (resultBox) resultBox.innerHTML = '<p style="color:var(--gray); font-size:0.95rem;">Chưa có dữ liệu giấc ngủ hôm nay.</p>';
            return;
        }

        const text = await res.text();
        if (!text || text.trim() === "" || text === "null") {
            if (badge) badge.innerText = "-- Điểm";
            if (resultBox) resultBox.innerHTML = '<p style="color:var(--gray); font-size:0.95rem;">Chưa có dữ liệu giấc ngủ hôm nay.</p>';
            return;
        }

        const data = JSON.parse(text);

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
                            <strong style="color:${data.qualityRating === 'Energetic' ? 'var(--primary)' : '#0284c7'};">
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
        console.error("Lỗi nạp Sleep:", err);
    }
}

// ==========================================
// 5. THỰC ĐƠN KHO MÓN & MÔ HÌNH HỌC MÁY KNN
// ==========================================
async function handleSpinFood() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const type = document.getElementById("wheelMealType")?.value || "Lunch";
    const resCard = document.getElementById("spinResultCard");
    const nameEl = document.getElementById("spinFoodName");
    const metaEl = document.getElementById("spinFoodMeta");
    const tagEl = document.getElementById("spinFoodTag");

    if (resCard) resCard.style.display = "block";
    if (nameEl) nameEl.innerText = "🤖 AI Đang tính toán Vector Dinh dưỡng...";
    if (metaEl) metaEl.innerText = "Đo khoảng cách bù đắp Calo & Macro từ Viện Dinh Dưỡng...";
    if (tagEl) tagEl.innerText = "";

    try {
        const res = await fetch(`/api/lifestyle/ai-knn-recommend?userId=${uid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mealType: type })
        });
        const data = await res.json();
        const topMeal = data.recommendations[0];
        currentSpunMeal = topMeal;

        setTimeout(() => {
            if (nameEl) nameEl.innerText = `${topMeal.mealName} (Độ khớp AI: ${topMeal.matchScore}%)`;
            if (metaEl) metaEl.innerText = `🔥 ${topMeal.calories} kcal • ${Number(topMeal.price).toLocaleString()} đ [🥩 ${topMeal.protein}g Đạm | 🍞 ${topMeal.carbs}g Carbs]`;
            if (tagEl) tagEl.innerText = `💡 ${topMeal.benefitReason}`;

            const btnApply = document.getElementById("btnApplySpinFood");
            if (btnApply) btnApply.onclick = () => applyMealToToday(topMeal.mealId, type);
        }, 350);
    } catch {
        try {
            const fRes = await fetch(`/api/lifestyle/random-meal?mealType=${type}`);
            const meal = await fRes.json();
            if (nameEl) nameEl.innerText = meal.mealName;
            if (metaEl) metaEl.innerText = `🔥 ${meal.calories} kcal • ${Number(meal.price).toLocaleString()} đ`;
            const btnApply = document.getElementById("btnApplySpinFood");
            if (btnApply) btnApply.onclick = () => applyMealToToday(meal.mealId, type);
        } catch {
            if (nameEl) nameEl.innerText = "Chưa có món ăn trong kho!";
        }
    }
}

async function applyMealToToday(mealId, mealType) {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/apply-today-meal?userId=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ mealId: mealId, mealType: mealType })
        });

        if (res.ok) {
            const text = await res.text();
            const result = text ? JSON.parse(text) : {};
            showNotification(`✅ Đã áp dụng ${result.meal ? result.meal.mealName : 'món ăn'}!`);
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
        const text = await res.text();
        const list = text ? JSON.parse(text) : [];
        if (badge) badge.innerText = `${list.length} món ăn`;

        grid.innerHTML = list.map(m => `
            <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                <div>
                    <div style="font-weight:700; font-size:1.05rem; color:var(--dark); margin-bottom:4px;">${m.mealName}</div>
                    <div style="font-size:0.85rem; color:var(--gray); margin-bottom:8px;">
                        Phù hợp: <strong>${m.mealType === 'Breakfast' ? 'Bữa sáng' : m.mealType === 'Lunch' ? 'Bữa trưa' : 'Bữa tối'}</strong>
                    </div>
                    <div style="font-size:0.9rem; color:var(--warning); font-weight:700;">🔥 ${m.calories} kcal • ${Number(m.price).toLocaleString()} đ</div>
                </div>
                <button class="btn" style="background:var(--primary-light); color:var(--primary-dark); font-size:0.85rem; margin-top:12px;" onclick="applyMealToToday(${m.mealId}, '${m.mealType}')">
                    Chọn cho hôm nay
                </button>
            </div>
        `).join("");
    } catch {
        grid.innerHTML = "<p>Lỗi tải danh sách món ăn!</p>";
    }
}

// ==========================================
// 6. HOẠT ĐỘNG THỂ CHẤT & ĐẾM GIỜ WORKOUT
// ==========================================
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/log-activity?userId=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ activityType: type, durationSeconds: durationSeconds })
        });

        if (res.ok) {
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            showNotification(`✅ Đã lưu: ${formatDuration(durationSeconds)} (+${data.stepsAdded || 0} bước, ~${data.caloriesBurned || 0} kcal)`);
            loadTodayActivities();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi kết nối cơ sở dữ liệu!");
    }
}

async function loadTodayActivities() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    const container = document.getElementById("todayActivityList");
    const badge = document.getElementById("activityCountBadge");
    if (!container) return;

    try {
        const res = await fetch(`/api/lifestyle/today-activities?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const text = await res.text();
        const list = text ? JSON.parse(text) : [];
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
                    <span style="font-weight:700; color:var(--primary-dark);">
                        +${(a.stepsEquivalent || 0).toLocaleString()} bước (~${a.caloriesBurned || 0} kcal)
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    if (!confirm("Bạn có chắc muốn xóa buổi tập này?")) return;
    try {
        const res = await fetch(`/api/lifestyle/activities/${id}?userId=${uid}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    if (!confirm("Bạn có chắc muốn reset toàn bộ hoạt động hôm nay về 0 bước?")) return;
    try {
        const res = await fetch(`/api/lifestyle/reset-today-activities?userId=${uid}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            showNotification("🔄 Đã reset hoạt động hôm nay về 0!");
            loadTodayActivities();
            loadDashboardData();
        }
    } catch {
        alert("Lỗi kết nối cơ sở dữ liệu!");
    }
}

// ==========================================
// 7. LỊCH TRÌNH TIMELINE & AI SCHEDULER
// ==========================================
async function loadOverviewTimelines() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    const container = document.getElementById("overviewTimelineList");
    if (!container) return;
    try {
        const res = await fetch(`/api/lifestyle/timelines?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const text = await res.text();
        const list = text ? JSON.parse(text) : [];
        if (!list || list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Chưa có lịch trình nào.</p>';
            return;
        }
        container.innerHTML = list.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:var(--light-gray); border-radius:10px; margin-bottom:10px; border-left:4px solid ${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--primary)' : 'var(--accent)'}; border:1px solid #e2e8f0;">
                <div>
                    <strong style="font-size:0.85rem; color:var(--dark); margin-right:8px;">${item.timeSlot}</strong>
                    <span style="font-size:0.9rem; text-decoration:${item.isCompleted ? 'line-through' : 'none'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--dark)'};">${item.title}</span>
                </div>
                <span class="badge ${item.isCompleted ? '' : 'badge-blue'}" style="background:${item.isCompleted ? '#e1e8ed' : 'var(--primary-light)'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--primary-dark)'};">
                    ${item.isCompleted ? 'Đã xong ✓' : 'Sắp tới'}
                </span>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red;">Lỗi kết nối CSDL.</p>';
    }
}

async function loadManageTimelines() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    const container = document.getElementById("manageTimelineList");
    const countBadge = document.getElementById("timelineCountBadge");
    if (!container) return;
    try {
        const res = await fetch(`/api/lifestyle/timelines?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const text = await res.text();
        const list = text ? JSON.parse(text) : [];
        if (countBadge) countBadge.textContent = `${list.length} công việc`;

        if (!list || list.length === 0) {
            container.innerHTML = '<p style="color:var(--gray); font-size:0.9rem;">Chưa có mốc lịch trình nào.</p>';
            return;
        }
        container.innerHTML = list.map(item => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#fff; border:1px solid var(--border); border-radius:10px; box-shadow:var(--glass-shadow); border-left:5px solid ${item.category === 'Meal' ? 'var(--warning)' : item.category === 'Rest' ? 'var(--primary)' : 'var(--accent)'};">
                <div style="flex:1;">
                    <div style="font-weight:700; color:var(--dark); font-size:0.95rem;">⏰ ${item.timeSlot}</div>
                    <div style="font-size:0.95rem; text-decoration:${item.isCompleted ? 'line-through' : 'none'}; color:${item.isCompleted ? 'var(--gray)' : 'var(--dark)'};">${item.title}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn" style="background:${item.isCompleted ? '#e1e8ed' : 'var(--primary)'}; color:${item.isCompleted ? 'var(--gray)' : '#fff'}; font-size:0.8rem;" onclick="handleToggleStatus(${item.timelineId})">${item.isCompleted ? 'Hoàn tác' : 'Xong ✓'}</button>
                    <button class="btn" style="background:#fee2e2; color:#ef4444; font-size:0.8rem;" onclick="handleDeleteTimeline(${item.timelineId})">🗑️ Xóa</button>
                </div>
            </div>
        `).join("");
    } catch {
        container.innerHTML = '<p style="color:red;">Lỗi CSDL.</p>';
    }
}

async function generateSmartSchedule(archetype) {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/generate-schedule?userId=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ archetype: archetype })
        });
        if (res.ok) {
            showNotification("⚡ AI đã tự động thiết lập thời gian biểu khoa học cho bạn!");
            loadManageTimelines();
            loadOverviewTimelines();
        }
    } catch {
        alert("Lỗi khi tạo lịch trình tự động!");
    }
}

async function handleCreateTimeline() {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const timeSlot = document.getElementById("inputTimeSlot")?.value.trim();
    const title = document.getElementById("inputTitle")?.value.trim();
    const category = document.getElementById("inputCategory")?.value || "Task";
    if (!timeSlot || !title) return alert("Vui lòng nhập đủ thông tin!");

    const res = await fetch(`/api/lifestyle/timelines?userId=${uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    await fetch(`/api/lifestyle/timelines/${id}/toggle?userId=${uid}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
    });
    loadManageTimelines();
}

async function handleDeleteTimeline(id) {
    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    if (!confirm("Xác nhận xóa?")) return;
    await fetch(`/api/lifestyle/timelines/${id}?userId=${uid}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    showNotification("🗑️ Đã xóa mốc thời gian!");
    loadManageTimelines();
}

// ==========================================
// 8. PHÂN HỆ THỐNG KÊ LỊCH SỬ N NGÀY TỰ CHỌN
// ==========================================
function ensureStatisticsCustomUI() {
    const statView = document.getElementById('view-statistics');
    if (!statView) return;

    if (document.getElementById('inputCustomDays')) return;

    statView.innerHTML = `
        <div class="section" style="margin-bottom: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 14px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h2 style="color: #166534; font-size: 1.3rem; margin-bottom: 4px;">📈 Tra cứu Lịch sử & Khai phá Dữ liệu Lối sống</h2>
                    <p style="color: #15803d; font-size: 0.9rem; margin: 0;" id="statInsightBox">
                        Nhập số ngày bạn muốn xem lại để đối chiếu sự thay đổi với hôm nay.
                    </p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; background: #fff; padding: 6px 12px; border-radius: 10px; border: 1.5px solid #86efac; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                        <span style="font-size: 0.88rem; font-weight: 700; color: #166534; margin-right: 6px;">Xem lại</span>
                        <input type="number" id="inputCustomDays" min="1" max="365" value="7" style="width: 65px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; text-align: center; outline: none; font-size: 1rem;" />
                        <span style="font-size: 0.88rem; font-weight: 700; color: #166534; margin: 0 8px 0 6px;">ngày trước</span>
                        <button class="btn btn-primary" style="padding: 6px 16px; font-size: 0.88rem; background: #16a34a; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;" onclick="handleCustomDaysSearch()">Xem ngay</button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn" style="background: #fff; border: 1px solid #86efac; color: #166534; padding: 7px 12px; font-size: 0.82rem; border-radius: 8px; font-weight: 700; cursor: pointer;" onclick="setAndLoadDays(7)">7 ngày</button>
                        <button class="btn" style="background: #fff; border: 1px solid #86efac; color: #166534; padding: 7px 12px; font-size: 0.82rem; border-radius: 8px; font-weight: 700; cursor: pointer;" onclick="setAndLoadDays(14)">14 ngày</button>
                        <button class="btn" style="background: #fff; border: 1px solid #86efac; color: #166534; padding: 7px 12px; font-size: 0.82rem; border-radius: 8px; font-weight: 700; cursor: pointer;" onclick="setAndLoadDays(30)">30 ngày</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="statComparisonCard" class="card" style="margin-bottom: 20px; border-left: 5px solid #0284c7; background: linear-gradient(135deg, #fff 0%, #f0f9ff 100%); padding: 18px 22px; border-radius: 12px; border: 1px solid #bae6fd;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <span class="badge" style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 4px; display: inline-block;">ĐỐI CHIẾU TIẾN TRÌNH</span>
                    <h3 style="color: #0369a1; font-size: 1.15rem; margin: 4px 0;" id="statCompareHeader">So sánh tiến trình: 7 ngày trước với Hôm nay</h3>
                    <p id="statCompareDetails" style="font-size: 0.95rem; color: #0f172a; margin: 0; font-weight: 600;"></p>
                </div>
                <div id="statRangeDatesBadge" style="font-weight: 700; color: #64748b; font-size: 0.9rem;"></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 22px;">
            <div class="card" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Tổng Calo Đã Đốt</div>
                <div id="statTotalBurned" style="font-size: 1.8rem; font-weight: 800; color: #ef4444; margin-top: 4px;">0 kcal</div>
                <small style="color: #64748b;">Trong chu kỳ đã chọn</small>
            </div>
            <div class="card" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Calo Nạp Trung Bình</div>
                <div id="statAvgCaloIn" style="font-size: 1.8rem; font-weight: 800; color: #f59e0b; margin-top: 4px;">0 kcal/ngày</div>
                <small style="color: #64748b;">Mức nạp trung bình mỗi ngày</small>
            </div>
            <div class="card" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Nước Uống Trung Bình</div>
                <div id="statAvgWater" style="font-size: 1.8rem; font-weight: 800; color: #0284c7; margin-top: 4px;">0.0 L/ngày</div>
                <small style="color: #64748b;">Độ bù ẩm cơ thể</small>
            </div>
            <div class="card" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Tổng Số Bước Chân</div>
                <div id="statTotalSteps" style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 4px;">0 bước</div>
                <small style="color: #64748b;">Quãng đường vận động tích lũy</small>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <div class="section" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div class="section-title" style="margin-bottom: 14px;">
                    <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">🔥 Cân bằng Năng lượng (Nạp vs Đốt)</h2>
                </div>
                <div style="position: relative; height: 280px; width: 100%;">
                    <canvas id="caloChart"></canvas>
                </div>
            </div>
            <div class="section" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div class="section-title" style="margin-bottom: 14px;">
                    <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">💧 Lượng Nước & Vận Động</h2>
                </div>
                <div style="position: relative; height: 280px; width: 100%;">
                    <canvas id="waterStepsChart"></canvas>
                </div>
            </div>
        </div>

        <div class="section" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div class="section-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">📜 Bảng Tra Cứu Toàn Bộ Lịch Sử</h2>
                <span class="badge" style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 6px; font-weight: 700;" id="statHistoryRowCount">0 ngày</span>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.92rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
                            <th style="padding: 12px 14px;">Ngày</th>
                            <th style="padding: 12px 14px;">Calo Nạp</th>
                            <th style="padding: 12px 14px;">Calo Đốt</th>
                            <th style="padding: 12px 14px;">Cân Bằng Calo</th>
                            <th style="padding: 12px 14px;">Nước Uống</th>
                        </tr>
                    </thead>
                    <tbody id="statHistoryTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

function setAndLoadDays(num) {
    const input = document.getElementById('inputCustomDays');
    if (input) input.value = num;
    loadStatistics(num);
}

function handleCustomDaysSearch() {
    const input = document.getElementById('inputCustomDays');
    let days = parseInt(input ? input.value : 7);
    if (isNaN(days) || days < 1) {
        alert("Vui lòng nhập số ngày hợp lệ (từ 1 ngày trở lên)!");
        days = 7;
        if (input) input.value = 7;
    }
    loadStatistics(days);
}

async function loadStatistics(days = 7) {
    const token = getToken();
    if (!token) return applyGuestMode();

    const uid = getCurrentUserId();
    currentStatDays = days;
    ensureStatisticsCustomUI();

    try {
        const res = await fetch(`/api/lifestyle/statistics?userId=${uid}&days=${days}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const text = await res.text();
        if (!text || text.trim() === "") return;
        const data = JSON.parse(text);

        const insightBox = document.getElementById('statInsightBox');
        if (insightBox) insightBox.innerText = '💡 ' + (data.insight || `Đã phân tích toàn diện chu kỳ ${days} ngày qua.`);

        const compareHeader = document.getElementById('statCompareHeader');
        if (compareHeader) compareHeader.innerText = `So sánh tiến trình: ${days} ngày trước với Hôm nay`;

        const compareDetails = document.getElementById('statCompareDetails');
        if (compareDetails) compareDetails.innerText = data.insight || `Chu kỳ đối soát ${days} ngày hoạt động.`;

        const rangeBadge = document.getElementById('statRangeDatesBadge');
        if (rangeBadge) rangeBadge.innerText = `Từ ${data.startDate || '...'} đến ${data.endDate || 'Hôm nay'}`;

        const labels = data.labels || [];
        const caloIn = data.caloriesIn || [];
        const caloBurned = data.caloriesBurned || [];
        const water = data.water || [];

        const totalBurn = caloBurned.reduce((a, b) => a + b, 0);
        const sumCaloIn = caloIn.reduce((a, b) => a + b, 0);
        const avgCaloIn = labels.length > 0 ? Math.round(sumCaloIn / labels.length) : 0;
        const sumWater = water.reduce((a, b) => a + b, 0);
        const avgWater = labels.length > 0 ? (sumWater / labels.length).toFixed(1) : 0;

        if (document.getElementById('statTotalBurned')) document.getElementById('statTotalBurned').innerText = `${totalBurn.toLocaleString()} kcal`;
        if (document.getElementById('statAvgCaloIn')) document.getElementById('statAvgCaloIn').innerText = `${avgCaloIn.toLocaleString()} kcal/ngày`;
        if (document.getElementById('statAvgWater')) document.getElementById('statAvgWater').innerText = `${avgWater} L/ngày`;

        const chartCaloEl = document.getElementById('caloChart');
        if (chartCaloEl && typeof Chart !== 'undefined') {
            const ctxCalo = chartCaloEl.getContext('2d');
            if (chartCaloInstance) chartCaloInstance.destroy();

            chartCaloInstance = new Chart(ctxCalo, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Calo nạp (kcal)', data: caloIn, backgroundColor: '#f59e0b', borderRadius: 4 },
                        { label: 'Calo đốt (kcal)', data: caloBurned, backgroundColor: '#ef4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        const chartWaterEl = document.getElementById('waterStepsChart');
        if (chartWaterEl && typeof Chart !== 'undefined') {
            const ctxWater = chartWaterEl.getContext('2d');
            if (chartWaterInstance) chartWaterInstance.destroy();

            chartWaterInstance = new Chart(ctxWater, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Nước uống (Lít)',
                        data: water,
                        borderColor: '#0284c7',
                        backgroundColor: 'rgba(2, 132, 199, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        const tableBody = document.getElementById('statHistoryTableBody');
        const countBadge = document.getElementById('statHistoryRowCount');
        if (countBadge) countBadge.innerText = `${labels.length} ngày ghi nhận`;

        if (tableBody) {
            tableBody.innerHTML = labels.map((date, idx) => {
                const cIn = caloIn[idx] || 0;
                const cOut = caloBurned[idx] || 0;
                const net = cIn - cOut;
                const w = water[idx] || 0;
                const isDeficit = net <= 0;

                return `
                    <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding:12px 14px; font-weight:700; color:var(--dark);">${date}</td>
                        <td style="padding:12px 14px; color:#d97706; font-weight:600;">${cIn.toLocaleString()} kcal</td>
                        <td style="padding:12px 14px; color:#dc2626; font-weight:600;">${cOut.toLocaleString()} kcal</td>
                        <td style="padding:12px 14px;">
                            <span class="badge" style="background:${isDeficit ? '#dcfce7' : '#e0f2fe'}; color:${isDeficit ? '#166534' : '#0369a1'}; padding:3px 8px; border-radius:5px; font-weight:700;">
                                ${isDeficit ? `Thâm hụt ${Math.abs(net)} kcal` : `Dư thừa +${net} kcal`}
                            </span>
                        </td>
                        <td style="padding:12px 14px; color:#0284c7; font-weight:700;">${w} L</td>
                    </tr>
                `;
            }).reverse().join('');
        }
    } catch (e) {
        console.error("Lỗi vẽ biểu đồ Thống kê:", e);
    }
}

// ==========================================
// 9. THÔNG BÁO & KHỞI CHẠY HỆ THỐNG
// ==========================================
function showNotification(message) {
    let notification = document.getElementById("toastBox");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "toastBox";
        notification.className = "notification";
        document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.opacity = "1";
    clearTimeout(notification.timer);
    notification.timer = setTimeout(() => {
        notification.style.opacity = "0";
    }, 2400);
}

function formatDuration(totalSeconds) {
    if (totalSeconds < 60) return `${totalSeconds} giây`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (secs === 0) return `${mins} phút`;
    return `${mins} phút ${secs} giây`;
}

document.addEventListener("DOMContentLoaded", async function () {
    await checkAuthStatus();
    loadOverviewTimelines();
    switchEtmTab('landing');
    calculateBedtimes();
});

// ==========================================
// 10. ĐIỀU KHIỂN CHATBOT AI (FLOATING WIDGET)
// ==========================================
function toggleChatWindow() {
    const chatWin = document.getElementById("chatWindow");
    if (!chatWin) return;
    const isHidden = chatWin.style.display === "none" || chatWin.style.display === "";
    chatWin.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
        document.getElementById("chatInput")?.focus();
        loadChatHistory();
    }
}

function handleChatEnter(e) {
    if (e.key === "Enter") {
        sendChatMessage();
    }
}

async function loadChatHistory() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/chat/history?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;
        const list = await res.json();
        const chatBody = document.getElementById("chatBody");
        if (!chatBody || list.length === 0) return;

        chatBody.innerHTML = list.map(c => `
            <div class="chat-msg ${c.sender === 'User' ? 'chat-msg-user' : 'chat-msg-ai'}">
                ${c.messageText}
                <div style="font-size:0.65rem; opacity:0.6; text-align:${c.sender === 'User' ? 'right' : 'left'}; margin-top:4px;">${c.time || ''}</div>
            </div>
        `).join("");
        chatBody.scrollTop = chatBody.scrollHeight;
    } catch (err) {
        console.error("Lỗi tải lịch sử chat:", err);
    }
}

async function sendChatMessage() {
    const input = document.getElementById("chatInput");
    const msgText = input ? input.value.trim() : "";
    if (!msgText) return;

    const token = getToken();
    if (!token) return openAuthModal('login');

    const uid = getCurrentUserId();
    const chatBody = document.getElementById("chatBody");
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (chatBody) {
        chatBody.innerHTML += `
            <div class="chat-msg chat-msg-user">
                ${msgText}
                <div style="font-size:0.65rem; opacity:0.6; text-align:right; margin-top:4px;">${nowTime}</div>
            </div>
        `;
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    input.value = "";

    const loadingId = "loadingMsg_" + Date.now();
    if (chatBody) {
        chatBody.innerHTML += `
            <div class="chat-msg chat-msg-ai" id="${loadingId}">
                <em>🤖 AI đang đối chiếu dữ liệu sinh trắc học & calo...</em>
            </div>
        `;
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    try {
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };

        const res = await fetch("/api/chat/ask", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ userId: uid, message: msgText })
        });

        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (res.ok) {
            const data = await res.json();
            if (chatBody) {
                chatBody.innerHTML += `
                    <div class="chat-msg chat-msg-ai">
                        ${data.reply}
                        <div style="font-size:0.65rem; opacity:0.6; margin-top:4px;">${data.time || nowTime}</div>
                    </div>
                `;
                chatBody.scrollTop = chatBody.scrollHeight;
            }
        } else {
            const err = await res.text();
            alert("Lỗi từ AI: " + err);
        }
    } catch {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        alert("Lỗi kết nối máy chủ chat!");
    }
}
// ==========================================
// 11. TÍCH HỢP HỌC MÁY (MACHINE LEARNING INSIGHTS)
// ==========================================
async function loadMachineLearningPrediction() {
    const token = getToken();
    if (!token) return;

    const uid = getCurrentUserId();
    try {
        const res = await fetch(`/api/lifestyle/run-ml-prediction?userId=${uid}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const insightBox = document.getElementById('statInsightBox');
            if (insightBox) {
                insightBox.innerHTML = `🤖 <strong>[Mô hình Học máy ML.NET]:</strong> ${data.aiEvaluation} (Biến thiên dự kiến: <b>${data.predictedWeightChangeNext30Days} kg</b> qua ${data.trainedSamplesCount} mẫu huấn luyện).`;
            }
        }
    } catch (err) {
        console.error("Lỗi gọi mô hình học máy:", err);
    }
}