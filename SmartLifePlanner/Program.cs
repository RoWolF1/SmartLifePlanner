var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

// 1. Tự động nhận diện index.html làm trang mặc định
app.UseDefaultFiles();

// 2. Phục vụ toàn bộ CSS, JS, ảnh trong thư mục wwwroot
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();
app.MapControllers();

app.Run();