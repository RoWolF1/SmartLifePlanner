using Microsoft.AspNetCore.Mvc;

namespace SmartLifePlanner.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LifestyleController : ControllerBase
    {
        // Danh sách kho món ăn mẫu phục vụ cho tính năng Random
        private static readonly List<dynamic> Meals = new()
        {
            new { Id = 1, Name = "Bánh mì trứng xúc xích", Type = "Breakfast", Calories = 380, Price = 25000 },
            new { Id = 2, Name = "Phở bò tái lăn", Type = "Breakfast", Calories = 450, Price = 40000 },
            new { Id = 3, Name = "Cơm gà xối mỡ + Rau cải", Type = "Lunch", Calories = 620, Price = 35000 },
            new { Id = 4, Name = "Bún chả Hà Nội", Type = "Lunch", Calories = 550, Price = 40000 },
            new { Id = 5, Name = "Cá kho tộ + Canh rau củ", Type = "Dinner", Calories = 450, Price = 30000 },
            new { Id = 6, Name = "Thịt luộc cà pháo + Canh cua", Type = "Dinner", Calories = 480, Price = 35000 }
        };

        // API Random món ăn theo bữa: /api/lifestyle/random-meal?mealType=Lunch
        [HttpGet("random-meal")]
        public IActionResult GetRandomMeal([FromQuery] string mealType = "Lunch")
        {
            var filtered = Meals.Where(m => string.Equals((string)m.Type, mealType, StringComparison.OrdinalIgnoreCase)).ToList();
            if (!filtered.Any())
            {
                filtered = Meals;
            }

            var random = new Random();
            var selectedMeal = filtered[random.Next(filtered.Count)];
            return Ok(selectedMeal);
        }
    }
}