using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SmartLifePlanner.Models
{
    [Table("Roles")]
    public class Role
    {
        [Key]
        public int RoleId { get; set; }
        public string RoleName { get; set; } = "User";
    }

    [Table("Users")]
    public class User
    {
        [Key]
        public int UserId { get; set; }
        public string FullName { get; set; } = "Dương Thu Hậu";
        public string Email { get; set; } = "hauduong0808@gmail.com";
        public string PasswordHash { get; set; } = string.Empty;
        public string Gender { get; set; } = "Nam";
        public int Age { get; set; } = 20;
        public double Height { get; set; } = 173.0;
        public double Weight { get; set; } = 60.0;
        public string ActivityLevel { get; set; } = "Vận động vừa";
        public string Goal { get; set; } = "Duy trì";
        public double TargetWater { get; set; } = 2.3;
        public int TargetCalories { get; set; } = 2150;

        public int RoleId { get; set; } = 1;
        [ForeignKey("RoleId")]
        public virtual Role? Role { get; set; }

        public DateTime? CreatedAt { get; set; } = DateTime.Now;
    }

    [Table("Meals")]
    public class Meal
    {
        [Key]
        public int MealId { get; set; }
        public string MealName { get; set; } = string.Empty;
        public string MealType { get; set; } = "Lunch";
        public int Calories { get; set; }
        public decimal Price { get; set; } = 0;
        public string? Tag { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [Table("DailyMeals")]
    public class DailyMeal
    {
        [Key]
        public int DailyMealId { get; set; }
        public int UserId { get; set; } = 1;
        public string MealType { get; set; } = "Lunch";
        public int MealId { get; set; }

        [ForeignKey("MealId")]
        public virtual Meal? Meal { get; set; }

        public DateTime PlanDate { get; set; } = DateTime.Today;

        // Bổ sung thuộc tính này để khớp với cột IsEaten trong SQL Server
        public bool IsEaten { get; set; } = false;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("DailyTrackings")]
    public class DailyTracking
    {
        [Key]
        public int TrackingId { get; set; }
        public int UserId { get; set; } = 1;
        public DateTime TrackingDate { get; set; } = DateTime.Today;
        public double WaterConsumed { get; set; } = 0.0;
        public int CaloriesConsumed { get; set; } = 0;
        public int StepsCount { get; set; } = 0;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("Timelines")]
    public class Timeline
    {
        [Key]
        public int TimelineId { get; set; }
        public int UserId { get; set; } = 1;
        public string TimeSlot { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Category { get; set; } = "Task";
        public bool IsCompleted { get; set; } = false;
        public DateTime PlanDate { get; set; } = DateTime.Today;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("Activities")]
    public class UserActivity
    {
        [Key]
        public int ActivityId { get; set; }
        public int UserId { get; set; } = 1;
        public string ActivityType { get; set; } = "Walking";
        public int DurationSeconds { get; set; } = 0;
        public int StepsEquivalent { get; set; } = 0;
        public double CaloriesBurned { get; set; } = 0.0;
        public DateTime LogDate { get; set; } = DateTime.Today;
        public DateTime? CreatedAt { get; set; } = DateTime.Now;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("WaterLogs")]
    public class WaterLog
    {
        [Key]
        public int LogId { get; set; }
        public int UserId { get; set; } = 1;
        public int AmountMl { get; set; } = 250;
        public string WaterType { get; set; } = "Water";
        public int HydrationAmountMl { get; set; } = 250;
        public int Calories { get; set; } = 0;
        public DateTime LoggedAt { get; set; } = DateTime.Now;
        public DateTime LogDate { get; set; } = DateTime.Today;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("SleepLogs")]
    public class SleepLog
    {
        [Key]
        public int SleepId { get; set; }
        public int UserId { get; set; } = 1;
        public DateTime BedTime { get; set; }
        public DateTime WakeTime { get; set; }
        public int DurationMinutes { get; set; }
        public int SleepCycles { get; set; }
        public string QualityRating { get; set; } = "Normal";
        public int SleepScore { get; set; } = 85;
        public DateTime SleepDate { get; set; } = DateTime.Today;
        public DateTime? CreatedAt { get; set; } = DateTime.Now;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("ChatMessages")]
    public class ChatMessage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int MessageId { get; set; }

        public int UserId { get; set; } = 1;

        [Required]
        [MaxLength(20)]
        public string Sender { get; set; } = "User"; // "User" hoặc "AI"

        [Required]
        public string MessageText { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    public class LifeSmartDbContext : DbContext
    {
        public LifeSmartDbContext(DbContextOptions<LifeSmartDbContext> options) : base(options) { }

        public DbSet<ChatMessage> ChatMessages { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Role> Roles { get; set; } = null!;
        public DbSet<Meal> Meals { get; set; } = null!;
        public DbSet<DailyMeal> DailyMeals { get; set; } = null!;
        public DbSet<DailyTracking> DailyTrackings { get; set; } = null!;
        public DbSet<Timeline> Timelines { get; set; } = null!;
        public DbSet<UserActivity> Activities { get; set; } = null!;
        public DbSet<WaterLog> WaterLogs { get; set; } = null!;
        public DbSet<SleepLog> SleepLogs { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.HasKey(e => e.MessageId);
                entity.ToTable("ChatMessages");
            });
        }
    }
}