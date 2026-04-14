using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Newtonsoft.Json;
using WebApplication1.Models;
using System.Security.Cryptography;
using System.Text;
using Microsoft.VisualBasic;

namespace WebApplication1
{
    /// <summary>
    /// 诗词API处理器，提供诗词、城市、路线数据的HTTP接口
    /// 支持: author / city / cities / routes / search / random / stats
    /// </summary>
    public class PoemApiHandler : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            try
            {
                context.Response.ContentType = "application/json";
                context.Response.ContentEncoding = System.Text.Encoding.UTF8;
                context.Response.AddHeader("Access-Control-Allow-Origin", "*");

                string queryType = context.Request.QueryString["type"];
                string cityName  = context.Request.QueryString["city"];
                string author    = context.Request.QueryString["author"];
                string keyword   = context.Request.QueryString["keyword"];
                int page = int.TryParse(context.Request.QueryString["page"], out int p) ? Math.Max(1, p) : 1;
                int size = int.TryParse(context.Request.QueryString["size"], out int s) ? Math.Min(100, Math.Max(1, s)) : 20;

                string jsonResponse;
                switch (queryType)
                {
                    case "author":
                        jsonResponse = !string.IsNullOrEmpty(author) ? GetPoemsByAuthor(author, page, size) : "[]";
                        break;
                    case "city":
                        jsonResponse = !string.IsNullOrEmpty(cityName) ? GetPoemsByCity(cityName, page, size) : "[]";
                        break;
                    case "cities":
                        jsonResponse = GetAllCities();
                        break;
                    case "routes":
                        jsonResponse = GetAllRoutes();
                        break;
                    case "search":
                        jsonResponse = !string.IsNullOrEmpty(keyword) ? SearchPoems(keyword, page, size) : "[]";
                        break;
                    case "random":
                        jsonResponse = GetRandomPoems(size > 0 ? size : 5);
                        break;
                    case "stats":
                        jsonResponse = GetStats();
                        break;
                    case "login":
                    case "register":
                        HandleAuth(context, queryType);
                        return;
                    default:
                        jsonResponse = "{\"error\":\"unknown type. use: author/city/cities/routes/search/random/stats/login/register\"}";
                        break;
                }

