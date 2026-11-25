using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Services.AI
{
    public class IAiModelClient : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
