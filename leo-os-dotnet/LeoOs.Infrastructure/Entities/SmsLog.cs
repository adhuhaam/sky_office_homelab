using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("sms_logs")]
public class SmsLog
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("queue_id")]
    public int? QueueId { get; set; }

    [Column("gateway_id")]
    public int? GatewayId { get; set; }

    [Column("recipient")]
    public string Recipient { get; set; } = "";

    [Column("message")]
    public string Message { get; set; } = "";

    [Column("status")]
    public string Status { get; set; } = "";

    [Column("provider")]
    public string Provider { get; set; } = "android-sim";

    [Column("sent_time")]
    public DateTimeOffset? SentTime { get; set; }

    [Column("response")]
    public string? Response { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
