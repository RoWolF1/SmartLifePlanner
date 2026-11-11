using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartLifePlanner.Models;
using System.Net;
using System.Text;
using System.Text.Json;

namespace SmartLifePlanner.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly LifeSmartDbContext _context;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;

        public ChatController(LifeSmartDbContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _config = config;
            _httpClientFactory = httpClientFactory;
        }

        public class ChatRequestDto
        {
            public int UserId { get; set; } = 1;
            public string Message { get; set; } = string.Empty;
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetChatHistory([FromQuery] int userId = 1)
        {
            var history = await _context.ChatMessages
                .Where(c => c.UserId == userId)
                .OrderBy(c => c.CreatedAt)
                .Take(50)
                .Select(c => new
                {
                    c.MessageId,
                    c.Sender,
                    c.MessageText,
                    Time = c.CreatedAt.ToString("HH:mm")
                })
                .ToListAsync();

            return Ok(history);
        }

        [HttpPost("ask")]
        public async Task<IActionResult> AskAi([FromBody] ChatRequestDto req)
        {
            if (string.IsNullOrWhiteSpace(req.Message))
                return BadRequest("Tin nhắn không được để trống.");

            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == req.UserId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            var today = DateTime.Today;
            var tomorrow = today.AddDays(1);

            // 1. TÍNH TOÁN SINH TRẮC & CHUYỂN HÓA
            double heightM = user.Height / 100.0;
            double bmi = Math.Round(user.Weight / (heightM * heightM), 1);
            double bmr = (user.Gender == "Nam")
                ? (10 * user.Weight + 6.25 * user.Height - 5 * user.Age + 5)
                : (10 * user.Weight + 6.25 * user.Height - 5 * user.Age - 161);

            int targetCalories = user.TargetCalories > 0 ? user.TargetCalories : 2150;

            // 2. DỮ LIỆU ĂN UỐNG HÔM NAY
            var todayMeals = await _context.DailyMeals
                .Where(dm => dm.UserId == req.UserId && dm.PlanDate == today)
                .Include(dm => dm.Meal)
                .ToListAsync();

            int caloConsumedToday = todayMeals.Sum(m => m.Meal?.Calories ?? 0);
            int remainingCaloriesToday = Math.Max(0, targetCalories - caloConsumedToday);

            var mealNamesToday = todayMeals.Select(m => $"{m.MealType}: {m.Meal?.MealName} ({m.Meal?.Calories} kcal)").ToList();
            string eatenSummaryToday = mealNamesToday.Any() ? string.Join(", ", mealNamesToday) : "Chưa có món nào được ghi nhận";

            // 3. DỮ LIỆU KẾ HOẠCH NGÀY MAI (ĐỂ AI BIẾT TRƯA MAI/TỐI MAI ĐÃ LÊN ĐƠN CHƯA)
            var tomorrowMeals = await _context.DailyMeals
                .Where(dm => dm.UserId == req.UserId && dm.PlanDate == tomorrow)
                .Include(dm => dm.Meal)
                .ToListAsync();

            var mealNamesTomorrow = tomorrowMeals.Select(m => $"{m.MealType}: {m.Meal?.MealName} ({m.Meal?.Calories} kcal)").ToList();
            string planTomorrowSummary = mealNamesTomorrow.Any() ? string.Join(", ", mealNamesTomorrow) : "Chưa lên lịch món nào cho ngày mai";

            // 4. KHO MÓN ĂN TRONG HỆ THỐNG
            var allActiveMeals = await _context.Meals.Where(m => m.IsActive).ToListAsync();
            var availableLunchMeals = allActiveMeals.Where(m => m.MealType.ToLower() == "lunch").Take(8).ToList();
            var availableDinnerMeals = allActiveMeals.Where(m => m.MealType.ToLower() == "dinner").Take(8).ToList();

            string lunchInDb = string.Join(" | ", availableLunchMeals.Select(m => $"{m.MealName} ({m.Calories} kcal, {m.Price:N0}đ)"));
            string dinnerInDb = string.Join(" | ", availableDinnerMeals.Select(m => $"{m.MealName} ({m.Calories} kcal, {m.Price:N0}đ)"));

            // 5. NGỮ CẢNH HỘI THOẠI GẦN ĐÂY
            var recentChats = await _context.ChatMessages
                .Where(c => c.UserId == req.UserId)
                .OrderByDescending(c => c.CreatedAt)
                .Take(4)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            var conversationContext = new StringBuilder();
            foreach (var chat in recentChats)
            {
                conversationContext.AppendLine($"{(chat.Sender == "User" ? "Người dùng" : "LifeSmart AI")}: {chat.MessageText}");
            }

            // 6. ĐÓNG GÓI SYSTEM PROMPT TOÀN DIỆN
            string systemPrompt = $@"
Bạn là Trợ lý Dinh dưỡng & Huấn luyện viên Lối sống AI của hệ sinh thái LifeSmart.
Bạn đang trò chuyện trực tiếp với người dùng và có quyền truy cập vào thông tin thể trạng thực tế của họ trong hệ thống:

[THÔNG TIN NGƯỜI DÙNG]:
- Họ tên: {user.FullName} ({user.Gender}, {user.Age} tuổi)
- Chiều cao: {user.Height} cm, Cân nặng: {user.Weight} kg -> Chỉ số BMI: {bmi}
- Năng lượng nền BMR: {bmr:N0} kcal
- Mức vận động: {user.ActivityLevel} | Mục tiêu: {user.Goal}
- Mục tiêu calo mỗi ngày: {targetCalories} kcal

[TIẾN TRÌNH THỰC TẾ HÔM NAY]:
- Các món đã ăn hôm nay: {eatenSummaryToday}
- Tổng calo hôm nay: {caloConsumedToday} kcal | Calo còn thiếu: {remainingCaloriesToday} kcal

[KẾ HOẠCH NGÀY MAI]:
- Tiến trình thực đơn ngày mai: {planTomorrowSummary}

[KHO MÓN ĂN TRƯA CÓ SẴN]:
{lunchInDb}

[KHO MÓN ĂN TỐI CÓ SẴN]:
{dinnerInDb}

[NGỮ CẢNH CÁC CÂU CHAT GẦN ĐÂY]:
{conversationContext}

[QUY TẮC PHẢN HỒI]:
1. Luôn chào thân thiện, xưng hô là 'LifeSmart AI' hoặc 'Mình' và gọi người dùng là '{user.FullName.Split(' ').Last()}'.
2. Nếu người dùng hỏi về ngày mai (bữa sáng, trưa mai, tối mai), hãy dựa vào mục tiêu calo ({targetCalories} kcal) và phân bổ: Bữa sáng ~25%, Bữa trưa ~40% (~{(int)(targetCalories * 0.4)} kcal), Bữa tối ~35%. Ưu tiên đề xuất cụ thể các món trong kho thực đơn.
3. Phân tích súc tích, ngắn gọn, khoa học theo chuẩn viện dinh dưỡng (dưới 3 đoạn văn).
";

            string apiKey = (_config["GeminiConfig:ApiKey"] ?? "").Trim();
            string configuredModel = (_config["GeminiConfig:Model"] ?? "gemini-3.8-flash").Trim();

            // Hàm tạo câu trả lời dự phòng thông minh cục bộ khi Google quá tải (503 / 429 / Timeout)
            string GenerateLocalFallbackResponse()
            {
                string msgLower = req.Message.ToLower();
                string userName = user.FullName.Split(' ').Last();

                if (msgLower.Contains("mai"))
                {
                    // Người dùng hỏi về ngày mai (trưa mai, tối mai, ngày mai ăn gì)
                    var pickMeal = availableLunchMeals.OrderBy(x => Guid.NewGuid()).FirstOrDefault()
                                   ?? allActiveMeals.FirstOrDefault();
                    string mealName = pickMeal != null ? $"{pickMeal.MealName} ({pickMeal.Calories} kcal)" : "Cơm gà xối mỡ & canh cải";
                    int targetLunch = (int)Math.Round(targetCalories * 0.40);

                    return $"Chào {userName}! Để chuẩn bị cho ngày mai đạt mục tiêu {targetCalories} kcal, bữa trưa nên chiếm khoảng 40% năng lượng (~{targetLunch} kcal). " +
                           $"Gợi ý món trưa mai cho bạn là: **{mealName}**. Món này cung cấp đủ carbs phức và protein để bạn duy trì năng lượng học tập và làm việc suốt buổi chiều!";
                }
                else if (msgLower.Contains("tối"))
                {
                    // Hỏi về bữa tối
                    var pickDinner = availableDinnerMeals.OrderBy(x => Guid.NewGuid()).FirstOrDefault()
                                     ?? allActiveMeals.FirstOrDefault();
                    string dinnerName = pickDinner != null ? $"{pickDinner.MealName} ({pickDinner.Calories} kcal)" : "Salad ức gà sốt mè";

                    return $"Chào {userName}! Hôm nay bạn đã nạp {caloConsumedToday} kcal, còn thiếu khoảng {remainingCaloriesToday} kcal để chạm mục tiêu {targetCalories} kcal. " +
                           $"Tối nay bạn nên ưu tiên món nhẹ nhàng, giàu đạm như: **{dinnerName}** để cơ thể hồi phục tốt nhất mà không gây đầy bụng trước khi ngủ nhé!";
                }
                else
                {
                    // Lời khuyên chung
                    return $"Chào {userName}! Hôm nay bạn đã tiêu thụ {caloConsumedToday}/{targetCalories} kcal (còn thiếu khoảng {remainingCaloriesToday} kcal). " +
                           $"Chỉ số BMR của bạn là {bmr:N0} kcal. Bạn có muốn LifeSmart AI lên thực đơn chi tiết cho bữa tiếp theo không?";
                }
            }

            var handler = new SocketsHttpHandler
            {
                PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                UseProxy = false,
                EnableMultipleHttp2Connections = true
            };

            using var client = new HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(15);

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = $"{systemPrompt}\n\n[CÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG]: {req.Message}" }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.3,
                    maxOutputTokens = 600
                }
            };

            string endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{configuredModel}:generateContent?key={apiKey}";
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            try
            {
                var response = await client.PostAsync(endpoint, content);
                var jsonStr = await response.Content.ReadAsStringAsync();

                // Nếu Google bị 503 (quá tải), 429 (hạn mức) -> Tự động dùng fallback trả lời người dùng ngay, không báo lỗi
                if (response.StatusCode == HttpStatusCode.ServiceUnavailable ||
                    response.StatusCode == (HttpStatusCode)429 ||
                    (int)response.StatusCode >= 500)
                {
                    string fallbackAiReply = GenerateLocalFallbackResponse();
                    await SaveChatMessage(req.UserId, "User", req.Message);
                    await SaveChatMessage(req.UserId, "AI", fallbackAiReply);

                    return Ok(new
                    {
                        reply = fallbackAiReply,
                        time = DateTime.Now.ToString("HH:mm")
                    });
                }

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest($"Lỗi từ Google AI (Status {response.StatusCode}): {jsonStr}");
                }

                using var doc = JsonDocument.Parse(jsonStr);
                string aiReply = "Mô hình không trả về nội dung.";

                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var contentElem) &&
                    contentElem.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textElem))
                {
                    aiReply = textElem.GetString() ?? aiReply;
                }

                await SaveChatMessage(req.UserId, "User", req.Message);
                await SaveChatMessage(req.UserId, "AI", aiReply);

                return Ok(new
                {
                    reply = aiReply,
                    time = DateTime.Now.ToString("HH:mm")
                });
            }
            catch (Exception)
            {
                // Khi mạng rớt hoặc timeout
                string safeReply = GenerateLocalFallbackResponse();
                await SaveChatMessage(req.UserId, "User", req.Message);
                await SaveChatMessage(req.UserId, "AI", safeReply);

                return Ok(new
                {
                    reply = safeReply,
                    time = DateTime.Now.ToString("HH:mm")
                });
            }
        }

        private async Task SaveChatMessage(int userId, string sender, string text)
        {
            var msg = new ChatMessage
            {
                UserId = userId,
                Sender = sender,
                MessageText = text,
                CreatedAt = DateTime.Now
            };
            _context.ChatMessages.Add(msg);
            await _context.SaveChangesAsync();
        }
    }
}