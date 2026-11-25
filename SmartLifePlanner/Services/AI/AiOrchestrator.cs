using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Services.AI
{
    public class AiOrchestrator : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
