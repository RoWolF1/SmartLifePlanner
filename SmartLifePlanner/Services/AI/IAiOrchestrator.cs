using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Services.AI
{
    public class IAiOrchestrator : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
