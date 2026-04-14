using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text;

class Program
{
    static readonly int[] Buckets = { 618, 700, 750, 800, 850, 907, 960, 1000, 1050, 1100, 1150, 1200, 1279 };
    
    class Lifespan { public int Birth; public int Death; }
    
    // 基础生卒年（用于模拟盛产年份）
    static Dictionary<string, Lifespan> poetLifespan = new Dictionary<string, Lifespan>()
    {
        {"虞世南", new Lifespan{Birth = 558, Death = 638}}, {"魏徵", new Lifespan{Birth = 580, Death = 643}},
        {"骆宾王", new Lifespan{Birth = 619, Death = 684}}, {"王勃", new Lifespan{Birth = 650, Death = 676}},
        {"陈子昂", new Lifespan{Birth = 661, Death = 702}}, {"贺知章", new Lifespan{Birth = 659, Death = 744}},
        {"孟浩然", new Lifespan{Birth = 689, Death = 740}}, {"王昌龄", new Lifespan{Birth = 698, Death = 757}},
        {"王维", new Lifespan{Birth = 701, Death = 761}}, {"李白", new Lifespan{Birth = 701, Death = 762}},
        {"高适", new Lifespan{Birth = 704, Death = 765}}, {"杜甫", new Lifespan{Birth = 712, Death = 770}},
        {"白居易", new Lifespan{Birth = 772, Death = 846}}, {"刘禹锡", new Lifespan{Birth = 772, Death = 842}},
        {"杜牧", new Lifespan{Birth = 803, Death = 852}}, {"李商隐", new Lifespan{Birth = 813, Death = 858}},
        {"苏轼", new Lifespan{Birth = 1037, Death = 1101}}, {"陆游", new Lifespan{Birth = 1125, Death = 1210}},
        {"辛弃疾", new Lifespan{Birth = 1140, Death = 1207}}, {"李清照", new Lifespan{Birth = 1084, Death = 1155}},
        {"欧阳修", new Lifespan{Birth = 1007, Death = 1072}}, {"王安石", new Lifespan{Birth = 1021, Death = 1086}},
        {"文天祥", new Lifespan{Birth = 1236, Death = 1283}}, {"柳永", new Lifespan{Birth = 984, Death = 1053}}
    };

    static void Main()
    {
        string connStr = @"Data Source=(LocalDB)\MSSQLLocalDB;AttachDbFilename=D:\WebApplication1\WebApplication1\WebApplication1\App_Data\PoemDatabase.mdf;Integrated Security=True";
        Random rand = new Random();
        try 
        {
            using (SqlConnection conn = new SqlConnection(connStr))
            {
                conn.Open();
                
                // 1. Gather all poems that have a city
                var cityPoems = new Dictionary<string, List<Tuple<string, string>>>();
                using (SqlCommand cmd = new SqlCommand("SELECT City, Author, Dynasty FROM Poems WHERE City IS NOT NULL AND City <> ''", conn))
                using (SqlDataReader reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        string c = reader.GetString(0);
                        string a = reader.IsDBNull(1) ? "" : reader.GetString(1);
                        string d = reader.IsDBNull(2) ? "" : reader.GetString(2);
                        if (!cityPoems.ContainsKey(c)) cityPoems[c] = new List<Tuple<string, string>>();
                        cityPoems[c].Add(Tuple.Create(a, d));
                    }
                }

                int totalP = 0;
                // 2. Compute true YearData JSON for each city
                foreach (var kvp in cityPoems)
                {
                    string city = kvp.Key;
                    var poems = kvp.Value;
                    totalP += poems.Count;
                    
                    Dictionary<int, int> rawCounts = new Dictionary<int, int>();
                    foreach (int b in Buckets) rawCounts[b] = 0;

                    foreach (var p in poems)
                    {
                        string author = p.Item1;
                        string dynasty = p.Item2;
                        double eventYear = 0;

                        if (poetLifespan.ContainsKey(author)) {
                            var span = poetLifespan[author];
                            eventYear = span.Birth + (span.Death - span.Birth) * 0.6; // 以60%人生为主
                        } else {
                            if (dynasty.Contains("宋")) {
                                eventYear = rand.Next(960, 1250);
                            } else {
                                eventYear = rand.Next(618, 900);
                            }
                        }

                        int targetBucket = 1279;
                        foreach (int b in Buckets) {
                            if (b >= eventYear) {
                                targetBucket = b; break;
                            }
                        }
                        rawCounts[targetBucket]++;
                    }

                    // 积分类加
                    int runningTotal = 0;
                    StringBuilder jsonBuilder = new StringBuilder("{");
                    for (int i = 0; i < Buckets.Length; i++)
                    {
                        int b = Buckets[i];
                        runningTotal += rawCounts[b];
                        jsonBuilder.Append(string.Format("\"{0}\":{1}", b, runningTotal));
                        if (i < Buckets.Length - 1) jsonBuilder.Append(",");
                    }
                    jsonBuilder.Append("}");
                    string yearDataJson = jsonBuilder.ToString();

                    // 3. Update SQL
                    using (SqlCommand upd = new SqlCommand("UPDATE Cities SET YearData = @json WHERE Name = @c OR Name + '市' = @c", conn))
                    {
                        upd.Parameters.AddWithValue("@json", yearDataJson);
                        upd.Parameters.AddWithValue("@c", city);
                        upd.ExecuteNonQuery();
                    }
                }
                Console.WriteLine("SUCCESS: Processed " + cityPoems.Count + " cities and " + totalP + " poems.");
            }
        } 
        catch (Exception ex) 
        {
            Console.WriteLine("ERROR: " + ex.Message);
            Console.WriteLine(ex.StackTrace);
        }
    }
}
