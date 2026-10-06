using Microsoft.EntityFrameworkCore;
using SmartLifePlanner.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<LifeSmartDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();
app.MapControllers();

app.Run();