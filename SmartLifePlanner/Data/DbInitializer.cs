using SmartLifePlanner.Models;

namespace SmartLifePlanner.Data
{
    public static class DbInitializer
    {
        public static void Initialize(LifeSmartDbContext context)
        {
            context.Database.EnsureCreated();

            // 1. Khởi tạo Bảng Roles nếu trống
            if (!context.Roles.Any())
            {
                context.Roles.AddRange(
                    new Role { RoleId = 1, RoleName = "User" },
                    new Role { RoleId = 2, RoleName = "Admin" }
                );
                context.SaveChanges();
            }

            // 2. Khởi tạo User mặc định nếu trống
            if (!context.Users.Any())
            {
                context.Users.Add(new User
                {
                    UserId = 1,
                    FullName = "Dương Thu Hậu",
                    Email = "hauduong0808@gmail.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                    Gender = "Nam",
                    Age = 20,
                    Height = 173.0,
                    Weight = 60.0,
                    ActivityLevel = "Vận động vừa",
                    Goal = "Duy trì",
                    TargetCalories = 2150,
                    TargetWater = 2.3,
                    RoleId = 1
                });
                context.SaveChanges();
            }

            // 3. Khởi tạo Món ăn (Khớp đúng cấu trúc bảng Meals trong SQL)
            if (!context.Meals.Any())
            {
                var meals = new List<Meal>
                {
                    new Meal { MealName = "Bánh mì trứng & pate", MealType = "Breakfast", Calories = 380, Price = 25000, Tag = "Giàu protein • 07:30", IsActive = true },
                    new Meal { MealName = "Phở bò tái lăn", MealType = "Breakfast", Calories = 480, Price = 45000, Tag = "Nước dùng nóng • 07:30", IsActive = true },
                    new Meal { MealName = "Yến mạch chuối hạt chia", MealType = "Breakfast", Calories = 290, Price = 30000, Tag = "Eat clean • 07:30", IsActive = true },
                    new Meal { MealName = "Cơm gà xối mỡ & dưa chuột", MealType = "Lunch", Calories = 620, Price = 35000, Tag = "Cân bằng dinh dưỡng • 12:00", IsActive = true },
                    new Meal { MealName = "Bún chả Hà Nội", MealType = "Lunch", Calories = 550, Price = 40000, Tag = "Đậm đà • 12:00", IsActive = true },
                    new Meal { MealName = "Cơm sườn nướng mật ong", MealType = "Lunch", Calories = 590, Price = 45000, Tag = "Nhiều năng lượng • 12:00", IsActive = true },
                    new Meal { MealName = "Salad ức gà áp chảo", MealType = "Lunch", Calories = 380, Price = 40000, Tag = "Giảm mỡ • 12:00", IsActive = true },
                    new Meal { MealName = "Cá kho tộ & canh cải xanh", MealType = "Dinner", Calories = 440, Price = 35000, Tag = "Ít chất béo • 18:30", IsActive = true },
                    new Meal { MealName = "Thịt luộc cà pháo & canh ngao", MealType = "Dinner", Calories = 410, Price = 35000, Tag = "Thanh nhiệt • 18:30", IsActive = true },
                    new Meal { MealName = "Đậu hũ sốt cà chua & rau luộc", MealType = "Dinner", Calories = 320, Price = 25000, Tag = "Dễ tiêu hóa • 18:30", IsActive = true }
                };
                context.Meals.AddRange(meals);
                context.SaveChanges();
            }

            // 4. Khởi tạo Timelines hôm nay
            var today = DateTime.Today;
            if (!context.Timelines.Any(t => t.PlanDate == today))
            {
                var defaultTimelines = new List<Timeline>
                {
                    new Timeline { UserId = 1, TimeSlot = "07:00 - 07:15", Title = "Thức dậy & Uống 300ml nước ấm (Kích hoạt chuyển hóa)", Category = "Rest", IsCompleted = true, PlanDate = today },
                    new Timeline { UserId = 1, TimeSlot = "07:30 - 08:00", Title = "Bữa sáng dinh dưỡng khởi động ngày mới", Category = "Meal", IsCompleted = true, PlanDate = today },
                    new Timeline { UserId = 1, TimeSlot = "12:00 - 12:45", Title = "Bữa trưa cân bằng đa lượng theo gợi ý AI", Category = "Meal", IsCompleted = false, PlanDate = today },
                    new Timeline { UserId = 1, TimeSlot = "17:30 - 18:15", Title = "Khung giờ vàng thể thao: Đi bộ / Tập luyện đốt calo", Category = "Task", IsCompleted = false, PlanDate = today },
                    new Timeline { UserId = 1, TimeSlot = "22:45 - 23:00", Title = "Thư giãn, chuẩn bị ngủ sâu đủ 5 chu kỳ 90 phút", Category = "Rest", IsCompleted = false, PlanDate = today }
                };
                context.Timelines.AddRange(defaultTimelines);
                context.SaveChanges();
            }

            // 5. Khởi tạo Lịch sử 7 ngày (Đã sửa lỗi phép nhân)
            if (!context.DailyTrackings.Any())
            {
                for (int i = 6; i >= 1; i--)
                {
                    var d = today.AddDays(-i);
                    context.DailyTrackings.Add(new DailyTracking
                    {
                        UserId = 1,
                        TrackingDate = d,
                        CaloriesConsumed = 1950 + (i * 45) % 300,
                        WaterConsumed = Math.Round(2.1 + (i % 3) * 0.15, 1),
                        StepsCount = 4600 + (i * 650)
                    });
                }

                // Dữ liệu ngày hôm nay
                context.DailyTrackings.Add(new DailyTracking
                {
                    UserId = 1,
                    TrackingDate = today,
                    CaloriesConsumed = 0,
                    WaterConsumed = 0.0,
                    StepsCount = 0
                });

                context.SaveChanges();
            }

            // 6. Khởi tạo bản ghi Giấc ngủ hôm nay
            if (!context.SleepLogs.Any(s => s.SleepDate == today))
            {
                context.SleepLogs.Add(new SleepLog
                {
                    UserId = 1,
                    BedTime = today.AddDays(-1).AddHours(23),
                    WakeTime = today.AddHours(6).AddMinutes(30),
                    DurationMinutes = 450, // 7.5 tiếng
                    SleepCycles = 5,
                    QualityRating = "Energetic",
                    SleepScore = 92,
                    SleepDate = today,
                    CreatedAt = DateTime.Now
                });
                context.SaveChanges();
            }

            // 7. Khởi tạo Tin nhắn chào mừng mặc định của Chatbot AI nếu bảng trống
            if (!context.ChatMessages.Any())
            {
                context.ChatMessages.Add(new ChatMessage
                {
                    UserId = 1,
                    Sender = "AI",
                    MessageText = "Xin chào Hậu 👋! Mình là trợ lý dinh dưỡng AI của LifeSmart. Mình có thể hỗ trợ gì cho chế độ dinh dưỡng và lối sống hôm nay của bạn?",
                    CreatedAt = DateTime.Now
                });
                context.SaveChanges();
            }
        }
    }
}