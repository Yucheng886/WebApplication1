using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Data.Entity;

namespace WebApplication1.Models
{
    public class User
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(50)]
        public string Username { get; set; }
        
        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class PoemDbContext : DbContext
    {
        static PoemDbContext()
        {
            // 禁用 EF 的数据库初始化器，避免模型变更时自动迁移报错
            // 新表通过 MigrateData.aspx 手动建表
            Database.SetInitializer<PoemDbContext>(null);
        }

        public PoemDbContext() : base("name=PoemDbContext")
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Poem> Poems { get; set; }
        public DbSet<City> Cities { get; set; }
        public DbSet<PoetRoute> PoetRoutes { get; set; }
        public DbSet<RoutePoem> RoutePoems { get; set; }

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Poems 表配置
            modelBuilder.Entity<Poem>().ToTable("Poems");
            modelBuilder.Entity<Poem>()
                .Property(p => p.City)
                .IsRequired()
                .HasMaxLength(50);
            modelBuilder.Entity<Poem>()
                .Property(p => p.Author)
                .IsRequired()
                .HasMaxLength(50);

            // Cities 表配置
            modelBuilder.Entity<City>().ToTable("Cities");

            // PoetRoutes 表配置
            modelBuilder.Entity<PoetRoute>().ToTable("PoetRoutes");
            modelBuilder.Entity<PoetRoute>()
                .HasMany(r => r.Poems)
                .WithRequired(p => p.Route)
                .HasForeignKey(p => p.RouteId);

            // RoutePoems 表配置
            modelBuilder.Entity<RoutePoem>().ToTable("RoutePoems");

            // Users 表配置
            modelBuilder.Entity<User>().ToTable("Users");
        }
    }
}
