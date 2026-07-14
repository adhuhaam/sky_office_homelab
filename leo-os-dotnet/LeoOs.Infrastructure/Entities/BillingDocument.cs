using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("billing_documents")]
public class BillingDocument
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("kind")]
    public string Kind { get; set; } = "";
    [Column("number")]
    public string Number { get; set; } = "";
    [Column("company_id")]
    public int CompanyId { get; set; }
    [Column("client_id")]
    public int? ClientId { get; set; }
    [Column("customer_name")]
    public string CustomerName { get; set; } = "";
    [Column("customer_address")]
    public string? CustomerAddress { get; set; }
    [Column("customer_tin")]
    public string? CustomerTin { get; set; }
    [Column("issue_date")]
    public DateOnly IssueDate { get; set; }
    [Column("due_date")]
    public DateOnly? DueDate { get; set; }
    [Column("terms")]
    public string? Terms { get; set; }
    [Column("gst_rate", TypeName = "numeric(5,2)")]
    public decimal GstRate { get; set; }
    [Column("gst_inclusive")]
    public bool GstInclusive { get; set; } = true;
    [Column("notes")]
    public string? Notes { get; set; }
    [Column("status")]
    public string Status { get; set; } = "draft";
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
