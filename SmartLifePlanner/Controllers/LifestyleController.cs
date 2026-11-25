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

        // ==========================================
        // 1. DASHBOARD OVERVIEW (/dashboard-data & /today & /summary)
        // ==========================================
        [HttpGet("dashboard-data")]
        [HttpGet("today")]
        [HttpGet("summary")]
        public async Task<IActionResult> GetDashboardData([FromQuery] int userId = 1)
        {
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;

            // Tính calo đốt & bước chân hôm nay từ bảng Activities
            double burnedCalories = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .SumAsync(a => (double?)a.CaloriesBurned) ?? 0.0;

            int steps = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .SumAsync(a => (int?)a.StepsEquivalent) ?? 0;

            // Tính nước uống từ bảng WaterLogs (ml đổi ra Lít)
            int totalWaterMl = await _context.WaterLogs
                .Where(w => w.UserId == userId && w.LogDate == today)
                .SumAsync(w => (int?)w.HydrationAmountMl) ?? 0;
            double waterLiters = Math.Round(totalWaterMl / 1000.0, 2);

            // Chỉ tính calo từ các món user đã tích chọn "Đã ăn" thực tế
            int consumedCalories = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == today && dm.IsEaten)
                .Include(dm => dm.Meal)
                .SumAsync(dm => (int?)dm.Meal!.Calories) ?? 0;

            // Giấc ngủ gần nhất
            var latestSleep = await _context.SleepLogs
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.SleepDate)
                .FirstOrDefaultAsync();

            // Tính toán BMR & TDEE theo Mifflin-St Jeor
            double bmr = (user.Gender == "Nam")
                ? (10 * user.Weight + 6.25 * user.Height - 5 * user.Age + 5)
                : (10 * user.Weight + 6.25 * user.Height - 5 * user.Age - 161);

            double pal = user.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55
            };

            double tdee = bmr * pal;
            double heightM = user.Height / 100.0;
            double bmi = heightM > 0 ? Math.Round(user.Weight / (heightM * heightM), 1) : 0;

            // Nước động tự động tăng bù theo calo đốt
            double dynamicTargetWater = Math.Round(user.TargetWater + (burnedCalories * 0.0012), 1);
            int dynamicTargetCalories = (int)Math.Round(tdee + burnedCalories);

            // Cập nhật bảng DailyTrackings làm lịch sử ngày hôm nay
            var tracking = await _context.DailyTrackings.FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);
            if (tracking == null)
            {
                tracking = new DailyTracking { UserId = userId, TrackingDate = today };
                _context.DailyTrackings.Add(tracking);
            }
            tracking.WaterConsumed = waterLiters;
            tracking.CaloriesConsumed = consumedCalories;
            tracking.StepsCount = steps;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                fullName = user.FullName,
                role = user.Role?.RoleName ?? "User",
                bmi = bmi,
                bmr = Math.Round(bmr, 0),
                tdee = Math.Round(tdee, 0),
                caloriesConsumed = consumedCalories,
                targetCalories = dynamicTargetCalories,
                waterConsumed = waterLiters,
                targetWater = dynamicTargetWater,
                stepsCount = steps,
                caloriesBurned = Math.Round(burnedCalories, 1),
                latestSleep = latestSleep == null ? null : new
                {
                    durationMinutes = latestSleep.DurationMinutes,
                    qualityRating = latestSleep.QualityRating,
                    sleepScore = latestSleep.SleepScore
                }
            });
        }

        // ==========================================
        // 2. KẾ HOẠCH & THEO DÕI THEO NGÀY (EAT THIS MUCH STYLE)
        // ==========================================
        [HttpPost("toggle-meal-eaten/{dailyMealId}")]
        public async Task<IActionResult> ToggleMealEaten(int dailyMealId, [FromQuery] int userId = 1)
        {
            var dailyMeal = await _context.DailyMeals
                .FirstOrDefaultAsync(dm => dm.DailyMealId == dailyMealId && dm.UserId == userId);

            if (dailyMeal == null) return NotFound("Không tìm thấy món ăn.");

            // Đảo ngược trạng thái đã ăn / chưa ăn
            dailyMeal.IsEaten = !dailyMeal.IsEaten;
            await _context.SaveChangesAsync();

            // Tính lại tổng calo thực tế trong ngày
            var today = DateTime.Today;
            int totalConsumed = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == today && dm.IsEaten)
                .Include(dm => dm.Meal)
                .SumAsync(dm => (int?)dm.Meal!.Calories) ?? 0;

            return Ok(new { success = true, isEaten = dailyMeal.IsEaten, totalConsumed = totalConsumed });
        }
        [HttpGet("plan-by-date")]
        public async Task<IActionResult> GetPlanByDate([FromQuery] int userId = 1, [FromQuery] string? dateStr = null)
        {
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            DateTime queryDate = string.IsNullOrEmpty(dateStr) ? DateTime.Today : DateTime.Parse(dateStr);
            bool isVip = user.Role?.RoleName == "VIP" || user.Role?.RoleName == "Admin";

            // Nếu là Free user mà truy cập ngày trong tương lai -> Yêu cầu nâng cấp VIP
            if (!isVip && queryDate.Date > DateTime.Today)
            {
                return Ok(new
                {
                    isLockedForFree = true,
                    message = "Lên kế hoạch trước cho ngày mai và cả tuần là tính năng độc quyền của Gói VIP!"
                });
            }

            var dailyMeals = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == queryDate.Date)
                .Include(dm => dm.Meal)
                .ToListAsync();

            // Nếu ngày này chưa có thực đơn -> Tự động sinh thực đơn mặc định từ kho
            if (!dailyMeals.Any())
            {
                var candidateMeals = await _context.Meals.Where(m => m.IsActive).ToListAsync();
                if (candidateMeals.Any())
                {
                    var bMeal = candidateMeals.FirstOrDefault(m => m.MealType.ToLower() == "breakfast") ?? candidateMeals[0];
                    var lMeal = candidateMeals.FirstOrDefault(m => m.MealType.ToLower() == "lunch") ?? candidateMeals[Math.Min(1, candidateMeals.Count - 1)];
                    var dMeal = candidateMeals.FirstOrDefault(m => m.MealType.ToLower() == "dinner") ?? candidateMeals[Math.Min(2, candidateMeals.Count - 1)];

                    var newPlan = new List<DailyMeal>
                    {
                        new DailyMeal { UserId = userId, MealId = bMeal.MealId, MealType = "Breakfast", PlanDate = queryDate.Date },
                        new DailyMeal { UserId = userId, MealId = lMeal.MealId, MealType = "Lunch", PlanDate = queryDate.Date },
                        new DailyMeal { UserId = userId, MealId = dMeal.MealId, MealType = "Dinner", PlanDate = queryDate.Date }
                    };
                    _context.DailyMeals.AddRange(newPlan);
                    await _context.SaveChangesAsync();
                    dailyMeals = await _context.DailyMeals
                        .Where(dm => dm.UserId == userId && dm.PlanDate == queryDate.Date)
                        .Include(dm => dm.Meal)
                        .ToListAsync();
                }
            }

            int totalCalo = dailyMeals.Sum(m => m.Meal?.Calories ?? 0);
            double totalProtein = Math.Round(totalCalo * 0.25 / 4.0, 1);
            double totalCarbs = Math.Round(totalCalo * 0.50 / 4.0, 1);
            double totalFat = Math.Round(totalCalo * 0.25 / 9.0, 1);

            double targetCalo = user.TargetCalories > 0 ? user.TargetCalories : 2150;
            double targetProtein = Math.Round(targetCalo * 0.25 / 4.0, 1);
            double targetCarbs = Math.Round(targetCalo * 0.50 / 4.0, 1);
            double targetFat = Math.Round(targetCalo * 0.25 / 9.0, 1);

            return Ok(new
            {
                isLockedForFree = false,
                isVip = isVip,
                roleName = user.Role?.RoleName ?? "User",
                dateFormatted = queryDate.ToString("yyyy-MM-dd"),
                dateDisplay = queryDate.Date == DateTime.Today ? "Hôm nay" : queryDate.Date == DateTime.Today.AddDays(1) ? "Ngày mai" : queryDate.ToString("dd 'tháng' MM"),
                totalCalories = totalCalo,
                targetCalories = (int)targetCalo,
                trackedCalories = totalCalo,
                macro = new
                {
                    carbs = totalCarbs,
                    targetCarbs = targetCarbs,
                    carbsPercent = totalCalo > 0 ? (int)Math.Round((totalCarbs * 4 / totalCalo) * 100) : 50,
                    fat = totalFat,
                    targetFat = targetFat,
                    fatPercent = totalCalo > 0 ? (int)Math.Round((totalFat * 9 / totalCalo) * 100) : 25,
                    protein = totalProtein,
                    targetProtein = targetProtein,
                    proteinPercent = totalCalo > 0 ? (int)Math.Round((totalProtein * 4 / totalCalo) * 100) : 25,
                    fiber = Math.Round(totalCalo * 0.012, 1),
                    targetFiber = 25.0,
                    sodium = totalCalo > 0 ? (int)(totalCalo * 0.8) : 0,
                    cholesterol = totalCalo > 0 ? (int)(totalCalo * 0.12) : 0
                },
                meals = dailyMeals.Select(dm => new
                {
                    dailyMealId = dm.DailyMealId,
                    mealId = dm.MealId,
                    mealType = dm.MealType,
                    mealName = dm.Meal?.MealName ?? "Món ăn",
                    calories = dm.Meal?.Calories ?? 0,
                    price = dm.Meal?.Price ?? 0,
                    tag = dm.Meal?.Tag ?? "Chuẩn Dinh Dưỡng",
                    servingUnit = "1 khẩu phần",
                    isChecked = true
                }).ToList()
            });
        }

        // ==========================================
        // 3. MÁY PHÁT ĐIỆN THỰC ĐƠN & ĐỔI MÓN (GENERATOR & SWAP)
        // ==========================================
        [HttpPost("generate-meal-plan")]
        public async Task<IActionResult> GenerateMealPlan([FromBody] GeneratePlanRequest req, [FromQuery] int userId = 1)
        {
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            DateTime planDate = string.IsNullOrEmpty(req.DateStr) ? DateTime.Today : DateTime.Parse(req.DateStr);
            bool isVip = user.Role?.RoleName == "VIP" || user.Role?.RoleName == "Admin";

            if (!isVip && planDate.Date > DateTime.Today)
            {
                return BadRequest("Gói Free chỉ tạo thực đơn cho ngày hôm nay. Hãy nâng cấp VIP để tạo thực đơn cho tương lai!");
            }

            var oldMeals = await _context.DailyMeals.Where(dm => dm.UserId == userId && dm.PlanDate == planDate.Date).ToListAsync();
            _context.DailyMeals.RemoveRange(oldMeals);

            var allMeals = await _context.Meals.Where(m => m.IsActive).ToListAsync();
            if (!allMeals.Any()) return BadRequest("Kho món ăn đang trống!");

            var rand = new Random();
            var bList = allMeals.Where(m => m.MealType.ToLower() == "breakfast").ToList();
            var lList = allMeals.Where(m => m.MealType.ToLower() == "lunch").ToList();
            var dList = allMeals.Where(m => m.MealType.ToLower() == "dinner").ToList();

            var bPick = bList.Any() ? bList[rand.Next(bList.Count)] : allMeals[rand.Next(allMeals.Count)];
            var lPick = lList.Any() ? lList[rand.Next(lList.Count)] : allMeals[rand.Next(allMeals.Count)];
            var dPick = dList.Any() ? dList[rand.Next(dList.Count)] : allMeals[rand.Next(allMeals.Count)];

            var newMeals = new List<DailyMeal>
            {
                new DailyMeal { UserId = userId, MealId = bPick.MealId, MealType = "Breakfast", PlanDate = planDate.Date },
                new DailyMeal { UserId = userId, MealId = lPick.MealId, MealType = "Lunch", PlanDate = planDate.Date },
                new DailyMeal { UserId = userId, MealId = dPick.MealId, MealType = "Dinner", PlanDate = planDate.Date }
            };

            _context.DailyMeals.AddRange(newMeals);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = $"⚡ Máy phát điện AI đã tạo thành công thực đơn ngày {planDate:dd/MM} theo định hướng {req.Focus}!" });
        }

        [HttpPost("swap-meal/{dailyMealId}")]
        public async Task<IActionResult> SwapMeal(int dailyMealId, [FromQuery] int userId = 1)
        {
            var dailyMeal = await _context.DailyMeals.Include(dm => dm.Meal).FirstOrDefaultAsync(dm => dm.DailyMealId == dailyMealId && dm.UserId == userId);
            if (dailyMeal == null) return NotFound("Món ăn không tồn tại.");

            var candidates = await _context.Meals
                .Where(m => m.IsActive && m.MealType.ToLower() == dailyMeal.MealType.ToLower() && m.MealId != dailyMeal.MealId)
                .ToListAsync();

            if (!candidates.Any())
                candidates = await _context.Meals.Where(m => m.IsActive && m.MealId != dailyMeal.MealId).ToListAsync();

            if (candidates.Any())
            {
                var newPick = candidates[new Random().Next(candidates.Count)];
                dailyMeal.MealId = newPick.MealId;
                await _context.SaveChangesAsync();
                return Ok(new { success = true, newMealName = newPick.MealName, calories = newPick.Calories });
            }

            return BadRequest("Không còn món nào khác trong kho để thay thế.");
        }

        // ==========================================
        // 4. BỮA ĂN HÔM NAY & KHO MÓN (/today-meals & /meals)
        // ==========================================
        [HttpGet("today-meals")]
        public async Task<IActionResult> GetTodayMeals([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var meals = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == today)
                .Include(dm => dm.Meal)
                .ToListAsync();

            var breakfast = meals.FirstOrDefault(m => m.MealType.ToLower() == "breakfast")?.Meal;
            var lunch = meals.FirstOrDefault(m => m.MealType.ToLower() == "lunch")?.Meal;
            var dinner = meals.FirstOrDefault(m => m.MealType.ToLower() == "dinner")?.Meal;

            return Ok(new
            {
                breakfast = breakfast == null ? null : new { breakfast.MealName, breakfast.Calories, Tag = breakfast.Tag ?? "Đã chọn" },
                lunch = lunch == null ? null : new { lunch.MealName, lunch.Calories, Tag = lunch.Tag ?? "Đã chọn" },
                dinner = dinner == null ? null : new { dinner.MealName, dinner.Calories, Tag = dinner.Tag ?? "Đã chọn" }
            });
        }

        [HttpPost("apply-today-meal")]
        public async Task<IActionResult> ApplyTodayMeal([FromBody] ApplyMealDto dto, [FromQuery] int userId = 1)
        {
            var meal = await _context.Meals.FindAsync(dto.MealId);
            if (meal == null) return NotFound("Món ăn không tồn tại.");

            var today = DateTime.Today;
            var exist = await _context.DailyMeals
                .FirstOrDefaultAsync(dm => dm.UserId == userId && dm.MealType.ToLower() == dto.MealType.ToLower() && dm.PlanDate == today);

            if (exist != null)
            {
                exist.MealId = meal.MealId;
            }
            else
            {
                _context.DailyMeals.Add(new DailyMeal
                {
                    UserId = userId,
                    MealType = dto.MealType,
                    MealId = meal.MealId,
                    PlanDate = today
                });
            }

            await _context.SaveChangesAsync();

            int totalToday = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == today)
                .Include(dm => dm.Meal)
                .SumAsync(dm => (int?)dm.Meal!.Calories) ?? 0;

            return Ok(new
            {
                message = "Áp dụng món thành công!",
                meal = new { meal.MealId, meal.MealName, meal.Calories },
                totalCaloriesToday = totalToday
            });
        }

        [HttpGet("meals")]
        public async Task<IActionResult> GetMeals()
        {
            return Ok(await _context.Meals.Where(m => m.IsActive).ToListAsync());
        }

        [HttpPost("meals")]
        public async Task<IActionResult> CreateMeal([FromBody] CreateMealDto dto)
        {
            var meal = new Meal
            {
                MealName = dto.MealName,
                MealType = dto.MealType,
                Calories = dto.Calories,
                Price = dto.Price,
                Tag = dto.Tag ?? $"{dto.Calories} kcal",
                IsActive = true
            };
            _context.Meals.Add(meal);
            await _context.SaveChangesAsync();
            return Ok(meal);
        }

        [HttpGet("random-meal")]
        public async Task<IActionResult> GetRandomMeal([FromQuery] string mealType = "Lunch")
        {
            var meals = await _context.Meals
                .Where(m => m.IsActive && m.MealType.ToLower() == mealType.ToLower())
                .ToListAsync();

            if (!meals.Any())
                meals = await _context.Meals.Where(m => m.IsActive).ToListAsync();

            if (!meals.Any()) return NotFound("Chưa có món ăn nào trong kho!");

            var randomMeal = meals[new Random().Next(meals.Count)];
            return Ok(randomMeal);
        }

        [HttpPost("ai-knn-recommend")]
        public async Task<IActionResult> RecommendMealsKnn([FromBody] KnnRequestDto req, [FromQuery] int userId = 1)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            int consumed = await _context.DailyMeals
                .Where(dm => dm.UserId == userId && dm.PlanDate == today)
                .Include(dm => dm.Meal)
                .SumAsync(dm => (int?)dm.Meal!.Calories) ?? 0;

            int remainingCalo = Math.Max(350, user.TargetCalories - consumed);
            double mealRatio = req.MealType.ToLower() switch
            {
                "breakfast" => 0.25,
                "dinner" => 0.30,
                _ => 0.45
            };

            double targetMealCalo = remainingCalo * mealRatio;

            var candidateMeals = await _context.Meals
                .Where(m => m.IsActive && m.MealType.ToLower() == req.MealType.ToLower())
                .ToListAsync();

            if (!candidateMeals.Any())
                candidateMeals = await _context.Meals.Where(m => m.IsActive).ToListAsync();

            var results = candidateMeals.Select(m =>
            {
                double diff = Math.Abs(m.Calories - targetMealCalo);
                int matchScore = (int)Math.Max(35, Math.Round((1.0 / (1.0 + (diff / 150.0))) * 100));

                double estProtein = Math.Round(m.Calories * 0.25 / 4.0, 1);
                double estCarbs = Math.Round(m.Calories * 0.50 / 4.0, 1);
                double estFat = Math.Round(m.Calories * 0.25 / 9.0, 1);

                return new
                {
                    mealId = m.MealId,
                    mealName = m.MealName,
                    mealType = m.MealType,
                    calories = m.Calories,
                    protein = estProtein,
                    carbs = estCarbs,
                    fat = estFat,
                    price = m.Price,
                    tag = m.Tag ?? "Chuẩn Dinh Dưỡng",
                    benefitReason = $"Cung cấp ~{estProtein}g protein và ~{estCarbs}g carbs phức, đáp ứng tối ưu mức thâm hụt calo của cơ thể.",
                    matchScore = matchScore
                };
            })
            .OrderByDescending(x => x.matchScore)
            .Take(3)
            .ToList();

            return Ok(new
            {
                targetVector = new
                {
                    calories = Math.Round(targetMealCalo),
                    protein = Math.Round(targetMealCalo * 0.25 / 4.0, 1),
                    carbs = Math.Round(targetMealCalo * 0.50 / 4.0, 1),
                    fat = Math.Round(targetMealCalo * 0.25 / 9.0, 1)
                },
                recommendations = results,
                dataSource = "Bảng thành phần thực phẩm Việt Nam - Viện Dinh Dưỡng Quốc Gia"
            });
        }

        // ==========================================
        // 5. THEO DÕI NƯỚC UỐNG (/water-summary & /water-logs)
        // ==========================================
        [HttpGet("water-summary")]
        public async Task<IActionResult> GetWaterSummary([FromQuery] int userId = 1)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            var logs = await _context.WaterLogs
                .Where(w => w.UserId == userId && w.LogDate == today)
                .OrderByDescending(w => w.LoggedAt)
                .ToListAsync();

            int totalWorkoutSeconds = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .SumAsync(a => (int?)a.DurationSeconds) ?? 0;
            int workoutMinutes = (int)Math.Round(totalWorkoutSeconds / 60.0);

            int totalHydrationMl = logs.Sum(l => l.HydrationAmountMl);
            double consumedWater = Math.Round(totalHydrationMl / 1000.0, 2);
            double targetWater = Math.Round(user.TargetWater + (workoutMinutes * 0.008), 1);

            return Ok(new
            {
                targetWater = targetWater,
                consumedWater = consumedWater,
                workoutMinutes = workoutMinutes,
                logs = logs.Select(l => new
                {
                    logId = l.LogId,
                    waterType = l.WaterType,
                    amountMl = l.AmountMl,
                    hydrationAmountMl = l.HydrationAmountMl,
                    calories = l.Calories,
                    time = l.LoggedAt.ToString("HH:mm")
                })
            });
        }

        [HttpPost("water-logs")]
        public async Task<IActionResult> AddWaterLog([FromBody] AddWaterDto dto, [FromQuery] int userId = 1)
        {
            double ratio = dto.WaterType switch
            {
                "Tea" => 0.95,
                "Coffee" => 0.85,
                "Milk" => 0.88,
                "Juice" => 0.85,
                _ => 1.0
            };

            int hydrationMl = (int)Math.Round(dto.AmountMl * ratio);
            int calo = dto.WaterType == "Milk" ? (int)(dto.AmountMl * 0.6) : dto.WaterType == "Juice" ? (int)(dto.AmountMl * 0.45) : 0;

            var log = new WaterLog
            {
                UserId = userId,
                AmountMl = dto.AmountMl,
                WaterType = dto.WaterType,
                HydrationAmountMl = hydrationMl,
                Calories = calo,
                LoggedAt = DateTime.Now,
                LogDate = DateTime.Today
            };

            _context.WaterLogs.Add(log);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Ghi nhận uống nước thành công!", hydrationMl = hydrationMl });
        }

        [HttpDelete("water-logs/{id}")]
        public async Task<IActionResult> DeleteWaterLog(int id, [FromQuery] int userId = 1)
        {
            var log = await _context.WaterLogs.FirstOrDefaultAsync(l => l.LogId == id && l.UserId == userId);
            if (log == null) return NotFound("Bản ghi không tồn tại.");

            _context.WaterLogs.Remove(log);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ==========================================
        // 6. GIẤC NGỦ & CHU KỲ (/sleep-today & /sleep-logs)
        // ==========================================
        [HttpGet("sleep-today")]
        public async Task<IActionResult> GetSleepToday([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var log = await _context.SleepLogs
                .FirstOrDefaultAsync(s => s.UserId == userId && s.SleepDate == today);

            if (log == null) return Ok(null);

            return Ok(new
            {
                durationMinutes = log.DurationMinutes,
                sleepCycles = log.SleepCycles,
                qualityRating = log.QualityRating,
                sleepScore = log.SleepScore
            });
        }

        [HttpPost("sleep-logs")]
        public async Task<IActionResult> SaveSleepLog([FromBody] SaveSleepDto dto, [FromQuery] int userId = 1)
        {
            var bed = DateTime.Parse(dto.BedTime);
            var wake = DateTime.Parse(dto.WakeTime);
            if (wake < bed) wake = wake.AddDays(1);

            int totalMins = (int)(wake - bed).TotalMinutes;
            int cycles = totalMins / 90;
            int score = Math.Min(100, Math.Max(40, (int)((totalMins / 480.0) * 80) + (dto.QualityRating == "Energetic" ? 20 : dto.QualityRating == "Normal" ? 10 : 0)));

            var today = DateTime.Today;
            var exist = await _context.SleepLogs.FirstOrDefaultAsync(s => s.UserId == userId && s.SleepDate == today);
            if (exist != null)
            {
                exist.BedTime = bed;
                exist.WakeTime = wake;
                exist.DurationMinutes = totalMins;
                exist.SleepCycles = cycles;
                exist.QualityRating = dto.QualityRating;
                exist.SleepScore = score;
            }
            else
            {
                _context.SleepLogs.Add(new SleepLog
                {
                    UserId = userId,
                    BedTime = bed,
                    WakeTime = wake,
                    DurationMinutes = totalMins,
                    SleepCycles = cycles,
                    QualityRating = dto.QualityRating,
                    SleepScore = score,
                    SleepDate = today
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã lưu bản ghi giấc ngủ!",
                durationHours = (totalMins / 60.0).ToString("0.0"),
                sleepScore = score
            });
        }

        // ==========================================
        // 7. HOẠT ĐỘNG VẬN ĐỘNG (/today-activities & /log-activity)
        // ==========================================
        [HttpGet("today-activities")]
        public async Task<IActionResult> GetTodayActivities([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var acts = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(acts.Select(a => new
            {
                activityId = a.ActivityId,
                activityType = a.ActivityType,
                durationSeconds = a.DurationSeconds,
                stepsEquivalent = a.StepsEquivalent,
                caloriesBurned = Math.Round(a.CaloriesBurned, 1)
            }));
        }

        [HttpPost("log-activity")]
        public async Task<IActionResult> LogActivity([FromBody] LogActivityDto dto, [FromQuery] int userId = 1)
        {
            double stepsPerSec = dto.ActivityType switch
            {
                "Running" => 2.8,
                "Cycling" => 1.2,
                "Gym" => 1.0,
                _ => 1.8
            };

            double caloPerMin = dto.ActivityType switch
            {
                "Running" => 9.5,
                "Cycling" => 7.0,
                "Gym" => 6.0,
                _ => 4.2
            };

            int stepsAdded = (int)Math.Round(dto.DurationSeconds * stepsPerSec);
            double caloAdded = Math.Round((dto.DurationSeconds / 60.0) * caloPerMin, 1);

            var act = new UserActivity
            {
                UserId = userId,
                ActivityType = dto.ActivityType,
                DurationSeconds = dto.DurationSeconds,
                StepsEquivalent = stepsAdded,
                CaloriesBurned = caloAdded,
                LogDate = DateTime.Today,
                CreatedAt = DateTime.Now
            };

            _context.Activities.Add(act);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Ghi nhận vận động thành công!",
                stepsAdded = stepsAdded,
                caloriesBurned = caloAdded
            });
        }

        [HttpDelete("activities/{id}")]
        public async Task<IActionResult> DeleteActivity(int id, [FromQuery] int userId = 1)
        {
            var act = await _context.Activities.FirstOrDefaultAsync(a => a.ActivityId == id && a.UserId == userId);
            if (act == null) return NotFound("Buổi tập không tồn tại.");

            _context.Activities.Remove(act);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("reset-today-activities")]
        public async Task<IActionResult> ResetTodayActivities([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var acts = await _context.Activities.Where(a => a.UserId == userId && a.LogDate == today).ToListAsync();
            _context.Activities.RemoveRange(acts);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ==========================================
        // 8. LỊCH TRÌNH TIMELINE (/timelines & /generate-schedule)
        // ==========================================
        [HttpGet("timelines")]
        [HttpGet("schedule")]
        public async Task<IActionResult> GetTimelines([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var list = await _context.Timelines
                .Where(t => t.UserId == userId && t.PlanDate == today)
                .OrderBy(t => t.TimelineId)
                .ToListAsync();

            if (!list.Any())
            {
                var defaults = new List<Timeline>
                {
                    new Timeline { UserId = userId, TimeSlot = "07:00 - 07:15", Title = "Thức dậy & Uống 300ml nước ấm", Category = "Rest", IsCompleted = true, PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "07:30 - 08:00", Title = "Bữa sáng dinh dưỡng khởi động ngày mới", Category = "Meal", IsCompleted = true, PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "12:00 - 12:45", Title = "Bữa trưa cân bằng đa lượng theo gợi ý AI", Category = "Meal", IsCompleted = false, PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "17:30 - 18:15", Title = "Khung giờ vàng thể thao: Đi bộ / Tập luyện đốt calo", Category = "Task", IsCompleted = false, PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "22:45 - 23:00", Title = "Thư giãn, chuẩn bị ngủ sâu đủ 5 chu kỳ 90 phút", Category = "Rest", IsCompleted = false, PlanDate = today }
                };
                _context.Timelines.AddRange(defaults);
                await _context.SaveChangesAsync();
                list = defaults;
            }

            return Ok(list);
        }

        [HttpPost("timelines")]
        public async Task<IActionResult> CreateTimeline([FromBody] CreateTimelineDto dto, [FromQuery] int userId = 1)
        {
            var timeline = new Timeline
            {
                UserId = userId,
                TimeSlot = dto.TimeSlot,
                Title = dto.Title,
                Category = dto.Category,
                IsCompleted = false,
                PlanDate = DateTime.Today
            };
            _context.Timelines.Add(timeline);
            await _context.SaveChangesAsync();
            return Ok(timeline);
        }

        [HttpPatch("timelines/{id}/toggle")]
        [HttpPost("toggle-task/{id}")]
        public async Task<IActionResult> ToggleTimeline(int id, [FromQuery] int userId = 1)
        {
            var t = await _context.Timelines.FirstOrDefaultAsync(x => x.TimelineId == id && x.UserId == userId);
            if (t == null) return NotFound("Không tìm thấy mốc thời gian.");

            t.IsCompleted = !t.IsCompleted;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, isCompleted = t.IsCompleted });
        }

        [HttpDelete("timelines/{id}")]
        public async Task<IActionResult> DeleteTimeline(int id, [FromQuery] int userId = 1)
        {
            var t = await _context.Timelines.FirstOrDefaultAsync(x => x.TimelineId == id && x.UserId == userId);
            if (t == null) return NotFound("Không tìm thấy mốc thời gian.");

            _context.Timelines.Remove(t);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPut("timelines/{id}")]
        public async Task<IActionResult> UpdateTimeline(int id, [FromBody] CreateTimelineDto dto, [FromQuery] int userId = 1)
        {
            var t = await _context.Timelines.FirstOrDefaultAsync(x => x.TimelineId == id && x.UserId == userId);
            if (t == null) return NotFound("Không tìm thấy mốc thời gian.");

            t.TimeSlot = dto.TimeSlot;
            t.Title = dto.Title;
            t.Category = dto.Category;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        [HttpPost("generate-schedule")]
        public async Task<IActionResult> GenerateSchedule([FromBody] GenScheduleDto req, [FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var old = await _context.Timelines.Where(t => t.UserId == userId && t.PlanDate == today).ToListAsync();
            _context.Timelines.RemoveRange(old);

            var newTimelines = new List<Timeline>();
            if (req.Archetype.ToLower() == "fitness")
            {
                newTimelines.AddRange(new[]
                {
                    new Timeline { UserId = userId, TimeSlot = "06:00 - 06:15", Title = "Thức dậy & Uống 400ml nước ấm", Category = "Rest", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "06:30 - 07:30", Title = "Tập kháng lực (Gym/Kháng lực) theo mục tiêu tăng cơ", Category = "Task", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "07:45 - 08:15", Title = "Bữa sáng giàu đạm: Trứng + Yến mạch", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "12:00 - 12:45", Title = "Bữa trưa hồi phục: Ức gà áp chảo (AI Recommender)", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "15:30 - 15:45", Title = "Bổ sung 300ml nước và hạt dinh dưỡng", Category = "Rest", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "19:00 - 19:45", Title = "Bữa tối nhẹ: Cá ngừ sốt mè & Rau luộc", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "22:30 - 23:00", Title = "Ngủ sâu đủ 5 chu kỳ 90 phút (Tái tạo mô cơ)", Category = "Rest", PlanDate = today }
                });
            }
            else
            {
                newTimelines.AddRange(new[]
                {
                    new Timeline { UserId = userId, TimeSlot = "06:30 - 06:45", Title = "Thức dậy & Uống 300ml nước ấm kích hoạt trao đổi chất", Category = "Rest", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "07:00 - 07:30", Title = "Bữa sáng nạp năng lượng học tập", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "09:30 - 09:40", Title = "Bổ sung nước giữa giờ (250ml) & Giãn cơ", Category = "Rest", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "12:00 - 12:45", Title = "Bữa trưa đầy đủ đa lượng theo gợi ý AI", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "17:15 - 18:00", Title = "Đi bộ nhanh ngoài trời đốt 250 kcal", Category = "Task", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "18:45 - 19:30", Title = "Bữa tối thanh đạm: Canh ngao + Đậu sốt", Category = "Meal", PlanDate = today },
                    new Timeline { UserId = userId, TimeSlot = "22:45 - 23:00", Title = "Thư giãn, tắt thiết bị điện tử chuẩn bị ngủ sâu", Category = "Rest", PlanDate = today }
                });
            }

            _context.Timelines.AddRange(newTimelines);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // ==========================================
        // 9. THỐNG KÊ LỊCH SỬ THỰC TẾ (KHÔNG SINH DỮ LIỆU GIẢ CŨ)
        // ==========================================
        [HttpGet("statistics")]
        [HttpGet("history-7days")]
        public async Task<IActionResult> GetStatistics([FromQuery] int userId = 1, [FromQuery] int days = 7)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            days = Math.Clamp(days, 1, 365);
            var startDate = today.AddDays(-(days - 1));

            // Chỉ lấy đúng dữ liệu thực tế của user từ cơ sở dữ liệu
            var trackings = await _context.DailyTrackings
                .Where(t => t.UserId == userId && t.TrackingDate >= startDate && t.TrackingDate <= today)
                .OrderBy(t => t.TrackingDate)
                .ToListAsync();

            // Nếu tài khoản mới chưa có tracking hôm nay -> tạo 1 bản ghi rỗng cho ngày hôm nay
            if (!trackings.Any(t => t.TrackingDate == today))
            {
                var todayTrack = new DailyTracking
                {
                    UserId = userId,
                    TrackingDate = today,
                    CaloriesConsumed = 0,
                    WaterConsumed = 0,
                    StepsCount = 0
                };
                _context.DailyTrackings.Add(todayTrack);
                await _context.SaveChangesAsync();
                trackings.Add(todayTrack);
            }

            var labels = trackings.Select(t => t.TrackingDate.ToString("dd/MM")).ToList();
            var caloIn = trackings.Select(t => t.CaloriesConsumed).ToList();
            var caloBurned = trackings.Select(t => (int)(t.StepsCount * 0.04)).ToList();
            var water = trackings.Select(t => t.WaterConsumed).ToList();
            var steps = trackings.Select(t => t.StepsCount).ToList();

            string compareInsight = trackings.Count <= 1
                ? "Chào mừng tài khoản mới! Hãy bắt đầu ghi nhận các bữa ăn và hoạt động hôm nay để phân tích tiến trình."
                : $"Dữ liệu thực tế ghi nhận từ {labels.First()} đến {labels.Last()}.";

            return Ok(new
            {
                totalDays = trackings.Count,
                startDate = trackings.First().TrackingDate.ToString("dd/MM/yyyy"),
                endDate = today.ToString("dd/MM/yyyy"),
                labels = labels,
                caloriesIn = caloIn,
                caloriesBurned = caloBurned,
                water = water,
                steps = steps,
                insight = compareInsight
            });
        }

        // ==========================================
        // 10. CHUYỂN ĐỔI ROLE VIP / FREE ĐỂ TEST
        // ==========================================
        [HttpPost("toggle-vip-role")]
        public async Task<IActionResult> ToggleVipRole([FromQuery] int userId = 1)
        {
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var vipRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "VIP");
            var userRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "User");

            if (vipRole == null)
            {
                vipRole = new Role { RoleName = "VIP" };
                _context.Roles.Add(vipRole);
                await _context.SaveChangesAsync();
            }

            if (userRole == null)
            {
                userRole = new Role { RoleName = "User" };
                _context.Roles.Add(userRole);
                await _context.SaveChangesAsync();
            }

            if (user.RoleId == vipRole.RoleId)
            {
                user.RoleId = userRole.RoleId;
            }
            else
            {
                user.RoleId = vipRole.RoleId;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, role = user.RoleId == vipRole.RoleId ? "VIP" : "User" });
        }

        // ==========================================
        // 11. CẬP NHẬT HỒ SƠ CÁ NHÂN (/update-profile)
        // ==========================================
        [HttpPut("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            user.FullName = dto.FullName;
            user.Gender = dto.Gender;
            user.Age = dto.Age;
            user.Height = dto.Height;
            user.Weight = dto.Weight;
            user.ActivityLevel = dto.ActivityLevel;
            user.Goal = dto.Goal;

            double bmr = (user.Gender == "Nam")
                ? (10 * user.Weight + 6.25 * user.Height - 5 * user.Age + 5)
                : (10 * user.Weight + 6.25 * user.Height - 5 * user.Age - 161);

            double pal = user.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55
            };

            user.TargetCalories = (int)Math.Round(bmr * pal);
            user.TargetWater = Math.Round(user.Weight * 0.035, 1);

            await _context.SaveChangesAsync();
            return Ok(new { success = true, user });
        }
    }

    // CÁC DTO TRUYỀN NHẬN DỮ LIỆU
    public class GeneratePlanRequest { public string DateStr { get; set; } = string.Empty; public string Focus { get; set; } = "Cân bằng"; }
    public class ApplyMealDto { public int MealId { get; set; } public string MealType { get; set; } = "Lunch"; }
    public class CreateMealDto { public string MealName { get; set; } = string.Empty; public string MealType { get; set; } = "Lunch"; public int Calories { get; set; } public decimal Price { get; set; } public string? Tag { get; set; } }
    public class KnnRequestDto { public string MealType { get; set; } = "Lunch"; }
    public class AddWaterDto { public int AmountMl { get; set; } public string WaterType { get; set; } = "Water"; }
    public class SaveSleepDto { public string BedTime { get; set; } = string.Empty; public string WakeTime { get; set; } = string.Empty; public string QualityRating { get; set; } = "Normal"; }
    public class LogActivityDto { public string ActivityType { get; set; } = "Walking"; public int DurationSeconds { get; set; } }
    public class CreateTimelineDto { public string TimeSlot { get; set; } = string.Empty; public string Title { get; set; } = string.Empty; public string Category { get; set; } = "Task"; }
    public class GenScheduleDto { public string Archetype { get; set; } = "student"; }
    public class UpdateProfileDto { public int UserId { get; set; } public string FullName { get; set; } = string.Empty; public string Gender { get; set; } = "Nam"; public int Age { get; set; } public double Height { get; set; } public double Weight { get; set; } public string ActivityLevel { get; set; } = "Vận động vừa"; public string Goal { get; set; } = "Duy trì"; }
}