using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("sms_queue")]
public class SmsQueueItem
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("gateway_id")]
    public int? GatewayId { get; set; }

    [Column("tenant_id")]
    public int? TenantId { get; set; }

    [Column("recipient")]
    public string Recipient { get; set; } = "";

    [Column("message")]
    public string Message { get; set; } = "";

    [Column("priority")]
    public int Priority { get; set; }

    /// <summary>Pending | Sending | Sent | Failed | Cancelled</summary>
    [Column("status")]
    public string Status { get; set; } = "Pending";

    [Column("retry_count")]
    public int RetryCount { get; set; }

    [Column("next_retry_at")]
    public DateTimeOffset? NextRetryAt { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("sent_at")]
    public DateTimeOffset? SentAt { get; set; }

    [Column("completed_at")]
    public DateTimeOffset? CompletedAt { get; set; }

    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    [Column("reference_type")]
    public string? ReferenceType { get; set; }

    [Column("reference_id")]
    public string? ReferenceId { get; set; }

    [Column("template_code")]
    public string? TemplateCode { get; set; }
}