                context.Response.Write(jsonResponse);
            }
            catch (Exception ex)
            {
                HandleError(context, ex);
            }
        }

        // =========================================================
        //  城市 & 路线
        // =========================================================

        private string GetAllCities()
        {
            using (var db = new PoemDbContext())
            {
                var cityCounts = db.Poems
                                   .Where(p => p.City != null)
                                   .GroupBy(p => p.City)
                                   .Select(g => new { cname = g.Key, n = g.Count() })
                                   .ToDictionary(k => k.cname, v => v.n);

                var result = db.Cities.ToList().Select(c => new
                {
                    name     = ToSimplified(c.Name),
                    lat      = c.Latitude,
                    lon      = c.Longitude,
                    count    = cityCounts.ContainsKey(c.Name) ? cityCounts[c.Name] : 0,
                    yearData = string.IsNullOrEmpty(c.YearData) ? null
                               : JsonConvert.DeserializeObject<Dictionary<string, int>>(c.YearData)
                }).Where(c => c.count > 0).ToList();
                return JsonConvert.SerializeObject(result);
            }
        }

        private string GetAllRoutes()
        {
            using (var db = new PoemDbContext())
            {
                var routes = db.PoetRoutes
                    .Include("Poems")
                    .OrderBy(r => r.PoetName)
                    .ThenBy(r => r.SortOrder)
                    .ToList();

                var grouped = routes.GroupBy(r => r.PoetName).Select(g => new
                {
                    name = g.Key,
                    path = g.Select(r => new
                    {
                        name        = ToSimplified(r.LocationName),
                        location    = new double[] { r.Longitude, r.Latitude },
                        description = ToSimplified(r.Description),
                        poems       = r.Poems.Select(poem => 
                        {
                            // RoutePoem 模型不包含 Author 和 Dynasty，统一使用行迹归属诗人姓名
                            return new
                            {
                                title   = ToSimplified(poem.Title),
                                content = ToSimplified(poem.Content),
                                year    = poem.Year,
                                author  = ToSimplified(g.Key),
                                dynasty = "唐" 
                            };
                        }).ToList()
                    }).ToList()
                }).ToList();

                return JsonConvert.SerializeObject(grouped);
            }
        }

        // =========================================================
        //  诗词历史地名空间映射与查询（CHGIS 模拟机制）
        // =========================================================

        private string GetPoemsByCity(string requestedCityName, int page, int size)
        {
            using (var db = new PoemDbContext())
            {
                // 1. 经过历史地名对照表解析（正规化为现代库内名称，并带出残差纠偏后的 WGS84 原点）
                var geoMapping = HistoricalGeoMapper.Resolve(requestedCityName);
                string mappedCityName = geoMapping.ModernCity;
                
                string cityNameT = ToTraditional(mappedCityName);
                
                // 2. 根据严密的现代归一化地名去数据库取件
                var query = db.Poems
                    .Where(p => p.City == mappedCityName || p.City == cityNameT)
                    .OrderByDescending(p => p.StarCount ?? 0)
                    .ThenBy(p => p.Id);

                int total = query.Count();
                var dbItems = query.Skip((page - 1) * size).Take(size).ToList();
                var items = dbItems.Select(p => new
                {
                    city     = ToSimplified(p.City),
                    title    = ToSimplified(p.Title),
                    subTitle = ToSimplified(p.SubTitle),
                    author   = ToSimplified(p.Author),
                    dynasty  = p.Dynasty,
                    content  = ToSimplified(p.Content),
                    star     = p.StarCount
                }).ToList();

                // 3. 将空间纠偏信息（精确到小数点的 WGS-84 锚点）一起随数据投递给前端
                return JsonConvert.SerializeObject(new { 
                    total, 
                    page, 
                    size, 
                    geoAnchor = new {
                        queryName = requestedCityName,
                        normalizedName = mappedCityName,
                        isHistorical = geoMapping.IsHistorical,
                        centerLon = geoMapping.CenterLon,
                        centerLat = geoMapping.CenterLat
                    },
                    items 
                });
            }
        }

        private string GetPoemsByAuthor(string author, int page, int size)
        {
            using (var db = new PoemDbContext())
            {
                string authorT = ToTraditional(author);
                var query = db.Poems
                    .Where(p => p.Author == author || p.Author == authorT)
                    .OrderByDescending(p => p.StarCount ?? 0)
                    .ThenBy(p => p.Id);

                int total = query.Count();
                var dbItems = query.Skip((page - 1) * size).Take(size).ToList();
                var items = dbItems.Select(p => new
                {
                    city     = ToSimplified(p.City),
                    title    = ToSimplified(p.Title),
                    subTitle = ToSimplified(p.SubTitle),
                    author   = ToSimplified(p.Author),
                    dynasty  = p.Dynasty,
                    content  = ToSimplified(p.Content),
                    star     = p.StarCount
                }).ToList();

                return JsonConvert.SerializeObject(new { total, page, size, items });
            }
        }

        // =========================================================
        //  全文搜索（标题 / 作者 / 正文，可含关键词）
        // =========================================================

        private static string ToTraditional(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            string s = "将进酒书车马发处尽苏静长门见风难还归调头辞忆鹳题临乌阳杨钟剑楼黄鹤国旧齐声鸟乡万没东乐刘锡饮后别汉云飞叶无两听对";
            string t = "將進酒書車馬發處盡蘇靜長門見風難還歸調頭辭憶鸛題臨烏陽楊鐘劍樓黃鶴國舊齊聲鳥鄉萬沒東樂劉錫飲後別漢雲飛葉無兩聽對";
            for (int i = 0; i < s.Length; i++) {
                text = text.Replace(s[i], t[i]);
            }
            return text;
        }

        private static string ToSimplified(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            try {
                // 第一步：手动核心字典转换（补足系统 StrConv 在某些环境下对常见字的遗漏）
                string t = "請為側聽願謔風雲圓將進酒書車馬發處盡蘇靜長門見難還歸調頭辭憶鸛題臨烏陽楊鐘劍樓黃鶴國舊齊聲鳥鄉萬沒東樂劉錫飲後別漢雲飛葉無兩聽對";
                string s = "请为侧听愿谑风云圆将进酒书车马发处尽苏静长门见难还归调头辞忆鹳题临乌阳杨钟剑楼黄鹤国旧齐声鸟乡万没东乐刘锡饮后别汉云飞叶无两听对";
                for (int i = 0; i < t.Length; i++) {
                    text = text.Replace(t[i], s[i]);
                }
                // 第二步：系统自动转换
                return Strings.StrConv(text, VbStrConv.SimplifiedChinese, 2052);
            } catch {
                return text;
            }
        }

        private string SearchPoems(string keyword, int page, int size)
        {
            using (var db = new PoemDbContext())
            {
                string keywordT = ToTraditional(keyword);

                var query = db.Poems
                    .Where(p => p.Title.Contains(keyword) || p.Title.Contains(keywordT)
                             || p.Author.Contains(keyword) || p.Author.Contains(keywordT)
                             || p.Content.Contains(keyword) || p.Content.Contains(keywordT))
                    .OrderByDescending(p => p.StarCount ?? 0)
                    .ThenBy(p => p.Id);

                int total = query.Count();
                var dbItems = query.Skip((page - 1) * size).Take(size).ToList();
                var items = dbItems.Select(p => new
                {
                    city     = ToSimplified(p.City),
                    title    = ToSimplified(p.Title),
                    subTitle = ToSimplified(p.SubTitle),
                    author   = ToSimplified(p.Author),
                    dynasty  = p.Dynasty,
                    content  = ToSimplified(p.Content),
                    star     = p.StarCount
                }).ToList();

                return JsonConvert.SerializeObject(new { total, page, size, keyword, items });
            }
        }

        // =========================================================
        //  随机取诗（优先高热度，用于首页 / 每日推荐）
        // =========================================================

        private string GetRandomPoems(int count)
        {
            using (var db = new PoemDbContext())
            {
                int hotCount = db.Poems.Count(p => p.StarCount >= 50000 || p.StarCount == 999999);
                var rng  = new Random();

                if (hotCount >= count)
                {
                    int skip = rng.Next(0, hotCount - count + 1);
                    var hotPoems = db.Poems
                        .Where(p => p.StarCount >= 50000 || p.StarCount == 999999)
                        .OrderBy(p => p.Id)
                        .Skip(skip).Take(count)
                        .ToList()
                        .Select(p => new
                        {
                            city = ToSimplified(p.City), title = ToSimplified(p.Title), subTitle = ToSimplified(p.SubTitle),
                            author = ToSimplified(p.Author), dynasty = p.Dynasty,
                            content = ToSimplified(p.Content), star = p.StarCount
                        }).ToList();
                    return JsonConvert.SerializeObject(hotPoems);
                }

                // 全库随机兜底
                int total = db.Poems.Count();
                if (total == 0) return "[]";
                int fallbackSkip = rng.Next(0, Math.Max(1, total - count));
                var fallback = db.Poems
                    .OrderBy(p => p.Id)
                    .Skip(fallbackSkip).Take(count)
                    .ToList()
                    .Select(p => new
                    {
                        city = ToSimplified(p.City), title = ToSimplified(p.Title), subTitle = ToSimplified(p.SubTitle),
                        author = ToSimplified(p.Author), dynasty = p.Dynasty,
                        content = ToSimplified(p.Content), star = p.StarCount
                    }).ToList();
                return JsonConvert.SerializeObject(fallback);
            }
        }

        // =========================================================
        //  统计数据（朝代分布 / 城市分布 / 热门作者 Top10）
        // =========================================================

        private string GetStats()
        {
            using (var db = new PoemDbContext())
            {
                var dynastyStats = db.Poems
                    .GroupBy(p => p.Dynasty)
                    .Select(g => new { dynasty = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count).ToList();

                var cityStats = db.Poems
                    .Where(p => p.City != "其他")
                    .GroupBy(p => p.City)
                    .Select(g => new { city = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count).Take(20).ToList();

                var topAuthors = db.Poems
                    .GroupBy(p => p.Author)
                    .Select(g => new { author = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count).Take(10).ToList();

                return JsonConvert.SerializeObject(new
                {
                    totalPoems   = db.Poems.Count(),
                    dynastyStats = dynastyStats.Select(s => new { dynasty = ToSimplified(s.dynasty), count = s.count }).ToList(),
                    cityStats    = cityStats.Select(s => new { city = ToSimplified(s.city), count = s.count }).ToList(),
                    topAuthors   = topAuthors.Select(s => new { author = ToSimplified(s.author), count = s.count }).ToList()
                });
            }
        }

        // =========================================================
        //  错误处理
        // =========================================================

        private void HandleAuth(HttpContext context, string action)
        {
            if (context.Request.HttpMethod != "POST")
            {
                context.Response.Write("{\"success\":false,\"message\":\"POST required\"}");
                return;
            }
            
            EnsureUsersTable();

            string input = new System.IO.StreamReader(context.Request.InputStream).ReadToEnd();
            var data = JsonConvert.DeserializeObject<dynamic>(input);
            if (data == null) {
                 context.Response.Write("{\"success\":false,\"message\":\"Bad payload\"}");
                 return;
            }

            string username = data.username;
            string password = data.password;

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                context.Response.Write("{\"success\":false,\"message\":\"用户名或密码不能为空\"}");
                return;
            }

            using (var db = new PoemDbContext())
            {
                if (action == "register")
                {
                    if (db.Users.Any(u => u.Username == username))
                    {
                        context.Response.Write("{\"success\":false,\"message\":\"用户名已存在，请换一个\"}");
                        return;
                    }
                    var user = new User
                    {
                        Username = username,
                        PasswordHash = HashPassword(password),
                        CreatedAt = DateTime.Now
                    };
                    db.Users.Add(user);
                    db.SaveChanges();
                    context.Response.Write("{\"success\":true,\"message\":\"注册成功！欢迎探索诗词万里。\"}");
                }
                else if (action == "login")
                {
                    string hash = HashPassword(password);
                    var user = db.Users.FirstOrDefault(u => u.Username == username && u.PasswordHash == hash);
                    if (user != null)
                    {
                        context.Response.Write("{\"success\":true,\"message\":\"登录成功！欢迎回来。\"}");
                    }
                    else
                    {
                        context.Response.Write("{\"success\":false,\"message\":\"用户名或密码错误\"}");
                    }
                }
            }
        }

        private void EnsureUsersTable() 
        {
            using (var db = new PoemDbContext())
            {
                try 
                {
                    int count = db.Database.SqlQuery<int>("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Users'").First();
                    if (count == 0) 
                    {
                        db.Database.ExecuteSqlCommand("CREATE TABLE Users (Id INT IDENTITY(1,1) PRIMARY KEY, Username NVARCHAR(50) NOT NULL UNIQUE, PasswordHash NVARCHAR(255) NOT NULL, CreatedAt DATETIME NOT NULL)");
                    }
                } 
                catch { }
            }
        }

        private string HashPassword(string password)
        {
            using (var sha256 = SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                StringBuilder builder = new StringBuilder();
                foreach (byte b in bytes)
                {
                    builder.Append(b.ToString("x2"));
                }
                return builder.ToString();
            }
        }

        private void HandleError(HttpContext context, Exception ex)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode  = 500;
            context.Response.Write(JsonConvert.SerializeObject(new
            {
                error     = "Internal server error",
                message   = ex.Message,
                timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            }));
        }

        public bool IsReusable => false;
    }

    /// <summary>
    /// 基于局部 CHGIS 与残差思想的微型古地名时空映射服务
    /// 取代了简单的字符串 TrimEnd() 模糊切割，提供了精确的 WGS84 锚点反馈
    /// </summary>
    public static class HistoricalGeoMapper
    {
        public class GeoEntity
        {
            public string ModernCity { get; set; }
            public double CenterLon { get; set; }
            public double CenterLat { get; set; }
            public bool IsHistorical { get; set; }
        }

        // 模拟的历史到现代实体与精确定点偏差（锚点）字典
        private static readonly Dictionary<string, GeoEntity> mappingDict = new Dictionary<string, GeoEntity>(StringComparer.OrdinalIgnoreCase)
        {
            // 古名系列
            { "建康", new GeoEntity { ModernCity = "南京", CenterLon = 118.7968, CenterLat = 32.0602, IsHistorical = true } },
            { "金陵", new GeoEntity { ModernCity = "南京", CenterLon = 118.7968, CenterLat = 32.0602, IsHistorical = true } },
            { "白下", new GeoEntity { ModernCity = "南京", CenterLon = 118.7968, CenterLat = 32.0602, IsHistorical = true } },
            { "江宁", new GeoEntity { ModernCity = "南京", CenterLon = 118.7968, CenterLat = 32.0602, IsHistorical = true } },
            
            { "广陵", new GeoEntity { ModernCity = "扬州", CenterLon = 119.4129, CenterLat = 32.3942, IsHistorical = true } },
            { "江都", new GeoEntity { ModernCity = "扬州", CenterLon = 119.4129, CenterLat = 32.3942, IsHistorical = true } },
            
            { "临安", new GeoEntity { ModernCity = "杭州", CenterLon = 120.1550, CenterLat = 30.2740, IsHistorical = true } },
            { "钱塘", new GeoEntity { ModernCity = "杭州", CenterLon = 120.1550, CenterLat = 30.2740, IsHistorical = true } },
            
            { "锦官城", new GeoEntity { ModernCity = "成都", CenterLon = 104.0657, CenterLat = 30.6594, IsHistorical = true } },
            { "益州", new GeoEntity { ModernCity = "成都", CenterLon = 104.0657, CenterLat = 30.6594, IsHistorical = true } },
            
            { "姑苏", new GeoEntity { ModernCity = "苏州", CenterLon = 120.6195, CenterLat = 31.2990, IsHistorical = true } },
            { "平江", new GeoEntity { ModernCity = "苏州", CenterLon = 120.6195, CenterLat = 31.2990, IsHistorical = true } },
            
            { "江州", new GeoEntity { ModernCity = "九江", CenterLon = 115.9928, CenterLat = 29.7120, IsHistorical = true } },
            { "寻阳", new GeoEntity { ModernCity = "九江", CenterLon = 115.9928, CenterLat = 29.7120, IsHistorical = true } },
            
            // 现代直查降级容错系列（带后缀输入过滤）
            { "南京市", new GeoEntity { ModernCity = "南京", CenterLon = 118.7968, CenterLat = 32.0602, IsHistorical = false } },
            { "杭州市", new GeoEntity { ModernCity = "杭州", CenterLon = 120.1550, CenterLat = 30.2740, IsHistorical = false } },
            { "成都市", new GeoEntity { ModernCity = "成都", CenterLon = 104.0657, CenterLat = 30.6594, IsHistorical = false } },
            { "洛阳市", new GeoEntity { ModernCity = "洛阳", CenterLon = 112.4540, CenterLat = 34.6197, IsHistorical = false } },
            { "苏州市", new GeoEntity { ModernCity = "苏州", CenterLon = 120.6195, CenterLat = 31.2990, IsHistorical = false } },
            { "西安市", new GeoEntity { ModernCity = "长安", CenterLon = 108.9398, CenterLat = 34.3412, IsHistorical = true } }  // 西安 -> 长安
        };

        public static GeoEntity Resolve(string inputName)
        {
            if (string.IsNullOrWhiteSpace(inputName))
            {
                return new GeoEntity { ModernCity = "", CenterLon = 0, CenterLat = 0, IsHistorical = false };
            }

            string trimName = inputName.Trim();

            // 1. O(1) 字典精确命中（含古名或带“市”字的现代全称）
            if (mappingDict.TryGetValue(trimName, out GeoEntity entity))
            {
                return entity;
            }

            // 2. O(N) 兜底逻辑：处理用户自己强带了省市县但字典没命中，退回到简单的同名剔除
            string fallbackMappedName = trimName.TrimEnd('市', '县', '区', '省');
            
            return new GeoEntity
            {
                ModernCity = fallbackMappedName, // 被迫转交数据库模糊搜索
                CenterLon = -1,  // 表示未命中受信的强字典系，无确信空间锚点残差数据支撑
                CenterLat = -1,
                IsHistorical = false
            };
        }
    }
}
