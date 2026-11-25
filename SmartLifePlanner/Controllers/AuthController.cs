using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartLifePlanner.Models;
using System.Net;
using System.Net.Mail;

namespace SmartLifePlanner.Controllers
{
    public class RegisterDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Gender { get; set; } = "Nam";
        public int Age { get; set; } = 20;
        public double Height { get; set; }
        public double Weight { get; set; }
        public string ActivityLevel { get; set; } = "Vận động vừa";
        public string Goal { get; set; } = "Duy trì";
    }

    public class LoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto
    {
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordDto
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly LifeSmartDbContext _context;
        private readonly IConfiguration _config;
        private static readonly Dictionary<string, (string Otp, DateTime ExpireAt)> _otpStore = new();

        public AuthController(LifeSmartDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ==========================================
        // 1. ĐĂNG KÝ TÀI KHOẢN (BẮT BUỘC ĐỦ SINH TRẮC)
        // ==========================================
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Họ tên, email và mật khẩu không được để trống.");

            if (dto.Age <= 0 || dto.Height <= 0 || dto.Weight <= 0)
                return BadRequest("Vui lòng nhập đầy đủ các thông số thể trạng (Tuổi, Chiều cao, Cân nặng).");

            var exists = await _context.Users.AnyAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower());
            if (exists) return BadRequest("Email này đã được đăng ký tài khoản.");

            // Công thức Mifflin–St Jeor (1990)
            double bmr = dto.Gender == "Nam"
                ? (10 * dto.Weight) + (6.25 * dto.Height) - (5 * dto.Age) + 5
                : (10 * dto.Weight) + (6.25 * dto.Height) - (5 * dto.Age) - 161;

            double f = dto.ActivityLevel switch
            {
                "Ít vận động" => 1.20,
                "Vận động nhẹ" => 1.375,
                "Vận động nhiều" => 1.725,
                "Rất nhiều" => 1.90,
                _ => 1.55
            };

            double tdee = bmr * f;

            int targetCalo = dto.Goal switch
            {
                "Giảm cân" => (int)Math.Round(tdee - 500),
                "Tăng cân" => (int)Math.Round(tdee + 400),
                _ => (int)Math.Round(tdee)
            };

            double targetWater = Math.Round(dto.Weight * 0.035, 1);
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
                RoleId = 1
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
        // 2. ĐĂNG NHẬP (CẤP JWT TOKEN)
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

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "SmartLifePlanner_Secret_Key_For_Jwt_Authentication_2026_Secure_Token_Key");

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.Name, user.FullName ?? string.Empty),
                new Claim(ClaimTypes.Role, roleName)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
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
        // 3. QUÊN MẬT KHẨU: GỬI MÃ OTP
        // ==========================================
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest("Vui lòng nhập địa chỉ email.");

            string emailClean = dto.Email.Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailClean);
            if (user == null)
                return NotFound("Email này chưa được đăng ký trong hệ sinh thái LifeSmart.");

            // 1. Tạo mã OTP ngẫu nhiên 6 chữ số
            string otp = new Random().Next(100000, 999999).ToString();
            _otpStore[emailClean] = (otp, DateTime.Now.AddMinutes(10));

            // 2. Gửi Email thật qua SMTP Gmail
            try
            {
                var smtpServer = _config["EmailSettings:SmtpServer"] ?? "smtp.gmail.com";
                int port = int.Parse(_config["EmailSettings:Port"] ?? "587");
                var senderEmail = _config["EmailSettings:SenderEmail"] ?? "";
                var senderPassword = _config["EmailSettings:SenderPassword"] ?? "";
                var senderName = _config["EmailSettings:SenderName"] ?? "LifeSmart AI";

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(senderEmail, senderName),
                    Subject = $"[LifeSmart] Mã xác nhận khôi phục mật khẩu: {otp}",
                    IsBodyHtml = true,
                    Body = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;'>
                            <div style='text-align: center; margin-bottom: 20px;'>
                                <span style='font-size: 36px;'>🥕</span>
                                <h2 style='color: #0f172a; margin: 8px 0;'>LifeSmart Security</h2>
                            </div>
                            <p style='color: #334155; font-size: 15px;'>Xin chào <strong>{user.FullName}</strong>,</p>
                            <p style='color: #475569; font-size: 14px; line-height: 1.5;'>
                                Bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản LifeSmart. Dưới đây là mã xác thực OTP của bạn:
                            </p>
                            <div style='text-align: center; margin: 24px 0;'>
                                <span style='display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #059669; background: #ecfdf5; padding: 12px 28px; border-radius: 8px; border: 1px dashed #10b981;'>
                                    {otp}
                                </span>
                            </div>
                            <p style='color: #64748b; font-size: 13px; line-height: 1.5;'>
                                Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email để đảm bảo an toàn.
                            </p>
                            <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;' />
                            <small style='color: #94a3b8; font-size: 12px; display: block; text-align: center;'>Hệ sinh thái Quản lý Lối sống & Dinh dưỡng Chuẩn Y khoa</small>
                        </div>"
                };

                mailMessage.To.Add(new MailAddress(user.Email));

                using var smtpClient = new SmtpClient(smtpServer, port)
                {
                    Credentials = new NetworkCredential(senderEmail, senderPassword),
                    EnableSsl = true,
                    Timeout = 15000
                };

                await smtpClient.SendMailAsync(mailMessage);

                // Trả về thông báo sạch, không lộ mã OTP trên màn hình
                return Ok(new
                {
                    message = $"Mã OTP xác thực đã được gửi tới email {dto.Email}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam)!"
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Không thể gửi email xác thực: {ex.Message}");
            }
        }

        // ==========================================
        // 4. ĐẶT LẠI MẬT KHẨU MỚI (VERIFY OTP)
        // ==========================================
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Otp) || string.IsNullOrWhiteSpace(dto.NewPassword))
                return BadRequest("Vui lòng điền đầy đủ email, mã OTP và mật khẩu mới.");

            string emailClean = dto.Email.Trim().ToLower();
            if (!_otpStore.ContainsKey(emailClean) || _otpStore[emailClean].ExpireAt < DateTime.Now)
                return BadRequest("Mã OTP không hợp lệ hoặc đã quá hạn.");

            if (_otpStore[emailClean].Otp != dto.Otp.Trim())
                return BadRequest("Mã xác nhận OTP không đúng.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailClean);
            if (user == null) return NotFound("Người dùng không tồn tại.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();

            _otpStore.Remove(emailClean);
            return Ok(new { message = "Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới." });
        }

        // ==========================================
        // 5. XEM PROFILE CÁ NHÂN THEO TOKEN
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

            double heightM = user.Height / 100.0;
            double bmi = heightM > 0 ? Math.Round(user.Weight / (heightM * heightM), 2) : 0;
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
                naturalBurnDesc = $"{user.Gender} {user.Age} tuổi, cao {user.Height}cm, nặng {user.Weight}kg thì dù nằm nghỉ cả ngày vẫn đốt tự nhiên khoảng {Math.Round(bmr):N0} kcal"
            });
        }
    }
}