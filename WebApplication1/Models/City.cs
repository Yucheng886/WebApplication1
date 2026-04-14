using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    [Table("Cities")]
    public class City
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        /// <summary>
        /// JSON格式的年份分布数据，如 {"618":200,"700":1200,...}
        /// </summary>
        [MaxLength(4000)]
        public string YearData { get; set; }
    }
}
