using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    [Table("Poems")]
    public class Poem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        [Index("IX_City")]
        public string City { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; }

        [Required]
        [MaxLength(50)]
        [Index("IX_Author")]
        public string Author { get; set; }

        [Required]
        [MaxLength(20)]
        public string Dynasty { get; set; }

        /// <summary>诗词正文（支持长诗词，nvarchar(max)）</summary>
        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string Content { get; set; }

        /// <summary>百度搜索热度（来自 rank 数据，值越大越热门）</summary>
        public int? StarCount { get; set; }

        /// <summary>词牌名（宋词专用，如"水调歌头"）</summary>
        [MaxLength(100)]
        public string SubTitle { get; set; }
    }
}

