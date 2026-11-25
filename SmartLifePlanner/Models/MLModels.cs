using Microsoft.ML.Data;

namespace SmartLifePlanner.Models
{
    // Dữ liệu đầu vào để huấn luyện và dự đoán học máy
    public class LifestyleDataPoint
    {
        [LoadColumn(0)] public float AvgCaloriesIn { get; set; }
        [LoadColumn(1)] public float AvgCaloriesBurned { get; set; }
        [LoadColumn(2)] public float AvgSleepHours { get; set; }
        [LoadColumn(3)] public float AvgSteps { get; set; }

        [LoadColumn(4)]
        [ColumnName("Label")]
        public float WeightChange30Days { get; set; } // Nhãn cần dự đoán (+ tăng, - giảm cân)
    }

    // Kết quả dự đoán trả về từ mô hình
    public class WeightPrediction
    {
        [ColumnName("Score")]
        public float PredictedWeightChange { get; set; }
    }
}