using Microsoft.EntityFrameworkCore;
using SmartLifePlanner.Data;
using SmartLifePlanner.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình Database SQL Server
builder.Services.AddDbContext<LifeSmartDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\mssqllocaldb;Database=SmartLifePlannerDB;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;"));

// 2. Kích hoạt hỗ trợ cả MVC Views và Razor Pages
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();

var app = builder.Build();

// 3. Khởi tạo Database và Seeding dữ liệu tự động
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

// 4. Cấu hình Pipeline Middleware
app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();

// 5. CẤU HÌNH ĐIỀU HƯỚNG VỀ TRANG CHỦ (Khắc phục triệt để lỗi 404)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapRazorPages();
app.MapControllers();

app.Run();