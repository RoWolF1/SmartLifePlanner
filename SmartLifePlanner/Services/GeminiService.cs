using System.Text;
using System.Text.Json;

namespace SmartLifePlanner.Services
{
    public interface IGeminiService
    {
        Task<string> PhanCongTaskAsync(string moTaDuAn, string danhSachThanhVien);
    }

    public class GeminiService : IGeminiService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _model;

        public GeminiService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _apiKey = config["GeminiSettings:ApiKey"] ?? string.Empty;
            _model = config["GeminiSettings:Model"] ?? "gemini-2.5-flash";
        }

        public async Task<string> PhanCongTaskAsync(string moTaDuAn, string danhSachThanhVien)
        {
            string url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";

            string prompt = $@"
Bạn là nhóm trưởng kỹ thuật IT. Hãy phân chia dự án thành đúng 3 tuần làm việc (mỗi tuần 1 task/milestone chính) cho các thành viên:
- Mô tả dự án: {moTaDuAn}
- Danh sách thành viên: {danhSachThanhVien}

Yêu cầu phân chia chi tiết, rõ ràng theo đúng cấu trúc sau để nhóm đưa lên GitHub Issues:
### Tuần 1: Thiết kế CSDL, Setup Framework và Luồng dữ liệu nền tảng
- [Tên thành viên]: Nhiệm vụ chi tiết cụ thể (các bảng, file cần làm)
### Tuần 2: Xây dựng Backend Logic, REST API và Chức năng cốt lõi
- [Tên thành viên]: Nhiệm vụ chi tiết cụ thể (Controller, Service cần viết)
### Tuần 3: Hoàn thiện Giao diện, Test kiểm thử và Báo cáo đồ án
- [Tên thành viên]: Nhiệm vụ chi tiết cụ thể (Giao diện View, Test lỗi, Tài liệu)
";

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, jsonContent);

            if (!response.IsSuccessStatusCode)
            {
                string errorBody = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Lỗi gọi Gemini API ({response.StatusCode}): {errorBody}");
            }

            string responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);

            var result = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            return result ?? "Không nhận được phản hồi từ AI.";
        }
    }
}