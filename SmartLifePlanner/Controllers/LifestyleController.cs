using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartLifePlanner.Models;

namespace SmartLifePlanner.Controllers
{
    public class TimelineCreateDto
    {
        public string TimeSlot { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = "Task";
    }

    public class MealCreateDto
    {
        public string MealName { get; set; } = string.Empty;
        public string MealType { get; set; } = "Lunch";
        public int Calories { get; set; }
        public decimal Price { get; set; }
        public string Tag { get; set; } = string.Empty;
    }

    public class ApplyMealDto
    {
        public int MealId { get; set; }
        public string MealType { get; set; } = string.Empty;
    }

    public class ActivityCreateDto
    {
        public string ActivityType { get; set; } = "Walking";
        public int DurationSeconds { get; set; }
    }

    public class WaterLogCreateDto
    {
        public int AmountMl { get; set; }
        public string WaterType { get; set; } = "Water"; // Water, Tea, Coffee, Milk, Juice
    }

    public class SleepLogCreateDto
    {
        public DateTime BedTime { get; set; }
        public DateTime WakeTime { get; set; }
        public string QualityRating { get; set; } = "Normal"; // Tired, Normal, Energetic
    }

    // ĐÃ BỔ SUNG DTO CÒN THIẾU
    public class UpdateProfileDto
    {
        public int UserId { get; set; } = 1;
        public string FullName { get; set; } = string.Empty;
        public string Gender { get; set; } = "Nam";
        public int Age { get; set; } = 20;
        public double Height { get; set; }
        public double Weight { get; set; }
        public string ActivityLevel { get; set; } = "Vận động vừa";
        public string Goal { get; set; } = "Duy trì";
    }

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
        // 1. DASHBOARD TỔNG QUAN
        // ==========================================
        [HttpGet("dashboard-data")]
        public async Task<IActionResult> GetDashboardData([FromQuery] int userId = 1)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            var latestSleep = await _context.SleepLogs
                .Where(s => s.UserId == userId && s.SleepDate == today)
                .FirstOrDefaultAsync();

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
                stepsCount = tracking?.StepsCount ?? 0,
                latestSleep = latestSleep != null ? new
                {
                    durationMinutes = latestSleep.DurationMinutes,
                    sleepScore = latestSleep.SleepScore,
                    qualityRating = latestSleep.QualityRating
                } : null
            });
        }

        // ==========================================
        // 2. UỐNG NƯỚC (HYDRATION TRACKER CHI TIẾT)
        // ==========================================
        [HttpGet("water-summary")]
        public async Task<IActionResult> GetWaterSummary([FromQuery] int userId = 1)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;

            // Tính tổng phút tập luyện hôm nay để cá nhân hóa mục tiêu
            var totalWorkoutSeconds = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .SumAsync(a => a.DurationSeconds);
            int workoutMinutes = totalWorkoutSeconds / 60;

            // Công thức: Cân nặng x 0.035 + Phút tập x 0.005
            double dynamicTarget = Math.Round((user.Weight * 0.035) + (workoutMinutes * 0.005), 2);
            if (dynamicTarget < 1.5) dynamicTarget = 2.0;

            var logs = await _context.WaterLogs
                .Where(w => w.UserId == userId && w.LogDate == today)
                .OrderByDescending(w => w.LogId)
                .ToListAsync();

            double totalConsumedLiters = Math.Round(logs.Sum(l => l.HydrationAmountMl) / 1000.0, 2);

            return Ok(new
            {
                targetWater = dynamicTarget,
                consumedWater = totalConsumedLiters,
                workoutMinutes = workoutMinutes,
                logs = logs.Select(l => new {
                    l.LogId,
                    l.AmountMl,
                    l.WaterType,
                    l.HydrationAmountMl,
                    l.Calories,
                    time = l.LoggedAt.ToString("HH:mm")
                })
            });
        }

        [HttpPost("water-logs")]
        public async Task<IActionResult> AddWaterLog([FromBody] WaterLogCreateDto dto, [FromQuery] int userId = 1)
        {
            if (dto.AmountMl <= 0) return BadRequest("Lượng nước phải lớn hơn 0 ml.");

            // Hệ số bù nước & Calo tương ứng
            double factor = dto.WaterType switch
            {
                "Tea" => 0.85,
                "Coffee" => 0.80,
                "Milk" => 0.90,
                "Juice" => 0.85,
                _ => 1.0
            };

            int extraCalories = dto.WaterType switch
            {
                "Milk" => (int)(dto.AmountMl * 0.5),   // ~50 kcal / 100ml
                "Juice" => (int)(dto.AmountMl * 0.45), // ~45 kcal / 100ml
                _ => 0
            };

            int hydrationMl = (int)Math.Round(dto.AmountMl * factor);
            var today = DateTime.Today;

            var log = new WaterLog
            {
                UserId = userId,
                AmountMl = dto.AmountMl,
                WaterType = dto.WaterType,
                HydrationAmountMl = hydrationMl,
                Calories = extraCalories,
                LoggedAt = DateTime.Now,
                LogDate = today
            };
            _context.WaterLogs.Add(log);

            // Đồng bộ sang DailyTrackings
            var allTodayHydration = await _context.WaterLogs
                .Where(w => w.UserId == userId && w.LogDate == today)
                .SumAsync(w => w.HydrationAmountMl) + hydrationMl;

            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking == null)
            {
                tracking = new DailyTracking
                {
                    UserId = userId,
                    TrackingDate = today,
                    WaterConsumed = Math.Round(allTodayHydration / 1000.0, 2),
                    CaloriesConsumed = extraCalories,
                    StepsCount = 0
                };
                _context.DailyTrackings.Add(tracking);
            }
            else
            {
                tracking.WaterConsumed = Math.Round(allTodayHydration / 1000.0, 2);
                tracking.CaloriesConsumed += extraCalories;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã lưu lượng nước thành công!",
                addedMl = dto.AmountMl,
                hydrationMl = hydrationMl,
                totalConsumedLiters = tracking.WaterConsumed
            });
        }

        [HttpDelete("water-logs/{id}")]
        public async Task<IActionResult> DeleteWaterLog(int id, [FromQuery] int userId = 1)
        {
            var log = await _context.WaterLogs.FindAsync(id);
            if (log == null) return NotFound("Không tìm thấy nhật ký uống nước.");

            var today = log.LogDate;
            _context.WaterLogs.Remove(log);
            await _context.SaveChangesAsync();

            // Tính lại tổng nước và tổng calo trong DailyTrackings
            var remainingHydration = await _context.WaterLogs
                .Where(w => w.UserId == userId && w.LogDate == today)
                .SumAsync(w => w.HydrationAmountMl);

            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking != null)
            {
                tracking.WaterConsumed = Math.Round(remainingHydration / 1000.0, 2);
                if (log.Calories > 0)
                {
                    tracking.CaloriesConsumed = Math.Max(0, tracking.CaloriesConsumed - log.Calories);
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Đã xóa nhật ký uống nước thành công!" });
        }

        // ==========================================
        // 3. GIẤC NGỦ & CHU KỲ (SLEEP & RECOVERY)
        // ==========================================
        [HttpGet("sleep-today")]
        public async Task<IActionResult> GetTodaySleep([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var sleep = await _context.SleepLogs
                .FirstOrDefaultAsync(s => s.UserId == userId && s.SleepDate == today);
            return Ok(sleep);
        }

        [HttpPost("sleep-logs")]
        public async Task<IActionResult> SaveSleepLog([FromBody] SleepLogCreateDto dto, [FromQuery] int userId = 1)
        {
            if (dto.WakeTime <= dto.BedTime)
            {
                if (dto.WakeTime.TimeOfDay <= dto.BedTime.TimeOfDay)
                {
                    dto.WakeTime = dto.WakeTime.AddDays(1);
                }
                else
                {
                    return BadRequest("Giờ thức dậy phải sau giờ đi ngủ.");
                }
            }

            int durationMinutes = (int)(dto.WakeTime - dto.BedTime).TotalMinutes;
            if (durationMinutes <= 0) return BadRequest("Thời gian ngủ không hợp lệ.");

            int cycles = durationMinutes / 90;

            int durationScore = 0;
            if (durationMinutes >= 420 && durationMinutes <= 540) durationScore = 50;
            else if (durationMinutes >= 360) durationScore = 40;
            else durationScore = Math.Max(15, (int)(durationMinutes / 10.0));

            int cycleScore = Math.Min(30, cycles * 6);
            int moodScore = dto.QualityRating switch
            {
                "Energetic" => 20,
                "Normal" => 15,
                _ => 5
            };

            int finalScore = Math.Min(100, durationScore + cycleScore + moodScore);
            var today = DateTime.Today;

            var sleep = await _context.SleepLogs
                .FirstOrDefaultAsync(s => s.UserId == userId && s.SleepDate == today);

            if (sleep == null)
            {
                sleep = new SleepLog
                {
                    UserId = userId,
                    BedTime = dto.BedTime,
                    WakeTime = dto.WakeTime,
                    DurationMinutes = durationMinutes,
                    SleepCycles = cycles,
                    QualityRating = dto.QualityRating,
                    SleepScore = finalScore,
                    SleepDate = today
                };
                _context.SleepLogs.Add(sleep);
            }
            else
            {
                sleep.BedTime = dto.BedTime;
                sleep.WakeTime = dto.WakeTime;
                sleep.DurationMinutes = durationMinutes;
                sleep.SleepCycles = cycles;
                sleep.QualityRating = dto.QualityRating;
                sleep.SleepScore = finalScore;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã lưu giấc ngủ thành công!",
                durationHours = Math.Round(durationMinutes / 60.0, 1),
                sleepCycles = cycles,
                sleepScore = finalScore
            });
        }

        // ==========================================
        // 4. THỰC ĐƠN & RANDOM MÓN ĂN
        // ==========================================
        [HttpGet("meals")]
        public async Task<IActionResult> GetAllMeals([FromQuery] string? type = null)
        {
            var query = _context.Meals.Where(m => m.IsActive);
            if (!string.IsNullOrWhiteSpace(type))
            {
                query = query.Where(m => m.MealType.ToLower() == type.ToLower());
            }
            return Ok(await query.OrderBy(m => m.MealType).ToListAsync());
        }

        [HttpPost("meals")]
        public async Task<IActionResult> CreateMeal([FromBody] MealCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.MealName) || dto.Calories <= 0)
                return BadRequest("Tên món và lượng calo không hợp lệ.");

            var meal = new Meal
            {
                MealName = dto.MealName.Trim(),
                MealType = dto.MealType,
                Calories = dto.Calories,
                Price = dto.Price,
                Tag = string.IsNullOrWhiteSpace(dto.Tag) ? $"{dto.Calories} kcal" : dto.Tag.Trim(),
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

            if (!meals.Any()) meals = await _context.Meals.Where(m => m.IsActive).ToListAsync();
            if (!meals.Any()) return NotFound("Chưa có món ăn trong CSDL.");

            var random = new Random();
            var selected = meals[random.Next(meals.Count)];

            return Ok(selected);
        }

        [HttpPost("apply-today-meal")]
        public async Task<IActionResult> ApplyTodayMeal([FromBody] ApplyMealDto dto, [FromQuery] int userId = 1)
        {
            var meal = await _context.Meals.FindAsync(dto.MealId);
            if (meal == null) return NotFound("Món ăn không tồn tại.");

            var today = DateTime.Today;

            var dailyMeal = await _context.DailyMeals
                .FirstOrDefaultAsync(d => d.UserId == userId && d.MealType.ToLower() == dto.MealType.ToLower() && d.PlanDate == today);

            if (dailyMeal == null)
            {
                dailyMeal = new DailyMeal
                {
                    UserId = userId,
                    MealType = dto.MealType,
                    MealId = dto.MealId,
                    PlanDate = today
                };
                _context.DailyMeals.Add(dailyMeal);
            }
            else
            {
                dailyMeal.MealId = dto.MealId;
            }
            await _context.SaveChangesAsync();

            var todayMealsCalories = await _context.DailyMeals
                .Where(d => d.UserId == userId && d.PlanDate == today)
                .Include(d => d.Meal)
                .SumAsync(d => d.Meal != null ? d.Meal.Calories : 0);

            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking == null)
            {
                tracking = new DailyTracking
                {
                    UserId = userId,
                    TrackingDate = today,
                    CaloriesConsumed = todayMealsCalories,
                    WaterConsumed = 0.0,
                    StepsCount = 0
                };
                _context.DailyTrackings.Add(tracking);
            }
            else
            {
                tracking.CaloriesConsumed = todayMealsCalories;
            }
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Đã áp dụng món {meal.MealName}!",
                totalCaloriesToday = tracking.CaloriesConsumed,
                meal = meal
            });
        }

        [HttpGet("today-meals")]
        public async Task<IActionResult> GetTodayMeals([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var meals = await _context.DailyMeals
                .Where(d => d.UserId == userId && d.PlanDate == today)
                .Include(d => d.Meal)
                .ToListAsync();

            return Ok(new
            {
                Breakfast = meals.FirstOrDefault(m => m.MealType.Equals("Breakfast", StringComparison.OrdinalIgnoreCase))?.Meal,
                Lunch = meals.FirstOrDefault(m => m.MealType.Equals("Lunch", StringComparison.OrdinalIgnoreCase))?.Meal,
                Dinner = meals.FirstOrDefault(m => m.MealType.Equals("Dinner", StringComparison.OrdinalIgnoreCase))?.Meal
            });
        }

        // ==========================================
        // 5. HOẠT ĐỘNG & TẬP LUYỆN
        // ==========================================
        [HttpPost("log-activity")]
        public async Task<IActionResult> LogActivity([FromBody] ActivityCreateDto dto, [FromQuery] int userId = 1)
        {
            if (dto.DurationSeconds <= 0) return BadRequest("Thời gian tập phải lớn hơn 0 giây.");

            double stepsPerSecond = dto.ActivityType switch
            {
                "Running" => 2.5,
                "Walking" => 1.8,
                "Cycling" => 1.5,
                "Gym" => 1.0,
                _ => 1.5
            };

            double caloriesPerSecond = dto.ActivityType switch
            {
                "Running" => 0.16,
                "Cycling" => 0.13,
                "Gym" => 0.11,
                "Walking" => 0.08,
                _ => 0.10
            };

            int totalSteps = (int)Math.Round(dto.DurationSeconds * stepsPerSecond);
            double totalBurned = Math.Round(dto.DurationSeconds * caloriesPerSecond, 1);
            var today = DateTime.Today;

            var activity = new Activity
            {
                UserId = userId,
                ActivityType = dto.ActivityType,
                DurationSeconds = dto.DurationSeconds,
                StepsEquivalent = totalSteps,
                CaloriesBurned = totalBurned,
                LogDate = today
            };
            _context.Activities.Add(activity);

            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking == null)
            {
                tracking = new DailyTracking
                {
                    UserId = userId,
                    TrackingDate = today,
                    StepsCount = totalSteps
                };
                _context.DailyTrackings.Add(tracking);
            }
            else
            {
                tracking.StepsCount += totalSteps;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã ghi nhận buổi tập!",
                durationSeconds = dto.DurationSeconds,
                stepsAdded = totalSteps,
                caloriesBurned = totalBurned,
                totalStepsToday = tracking.StepsCount
            });
        }

        [HttpGet("today-activities")]
        public async Task<IActionResult> GetTodayActivities([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var list = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .OrderByDescending(a => a.ActivityId)
                .ToListAsync();
            return Ok(list);
        }

        [HttpDelete("activities/{id}")]
        public async Task<IActionResult> DeleteActivity(int id, [FromQuery] int userId = 1)
        {
            var act = await _context.Activities.FindAsync(id);
            if (act == null) return NotFound("Không tìm thấy hoạt động.");

            var today = act.LogDate;
            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking != null)
            {
                tracking.StepsCount = Math.Max(0, tracking.StepsCount - act.StepsEquivalent);
            }

            _context.Activities.Remove(act);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa buổi tập thành công!", newTotalSteps = tracking?.StepsCount ?? 0 });
        }

        [HttpPost("reset-today-activities")]
        public async Task<IActionResult> ResetTodayActivities([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            var acts = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate == today)
                .ToListAsync();

            _context.Activities.RemoveRange(acts);

            var tracking = await _context.DailyTrackings
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TrackingDate == today);

            if (tracking != null)
            {
                tracking.StepsCount = 0;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã reset toàn bộ hoạt động hôm nay về 0!" });
        }

        // ==========================================
        // 6. LỊCH TRÌNH TIMELINE
        // ==========================================
        [HttpGet("timelines")]
        public async Task<IActionResult> GetTimelines([FromQuery] int userId = 1)
        {
            var today = DateTime.Today;
            return Ok(await _context.Timelines
                .Where(t => t.UserId == userId && t.PlanDate == today)
                .OrderBy(t => t.TimelineId)
                .ToListAsync());
        }

        [HttpPost("timelines")]
        public async Task<IActionResult> AddTimeline([FromBody] TimelineCreateDto dto, [FromQuery] int userId = 1)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.TimeSlot) || string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest("Vui lòng nhập đầy đủ khung giờ và nội dung.");

            var item = new Timeline
            {
                UserId = userId,
                TimeSlot = dto.TimeSlot.Trim(),
                Title = dto.Title.Trim(),
                Category = string.IsNullOrWhiteSpace(dto.Category) ? "Task" : dto.Category,
                IsCompleted = false,
                PlanDate = DateTime.Today
            };
            _context.Timelines.Add(item);
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpPut("timelines/{id}")]
        public async Task<IActionResult> UpdateTimeline(int id, [FromBody] TimelineCreateDto dto)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound();
            item.TimeSlot = dto.TimeSlot.Trim();
            item.Title = dto.Title.Trim();
            item.Category = dto.Category;
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpPatch("timelines/{id}/toggle")]
        public async Task<IActionResult> ToggleTimeline(int id)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound();
            item.IsCompleted = !item.IsCompleted;
            await _context.SaveChangesAsync();
            return Ok(new { item.TimelineId, item.IsCompleted });
        }

        [HttpDelete("timelines/{id}")]
        public async Task<IActionResult> DeleteTimeline(int id)
        {
            var item = await _context.Timelines.FindAsync(id);
            if (item == null) return NotFound();
            _context.Timelines.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa thành công." });
        }

        // ==========================================
        // 9. API THỐNG KÊ (DATA MINING & VISUALIZATION 7 NGÀY QUA)
        // ==========================================
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics([FromQuery] int userId = 1, [FromQuery] int days = 7)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var startDate = DateTime.Today.AddDays(-days + 1);

            // 1. Dữ liệu calo nạp, nước uống, bước chân từ DailyTrackings
            var trackings = await _context.DailyTrackings
                .Where(t => t.UserId == userId && t.TrackingDate >= startDate)
                .OrderBy(t => t.TrackingDate)
                .ToListAsync();

            // 2. Dữ liệu vận động calo đốt từ Activities
            var activities = await _context.Activities
                .Where(a => a.UserId == userId && a.LogDate >= startDate)
                .ToListAsync();

            // 3. Dữ liệu giấc ngủ từ SleepLogs
            var sleepLogs = await _context.SleepLogs
                .Where(s => s.UserId == userId && s.SleepDate >= startDate)
                .ToListAsync();

            var dateLabels = new List<string>();
            var caloriesIn = new List<int>();
            var caloriesBurned = new List<double>();
            var waterList = new List<double>();
            var stepsList = new List<int>();
            var sleepScores = new List<int>();

            for (int i = 0; i < days; i++)
            {
                var curDate = startDate.AddDays(i);
                string label = curDate.ToString("dd/MM");
                dateLabels.Add(label);

                var track = trackings.FirstOrDefault(t => t.TrackingDate.Date == curDate.Date);
                caloriesIn.Add(track?.CaloriesConsumed ?? 0);
                waterList.Add(Math.Round(track?.WaterConsumed ?? 0.0, 1));
                stepsList.Add(track?.StepsCount ?? 0);

                var burn = activities.Where(a => a.LogDate.Date == curDate.Date).Sum(a => a.CaloriesBurned);
                caloriesBurned.Add(Math.Round(burn, 1));

                var sleep = sleepLogs.FirstOrDefault(s => s.SleepDate.Date == curDate.Date);
                sleepScores.Add(sleep?.SleepScore ?? 0);
            }

            // Quy luật khai phá dữ liệu (Pattern Insight)
            var totalBurn = caloriesBurned.Sum();
            var avgWater = waterList.Count > 0 ? waterList.Average() : 0;
            string insight = totalBurn > 500 && avgWater >= 2.0
                ? "Thói quen rất tích cực: Bạn duy trì lượng nước đều đặn vào các ngày vận động cao!"
                : "Khuyến nghị: Cần tăng cường vận động ít nhất 30 phút/ngày và uống đủ 2L nước để tối ưu hóa năng lượng.";

            return Ok(new
            {
                labels = dateLabels,
                caloriesIn,
                caloriesBurned,
                water = waterList,
                steps = stepsList,
                sleepScores,
                targetCalories = user.TargetCalories,
                targetWater = user.TargetWater,
                insight
            });
        }

        // ==========================================
        // 10. API CẬP NHẬT HỒ SƠ THỂ TRẠNG CÁ NHÂN
        // ==========================================
        [HttpPut("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            user.FullName = dto.FullName.Trim();
            user.Gender = dto.Gender;
            user.Age = dto.Age;
            user.Height = dto.Height;
            user.Weight = dto.Weight;
            user.ActivityLevel = dto.ActivityLevel;
            user.Goal = dto.Goal;

            // Tính lại BMR & TDEE theo logic Mifflin–St Jeor
            double bmr = user.Gender == "Nam"
                ? (10 * user.Weight) + (6.25 * user.Height) - (5 * user.Age) + 5
                : (10 * user.Weight) + (6.25 * user.Height) - (5 * user.Age) - 161;

            double f = user.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55
            };

            double tdee = bmr * f;
            user.TargetCalories = user.Goal switch
            {
                "Giảm cân" => (int)Math.Round(tdee - 500),
                "Tăng cân" => (int)Math.Round(tdee + 400),
                _ => (int)Math.Round(tdee)
            };
            user.TargetWater = Math.Round(user.Weight * 0.035, 1);

            await _context.SaveChangesAsync();
            return Ok(new { message = "Cập nhật hồ sơ thành công!", user });
        }
    }
}