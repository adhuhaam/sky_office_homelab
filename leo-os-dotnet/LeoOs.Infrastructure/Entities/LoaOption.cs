using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("loa_options")]
public class LoaOption
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("company_id")]
    public int CompanyId { get; set; }
    [Column("category")]
    public string Category { get; set; } = "";
    [Column("value")]
    public string Value { get; set; } = "";
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
