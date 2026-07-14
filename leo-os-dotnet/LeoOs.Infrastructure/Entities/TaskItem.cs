using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("tasks")]
public class TaskItem
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("title")]
    public string Title { get; set; } = "";
    [Column("notes")]
    public string? Notes { get; set; }
    [Column("status")]
    public string Status { get; set; } = "todo";
    [Column("priority")]
    public string Priority { get; set; } = "medium";
    [Column("due_date")]
    public DateOnly? DueDate { get; set; }
    [Column("parent_id")]
    public int? ParentId { get; set; }
    [Column("position")]
    public int Position { get; set; }
    [Column("completed_at")]
    public DateTimeOffset? CompletedAt { get; set; }
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
