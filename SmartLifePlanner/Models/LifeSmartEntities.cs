using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SmartLifePlanner.Models
{
    [Table("Roles")]
    public class Role
    {
        [Key]
        public int RoleId { get; set; }
        public string RoleName { get; set; } = string.Empty;
    }

    [Table("Users")]
    public class User
    {
        [Key]
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public double Height { get; set; }
        public double Weight { get; set; }
        public double TargetWater { get; set; } = 2.5;
        public int TargetCalories { get; set; } = 2000;
        public int RoleId { get; set; }
    }

    [Table("Meals")]
    public class Meal
    {
        [Key]
        public int MealId { get; set; }
        public string MealName { get; set; } = string.Empty;
        public string MealType { get; set; } = string.Empty;
        public int Calories { get; set; }
        public decimal Price { get; set; }
        public string? Tag { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [Table("DailyTrackings")]
    public class DailyTracking
    {
        [Key]
        public int TrackingId { get; set; }
        public int UserId { get; set; }
        public DateTime TrackingDate { get; set; }
        public double WaterConsumed { get; set; }
        public int CaloriesConsumed { get; set; }
        public int StepsCount { get; set; }
    }

    [Table("Timelines")]
    public class Timeline
    {
        [Key]
        public int TimelineId { get; set; }
        public int UserId { get; set; }
        public string TimeSlot { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = "Task";
        public bool IsCompleted { get; set; } = false;
        public DateTime PlanDate { get; set; } = DateTime.Today;
    }

    public class LifeSmartDbContext : DbContext
    {
        public LifeSmartDbContext(DbContextOptions<LifeSmartDbContext> options) : base(options) { }

        public DbSet<Role> Roles => Set<Role>();
        public DbSet<User> Users => Set<User>();
        public DbSet<Meal> Meals => Set<Meal>();
        public DbSet<DailyTracking> DailyTrackings => Set<DailyTracking>();
        public DbSet<Timeline> Timelines => Set<Timeline>();
    }
}