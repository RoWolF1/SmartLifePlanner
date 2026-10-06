using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartLifePlanner.Models;

namespace SmartLifePlanner.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LifestyleController : ControllerBase
    {
        private readonly LifeSmartDbContext _context;

        public LifestyleController(LifeSmartDbContext context)
        {
            _context = context;
        }

        // 1. LẤY CHỈ SỐ DASHBOARD CHO SẢNH TỔNG QUAN
        [HttpGet("dashboard-data")]
        public async Task<IActionResult> GetDashboardData([FromQuery] int userId = 1)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            // Tính BMI động: Cân nặng / (Chiều cao/100)^2
            double heightM = user.Height / 100.0;
            double bmi = Math.Round(user.Weight / (heightM * heightM), 1);

            return Ok(new
            {
                fullName = user.FullName,
                bmi = bmi,
                caloriesConsumed = tracking?.CaloriesConsumed ?? 0,
                targetCalories = user.TargetCalories,
                waterConsumed = tracking?.WaterConsumed ?? 0.0,
                targetWater = user.TargetWater,
                stepsCount = tracking?.StepsCount ?? 0
            });
        }

        // 2. RANDOM MÓN ĂN TỪ BẢNG MEALS TRONG SQL SERVER
        [HttpGet("random-meal")]
        public async Task<IActionResult> GetRandomMeal([FromQuery] string mealType = "Lunch")
        {
            var meals = await _context.Meals
                .Where(m => m.IsActive && m.MealType.ToLower() == mealType.ToLower())
                .ToListAsync();

            if (!meals.Any())
            {
                meals = await _context.Meals.Where(m => m.IsActive).ToListAsync();
            }

            if (!meals.Any()) return NotFound("Chưa có món ăn trong cơ sở dữ liệu.");

            var random = new Random();
            var selected = meals[random.Next(meals.Count)];

            return Ok(new
            {
                id = selected.MealId,
                name = selected.MealName,
                calories = selected.Calories,
                price = selected.Price,
                tag = selected.Tag
            });
        }

        // 3. THÊM NƯỚC UỐNG
        [HttpPost("add-water")]
        public async Task<IActionResult> AddWater([FromQuery] int userId = 1, [FromQuery] double amount = 0.25)
        {
            var today = DateTime.Today;
            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking == null)
            {
                tracking = new DailyTracking
                {
                    UserId = userId,
                    TrackingDate = today,
                    WaterConsumed = amount
                };
                _context.DailyTrackings.Add(tracking);
            }
            else
            {
                tracking.WaterConsumed = Math.Round(tracking.WaterConsumed + amount, 2);
            }

            await _context.SaveChangesAsync();
            return Ok(new { currentWater = tracking.WaterConsumed });
        }

        // ==========================================
        // CÁC API CRUD LỊCH TRÌNH (TIMELINE)
        // ==========================================

        // Lấy danh sách lịch trình hôm nay
        [HttpGet("timelines")]
        public async Task<IActionResult> GetTimelines([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var list = await _context.Timelines
                .Where(t => t.UserId == userId && t.PlanDate == today)
                .OrderBy(t => t.TimelineId)
                .ToListAsync();

            return Ok(list);
        }

        // Thêm mốc giờ mới
        [HttpPost("timelines")]
        public async Task<IActionResult> AddTimeline([FromBody] Timeline model)
        {
            if (string.IsNullOrWhiteSpace(model.TimeSlot) || string.IsNullOrWhiteSpace(model.Title))
                return BadRequest("Vui lòng nhập khung giờ và nội dung.");

            model.UserId = 1;
            model.PlanDate = DateTime.Today;
            model.IsCompleted = false;

            _context.Timelines.Add(model);
            await _context.SaveChangesAsync();
            return Ok(model);
        }

        // Cập nhật khung giờ hoặc nội dung
        [HttpPut("timelines/{id}")]
        public async Task<IActionResult> UpdateTimeline(int id, [FromBody] Timeline updateData)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound("Không tìm thấy lịch trình.");

            item.TimeSlot = updateData.TimeSlot;
            item.Title = updateData.Title;
            item.Category = updateData.Category;

            await _context.SaveChangesAsync();
            return Ok(item);
        }

        // Đổi trạng thái Hoàn thành / Chưa xong
        [HttpPatch("timelines/{id}/toggle")]
        public async Task<IActionResult> ToggleTimeline(int id)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound("Không tìm thấy lịch trình.");

            item.IsCompleted = !item.IsCompleted;
            await _context.SaveChangesAsync();
            return Ok(new { item.TimelineId, item.IsCompleted });
        }

        // Xóa mốc lịch trình
        [HttpDelete("timelines/{id}")]
        public async Task<IActionResult> DeleteTimeline(int id)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound("Không tìm thấy lịch trình.");

            _context.Timelines.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa thành công." });
        }
    }
}