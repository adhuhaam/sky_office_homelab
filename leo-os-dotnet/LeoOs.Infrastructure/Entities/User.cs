using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("users")]
public class User
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("email")]
    public string Email { get; set; } = "";
    [Column("name")]
    public string Name { get; set; } = "";
    [Column("role")]
    public string Role { get; set; } = "agent";
    [Column("password_hash")]
    public string? PasswordHash { get; set; }
    [Column("is_approved")]
    public bool IsApproved { get; set; }
    [Column("is_blocked")]
    public bool IsBlocked { get; set; }
    [Column("linked_entity_id")]
    public string? LinkedEntityId { get; set; }
    [Column("phone")]
    public string? Phone { get; set; }
    [Column("designation")]
    public string? Designation { get; set; }
    [Column("company_id")]
    public int? CompanyId { get; set; }
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
