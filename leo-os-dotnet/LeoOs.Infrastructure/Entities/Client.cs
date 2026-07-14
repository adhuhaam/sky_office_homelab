using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("clients")]
public class Client
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("name")]
    public string Name { get; set; } = "";
    [Column("contact_person")]
    public string? ContactPerson { get; set; }
    [Column("phone")]
    public string? Phone { get; set; }
    [Column("email")]
    public string? Email { get; set; }
    [Column("address")]
    public string? Address { get; set; }
    [Column("tin")]
    public string? Tin { get; set; }
    [Column("notes")]
    public string? Notes { get; set; }
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
