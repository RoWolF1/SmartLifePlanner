using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View(); // Tự động tìm và mở file Views/Home/Index.cshtml
        }
    }
}