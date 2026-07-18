using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("sms_gateways")]
public class SmsGateway
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("description")]
    public string? Description { get; set; }

    [Column("phone_number")]
    public string? PhoneNumber { get; set; }

    [Column("gateway_key_hash")]
    public string GatewayKeyHash { get; set; } = "";

    [Column("status")]
    public string Status { get; set; } = "offline";

    [Column("last_heartbeat")]
    public DateTimeOffset? LastHeartbeat { get; set; }

    [Column("battery_level")]
    public int? BatteryLevel { get; set; }

    [Column("signal_strength")]
    public int? SignalStrength { get; set; }

    [Column("network_type")]
    public string? NetworkType { get; set; }

    [Column("sim_operator")]
    public string? SimOperator { get; set; }

    [Column("android_version")]
    public string? AndroidVersion { get; set; }

    [Column("device_model")]
    public string? DeviceModel { get; set; }

    [Column("app_version")]
    public string? AppVersion { get; set; }

    [Column("tailscale_ip")]
    public string? TailscaleIp { get; set; }

    [Column("device_id")]
    public string? DeviceId { get; set; }

    [Column("priority")]
    public int Priority { get; set; }

    [Column("is_default")]
    public bool IsDefault { get; set; }

    [Column("last_seen")]
    public DateTimeOffset? LastSeen { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
