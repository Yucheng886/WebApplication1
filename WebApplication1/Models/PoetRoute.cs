using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    [Table("PoetRoutes")]
    public class PoetRoute
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        [Index("IX_PoetName")]
        public string PoetName { get; set; }

        [Required]
        [MaxLength(100)]
        public string LocationName { get; set; }

        [Required]
        public double Latitude { get; set; }

        [Required]
        public double Longitude { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        public int SortOrder { get; set; }

        public virtual ICollection<RoutePoem> Poems { get; set; }
    }
}
