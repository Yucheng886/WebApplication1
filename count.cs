using System;
using System.Data.SqlClient;

class Program
{
    static void Main()
    {
        string connStr = @"Data Source=(LocalDB)\MSSQLLocalDB;AttachDbFilename=D:\WebApplication1\WebApplication1\WebApplication1\App_Data\PoemDatabase.mdf;Integrated Security=True";
        using (SqlConnection conn = new SqlConnection(connStr))
        {
            conn.Open();
            using (SqlCommand cmd = new SqlCommand("SELECT COUNT(*) FROM Poems", conn))
            {
                int count = (int)cmd.ExecuteScalar();
                Console.WriteLine("TOTAL_POEMS:" + count);
            }
        }
    }
}
