using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("billing_items")]
public class BillingItem
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("document_id")]
    public int DocumentId { get; set; }
    [Column("position")]
    public int Position { get; set; }
    [Column("description")]
    public string Description { get; set; } = "";
    [Column("detail")]
    public string? Detail { get; set; }
    [Column("qty", TypeName = "numeric(14,4)")]
    public decimal Qty { get; set; } = 1;
    [Column("rate", TypeName = "numeric(14,4)")]
    public decimal Rate { get; set; }
    [Column("amount", TypeName = "numeric(14,2)")]
    public decimal Amount { get; set; }
}
