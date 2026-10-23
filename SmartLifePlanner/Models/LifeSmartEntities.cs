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

    [Table("DailyMeals")]
    public class DailyMeal
    {
        [Key]
        public int DailyMealId { get; set; }
        public int UserId { get; set; }
        public string MealType { get; set; } = string.Empty;
        public int MealId { get; set; }
        public DateTime PlanDate { get; set; } = DateTime.Today;

        [ForeignKey("MealId")]
        public virtual Meal? Meal { get; set; }
    }

    [Table("Activities")]
    public class Activity
    {
        [Key]
        public int ActivityId { get; set; }
        public int UserId { get; set; }
        public string ActivityType { get; set; } = string.Empty;
        public int DurationSeconds { get; set; }
        public int StepsEquivalent { get; set; }
        public double CaloriesBurned { get; set; }
        public DateTime LogDate { get; set; } = DateTime.Today;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    [Table("WaterLogs")]
    public class WaterLog
    {
        [Key]
        public int LogId { get; set; }
        public int UserId { get; set; }
        public int AmountMl { get; set; }
        public string WaterType { get; set; } = "Water";
        public int HydrationAmountMl { get; set; }
        public int Calories { get; set; } = 0;
        public DateTime LoggedAt { get; set; } = DateTime.Now;
        public DateTime LogDate { get; set; } = DateTime.Today;
    }

    [Table("SleepLogs")]
    public class SleepLog
    {
        [Key]
        public int SleepId { get; set; }
        public int UserId { get; set; }
        public DateTime BedTime { get; set; }
        public DateTime WakeTime { get; set; }
        public int DurationMinutes { get; set; }
        public int SleepCycles { get; set; }
        public string QualityRating { get; set; } = "Normal";
        public int SleepScore { get; set; }
        public DateTime SleepDate { get; set; } = DateTime.Today;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class LifeSmartDbContext : DbContext
    {
        public LifeSmartDbContext(DbContextOptions<LifeSmartDbContext> options) : base(options) { }

        public DbSet<Role> Roles => Set<Role>();
        public DbSet<User> Users => Set<User>();
        public DbSet<Meal> Meals => Set<Meal>();
        public DbSet<DailyTracking> DailyTrackings => Set<DailyTracking>();
        public DbSet<Timeline> Timelines => Set<Timeline>();
        public DbSet<DailyMeal> DailyMeals => Set<DailyMeal>();
        public DbSet<Activity> Activities => Set<Activity>();
        public DbSet<WaterLog> WaterLogs => Set<WaterLog>();
        public DbSet<SleepLog> SleepLogs => Set<SleepLog>();
    }
}