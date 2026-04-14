using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Newtonsoft.Json;
using WebApplication1.Models;

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
                    default:
                        jsonResponse = "{\"error\":\"unknown type. use: author/city/cities/routes/search/random/stats\"}";
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
                    name     = c.Name,
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
                        name        = r.LocationName,
                        location    = new double[] { r.Longitude, r.Latitude },
                        description = r.Description,
                        poems       = r.Poems.Select(poem => new
                        {
                            title   = poem.Title,
                            content = poem.Content,
                            year    = poem.Year
                        }).ToList()
                    }).ToList()
                }).ToList();

                return JsonConvert.SerializeObject(grouped);
            }
        }

        // =========================================================
        //  诗词查询（带分页 + 热度排序）
        // =========================================================

        private string GetPoemsByCity(string cityName, int page, int size)
        {
            using (var db = new PoemDbContext())
            {
                // 增强容错：如果用户输入带“市”、“县”等后缀，自动过滤掉以匹配库里的地名简写
                if (!string.IsNullOrEmpty(cityName))
                {
                    cityName = cityName.TrimEnd('市', '县', '区', '省');
                }
                
                string cityNameT = ToTraditional(cityName);
                var query = db.Poems
                    .Where(p => p.City == cityName || p.City == cityNameT)
                    .OrderByDescending(p => p.StarCount ?? 0)
                    .ThenBy(p => p.Id);

                int total = query.Count();
                var items = query.Skip((page - 1) * size).Take(size)
                    .Select(p => new
                    {
                        city     = p.City,
                        title    = p.Title,
                        subTitle = p.SubTitle,
                        author   = p.Author,
                        dynasty  = p.Dynasty,
                        content  = p.Content,
                        star     = p.StarCount
                    }).ToList();

                return JsonConvert.SerializeObject(new { total, page, size, items });
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
                var items = query.Skip((page - 1) * size).Take(size)
                    .Select(p => new
                    {
                        city     = p.City,
                        title    = p.Title,
                        subTitle = p.SubTitle,
                        author   = p.Author,
                        dynasty  = p.Dynasty,
                        content  = p.Content,
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
                var items = query.Skip((page - 1) * size).Take(size)
                    .Select(p => new
                    {
                        city     = p.City,
                        title    = p.Title,
                        subTitle = p.SubTitle,
                        author   = p.Author,
                        dynasty  = p.Dynasty,
                        content  = p.Content,
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
                        .Select(p => new
                        {
                            city = p.City, title = p.Title, subTitle = p.SubTitle,
                            author = p.Author, dynasty = p.Dynasty,
                            content = p.Content, star = p.StarCount
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
                    .Select(p => new
                    {
                        city = p.City, title = p.Title, subTitle = p.SubTitle,
                        author = p.Author, dynasty = p.Dynasty,
                        content = p.Content, star = p.StarCount
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
                    dynastyStats,
                    cityStats,
                    topAuthors
                });
            }
        }

        // =========================================================
        //  错误处理
        // =========================================================

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
}
