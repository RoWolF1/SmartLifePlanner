using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartLifePlanner.Models;

namespace SmartLifePlanner.Controllers
{
    public class RegisterDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Gender { get; set; } = "Nam"; // Nam / Nữ
        public int Age { get; set; } = 20;
        public double Height { get; set; } // cm
        public double Weight { get; set; } // kg
        public string ActivityLevel { get; set; } = "Vận động vừa"; // Ít vận động, Vận động nhẹ, Vận động vừa, Vận động nhiều, Rất nhiều
        public string Goal { get; set; } = "Duy trì"; // Giảm cân, Duy trì, Tăng cân
    }

    public class LoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly LifeSmartDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(LifeSmartDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ==========================================
        // 1. ĐĂNG KÝ TÀI KHOẢN (BẢO MẬT BCRYPT + LOGIC BMR/TDEE)
        // ==========================================
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Email và mật khẩu không được để trống.");

            var exists = await _context.Users.AnyAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower());
            if (exists) return BadRequest("Email này đã được đăng ký tài khoản.");

            // Áp dụng công thức BMR của Thành viên 3 (Mifflin–St Jeor)
            double bmr = dto.Gender == "Nam"
                ? (10 * dto.Weight) + (6.25 * dto.Height) - (5 * dto.Age) + 5
                : (10 * dto.Weight) + (6.25 * dto.Height) - (5 * dto.Age) - 161;

            // Hệ số hoạt động F
            double f = dto.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55 // Vận động vừa
            };

            double tdee = bmr * f;

            // Mục tiêu calo theo định hướng
            int targetCalo = dto.Goal switch
            {
                "Giảm cân" => (int)Math.Round(tdee - 500),
                "Tăng cân" => (int)Math.Round(tdee + 400),
                _ => (int)Math.Round(tdee)
            };

            // Mục tiêu nước: Cân nặng x 0.035
            double targetWater = Math.Round(dto.Weight * 0.035, 1);

            // Băm mật khẩu bằng BCrypt (Bảo mật tuyệt đối, chống lộ plain text trong DB)
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var user = new User
            {
                FullName = dto.FullName.Trim(),
                Email = dto.Email.Trim().ToLower(),
                PasswordHash = passwordHash,
                Gender = dto.Gender,
                Age = dto.Age,
                Height = dto.Height,
                Weight = dto.Weight,
                ActivityLevel = dto.ActivityLevel,
                Goal = dto.Goal,
                TargetCalories = targetCalo,
                TargetWater = targetWater,
                RoleId = 1 // Mặc định là User thường
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đăng ký tài khoản thành công!",
                bmrEstimated = Math.Round(bmr, 1),
                tdeeEstimated = Math.Round(tdee, 1),
                targetCalories = targetCalo
            });
        }

        // ==========================================
        // 2. ĐĂNG NHẬP (TRẢ VỀ GÓI TIN JWT TOKEN)
        // ==========================================
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower());

            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized(new { message = "Email hoặc mật khẩu không chính xác!" });

            var roleName = user.Role?.RoleName ?? "User";

            // Tạo Token JWT
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "SmartLifePlanner_Secret_Key_For_Jwt_Authentication_2026_Secure_Token_Key");

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Name, user.FullName),
                    new Claim(ClaimTypes.Role, roleName)
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwtString = tokenHandler.WriteToken(token);

            return Ok(new
            {
                token = jwtString,
                role = roleName,
                user = new
                {
                    user.UserId,
                    user.FullName,
                    user.Email,
                    role = roleName
                }
            });
        }

        // ==========================================
        // 3. XEM THÔNG TIN CÁ NHÂN (YÊU CẦU JWT AUTHORIZED)
        // ==========================================
        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            // Tính toán lại BMR, BMI, TDEE theo logic Thành viên 3
            double heightM = user.Height / 100.0;
            double bmi = Math.Round(user.Weight / (heightM * heightM), 2);
            string bmiCategory = bmi < 18.5 ? "Thiếu cân" : bmi < 25 ? "Bình thường" : bmi < 30 ? "Thừa cân" : "Béo phì";

            double bmr = user.Gender == "Nam"
                ? (10 * user.Weight) + (6.25 * user.Height) - (5 * user.Age) + 5
                : (10 * user.Weight) + (6.25 * user.Height) - (5 * user.Age) - 161;

            double f = user.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55
            };
            double tdee = bmr * f;

            return Ok(new
            {
                user.UserId,
                user.FullName,
                user.Email,
                role = user.Role?.RoleName ?? "User",
                user.Gender,
                user.Age,
                user.Height,
                user.Weight,
                user.ActivityLevel,
                user.Goal,
                user.TargetWater,
                user.TargetCalories,
                bmi = bmi,
                bmiCategory = bmiCategory,
                bmr = Math.Round(bmr, 1),
                tdee = Math.Round(tdee, 1),
                naturalBurnDesc = $"{user.Gender} {user.Age} tuổi, cao {user.Height}cm, nặng {user.Weight}kg thì dù nằm ngủ cả ngày vẫn đốt tự nhiên khoảng {Math.Round(bmr):N0} kcal"
            });
        }
    }
}