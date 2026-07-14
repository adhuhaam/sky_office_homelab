using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("passwords")]
public class PasswordRecord
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("company_id")]
    public int CompanyId { get; set; }
    [Column("efaas_username")]
    public string EfaasUsername { get; set; } = "";
    [Column("efaas_password")]
    public string EfaasPassword { get; set; } = "";
    [Column("gmail_username")]
    public string GmailUsername { get; set; } = "";
    [Column("gmail_password")]
    public string GmailPassword { get; set; } = "";
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
