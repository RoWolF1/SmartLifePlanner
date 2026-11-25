using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartLifePlanner.Data;
using SmartLifePlanner.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình Database SQL Server
builder.Services.AddDbContext<LifeSmartDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\mssqllocaldb;Database=SmartLifePlannerDB;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;"));

// 2. Cấu hình JWT Authentication (Xác thực người dùng qua Token)
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SmartLifePlanner_Secret_Key_For_Jwt_Authentication_2026_Secure_Token_Key";
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// 3. Kích hoạt hỗ trợ cả MVC Views và Razor Pages
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();

// Đăng ký HttpClient để gọi Gemini API
builder.Services.AddHttpClient();

var app = builder.Build();

// 4. Khởi tạo Database và Seeding dữ liệu tự động
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<LifeSmartDbContext>();
        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Lỗi khi tự động khởi tạo dữ liệu.");
    }
}

// 5. Cấu hình Pipeline Middleware
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// BẮT BUỘC: UseAuthentication phải đứng trước UseAuthorization
app.UseAuthentication();
app.UseAuthorization();

// 6. CẤU HÌNH ĐIỀU HƯỚNG VỀ TRANG CHỦ (Khắc phục triệt để lỗi 404)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
app.MapRazorPages();
app.MapControllers();

app.Run();