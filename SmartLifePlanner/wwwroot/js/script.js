// LifeSmart - JavaScript Logic
let waterAmount = 1.8;
const waterGoal = 2.5;

// ================================
// HÀM GỌI API C# RANDOM MÓN ĂN
// ================================
async function getRandomMealFromBackend(mealType) {
    try {
        const response = await fetch(`/api/lifestyle/random-meal?mealType=${mealType}`);
        if (!response.ok) throw new Error("Lỗi khi tải dữ liệu từ máy chủ C#");

        const data = await response.json();
        showNotification(`🎲 Món ăn C# gợi ý: ${data.name} (~${data.calories} kcal)`);

        // Tự động gán vào giao diện nếu có phần tử tương ứng
        if (mealType === "Breakfast") {
            const el = document.getElementById("meal-breakfast-name");
            if (el) el.innerText = `Bữa sáng - ${data.name}`;
        } else if (mealType === "Lunch") {
            const el = document.getElementById("meal-lunch-name");
            if (el) el.innerText = `Bữa trưa - ${data.name}`;
        } else if (mealType === "Dinner") {
            const el = document.getElementById("meal-dinner-name");
            if (el) el.innerText = `Bữa tối - ${data.name}`;
        }
    } catch (err) {
        console.error("Lỗi:", err);
    }
}

// ================================
// HIỂN THỊ THÔNG BÁO (TOAST)
// ================================
function showNotification(message) {
    let notification = document.querySelector(".notification");

    if (!notification) {
        notification = document.createElement("div");
        notification.className = "notification";

        Object.assign(notification.style, {
            position: "fixed",
            top: "25px",
            right: "25px",
            background: "#20a36a",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            zIndex: "9999",
            transition: "opacity 0.3s ease"
        });

        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.opacity = "1";

    clearTimeout(notification.timer);

    notification.timer = setTimeout(() => {
        notification.style.opacity = "0";
    }, 2200);
}

// ================================
// THEO DÕI NƯỚC
// ================================
function updateWater() {
    const value = document.querySelector(".water-value");
    const progress = document.querySelector(".water-progress");

    if (value) {
        value.textContent = waterAmount.toFixed(1) + " L";
    }

    if (progress) {
        const percent = Math.min((waterAmount / waterGoal) * 100, 100);
        progress.style.width = percent + "%";
    }

    // Cập nhật trạng thái các ly nước
    document.querySelectorAll(".water-glass").forEach((glass, index) => {
        const glassAmount = (index + 1) * 0.25;
        if (waterAmount >= glassAmount) {
            glass.classList.add("active");
        } else {
            glass.classList.remove("active");
        }
    });
}

// ================================
// THÊM NƯỚC
// ================================
function addWater() {
    if (waterAmount < waterGoal) {
        waterAmount += 0.25;
        if (waterAmount > waterGoal) {
            waterAmount = waterGoal;
        }
        updateWater();
        showNotification("💧 Đã thêm 250ml nước!");
    } else {
        showNotification("✅ Bạn đã đạt mục tiêu nước hôm nay!");
    }
}

// ================================
// GỢI Ý THỰC ĐƠN NHANH
// ================================
function showMenuRecommendation() {
    const meals = [
        "Ức gà + cơm + rau xanh — 520 kcal",
        "Cá hồi + khoai lang + salad — 480 kcal",
        "Thịt bò + cơm gạo lứt + rau — 550 kcal"
    ];

    const randomIndex = Math.floor(Math.random() * meals.length);
    showNotification("🍱 Gợi ý: " + meals[randomIndex]);
}

// ================================
// TÍNH BMI
// ================================
function calculateBMI(weight, height) {
    const heightMeter = height / 100;
    const bmi = weight / (heightMeter * heightMeter);
    return bmi.toFixed(1);
}

// ================================
// KHI TRANG ĐƯỢC NẠP (DOM READY)
// ================================
document.addEventListener("DOMContentLoaded", function () {
    // 1. Cập nhật thanh tiến trình nước ban đầu
    updateWater();

    // 2. Gán sự kiện nút thêm nước
    const waterButton = document.querySelector(".water-add-btn");
    if (waterButton) {
        waterButton.addEventListener("click", addWater);
    }

    // 3. Gán sự kiện nút gợi ý thực đơn
    const menuButton = document.querySelector(".menu-recommend-btn");
    if (menuButton) {
        menuButton.addEventListener("click", showMenuRecommendation);
    }

    // 4. Sự kiện click chọn thẻ món ăn
    document.querySelectorAll(".meal-card").forEach(card => {
        card.addEventListener("click", function () {
            card.classList.toggle("selected");
            if (card.classList.contains("selected")) {
                showNotification("🍽️ Đã chọn món ăn này!");
            }
        });
    });

    // 5. Menu bên trái
    document.querySelectorAll(".menu a").forEach(link => {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            document.querySelectorAll(".menu a").forEach(item => {
                item.classList.remove("active");
            });
            this.classList.add("active");

            const text = this.querySelector("span:last-child");
            if (text) {
                showNotification("Đã chọn: " + text.textContent);
            }
        });
    });

    console.log("LifeSmart đang chạy!");
    console.log("BMI mẫu:", calculateBMI(66, 170));
});