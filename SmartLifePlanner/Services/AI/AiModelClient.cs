using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Services.AI
{
    public class AiModelClient : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
