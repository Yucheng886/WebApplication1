using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    [Table("RoutePoems")]
    public class RoutePoem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RouteId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; }

        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string Content { get; set; }

        [MaxLength(10)]
        public string Year { get; set; }

        [ForeignKey("RouteId")]
        public virtual PoetRoute Route { get; set; }
    }
}
