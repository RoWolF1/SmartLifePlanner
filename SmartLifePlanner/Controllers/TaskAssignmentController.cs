using Microsoft.AspNetCore.Mvc;
using SmartLifePlanner.Services;

namespace SmartLifePlanner.Controllers
{
    public class TaskAssignmentController : Controller
    {
        private readonly IGeminiService _geminiService;

        public TaskAssignmentController(IGeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        [HttpGet]
        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> TaoKeHoach(string moTaDuAn, string thanhVien)
        {
            if (string.IsNullOrWhiteSpace(moTaDuAn) || string.IsNullOrWhiteSpace(thanhVien))
            {
                ViewBag.Loi = "Vui lòng nhập đầy đủ mô tả đồ án và danh sách thành viên!";
                return View("Index");
            }

            try
            {
                var ketQua = await _geminiService.PhanCongTaskAsync(moTaDuAn, thanhVien);
                ViewBag.KeHoach = ketQua;
            }
            catch (Exception ex)
            {
                ViewBag.Loi = "Lỗi khi gọi Gemini: " + ex.Message;
            }

            return View("Index");
        }
    }
}