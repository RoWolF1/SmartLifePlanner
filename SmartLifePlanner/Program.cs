using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartLifePlanner.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Đăng ký CSDL
builder.Services.AddDbContext<LifeSmartDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Cấu hình JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SmartLifePlanner_Secret_Key_For_Jwt_Authentication_2026_Secure_Token_Key";
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
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

// 3. Middleware phục vụ Static Files & Default Files
// BẮT BUỘC: app.UseDefaultFiles() phải đứng TRƯỚC app.UseStaticFiles()
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();

// 4. Thứ tự Middleware xác thực & phân quyền
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();