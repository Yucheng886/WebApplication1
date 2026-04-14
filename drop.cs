using System;
using System.Data.SqlClient;

class Program
{
    static void Main()
    {
        string connStr = @"Data Source=(LocalDB)\MSSQLLocalDB;AttachDbFilename=D:\WebApplication1\WebApplication1\WebApplication1\App_Data\PoemDatabase.mdf;Integrated Security=True";
        try {
            using (SqlConnection conn = new SqlConnection(connStr))
            {
                conn.Open();
                // 1. Drop the default constraint dynamically
                string dropConstraintSql = @"
                    DECLARE @ConstraintName nvarchar(200)
                    SELECT @ConstraintName = Name FROM sys.default_constraints
                    WHERE parent_object_id = OBJECT_ID('Cities') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('Cities'), 'Count', 'ColumnId')
                    IF @ConstraintName IS NOT NULL
                    EXEC('ALTER TABLE Cities DROP CONSTRAINT ' + @ConstraintName)
                ";
                using (SqlCommand cmd = new SqlCommand(dropConstraintSql, conn))
                {
                    cmd.ExecuteNonQuery();
                }
                
                // 2. Drop the column
                using (SqlCommand cmd2 = new SqlCommand("IF COL_LENGTH('Cities', 'Count') IS NOT NULL ALTER TABLE Cities DROP COLUMN Count;", conn))
                {
                    cmd2.ExecuteNonQuery();
                    Console.WriteLine("SUCCESS: Count constraint and column dropped.");
                }
            }
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
            Console.WriteLine(ex.StackTrace);
        }
    }
}
