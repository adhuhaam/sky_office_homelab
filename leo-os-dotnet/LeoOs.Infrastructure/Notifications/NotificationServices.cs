using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using LeoOs.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LeoOs.Infrastructure.Notifications;

public interface ISmsTemplateService
{
    Task<string?> RenderAsync(string code, IReadOnlyDictionary<string, string>? vars, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationTemplate>> ListAsync(CancellationToken ct = default);
}

public sealed class SmsTemplateService : ISmsTemplateService
{
    private readonly LeoOsDbContext _db;
    public SmsTemplateService(LeoOsDbContext db) => _db = db;

    public async Task<IReadOnlyList<NotificationTemplate>> ListAsync(CancellationToken ct = default)
        => await _db.NotificationTemplates.AsNoTracking().OrderBy(t => t.Code).ToListAsync(ct);

    public async Task<string?> RenderAsync(string code, IReadOnlyDictionary<string, string>? vars, CancellationToken ct = default)
    {
        var t = await _db.NotificationTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == code && x.Enabled, ct);
        if (t is null) return null;
        var msg = t.Message;
        if (vars is null) return msg;
        foreach (var (k, v) in vars)
            msg = msg.Replace("{" + k + "}", v ?? "", StringComparison.OrdinalIgnoreCase);
        return Regex.Replace(msg, @"\{[a-zA-Z0-9_]+\}", "");
    }
}

public interface ISmsGatewayService
{
    Task<(SmsGateway gateway, string plainKey)?> RegisterAsync(
        string name, string? description, string? phoneNumber, string? deviceId,
        string? deviceModel, string? androidVersion, string? appVersion, string? tailscaleIp,
        CancellationToken ct = default);
    Task<SmsGateway?> AuthenticateAsync(int gatewayId, string plainKey, CancellationToken ct = default);
    Task<SmsGateway?> GetAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<SmsGateway>> ListAsync(CancellationToken ct = default);
    Task<SmsGateway?> SelectGatewayAsync(CancellationToken ct = default);
    Task SetOnlineAsync(int id, bool online, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    static string HashKey(string plain)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(plain));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
    static string GenerateKey() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class SmsGatewayService : ISmsGatewayService
{
    private readonly LeoOsDbContext _db;
    public SmsGatewayService(LeoOsDbContext db) => _db = db;

    public async Task<(SmsGateway gateway, string plainKey)?> RegisterAsync(
        string name, string? description, string? phoneNumber, string? deviceId,
        string? deviceModel, string? androidVersion, string? appVersion, string? tailscaleIp,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var plain = ISmsGatewayService.GenerateKey();
        var now = DateTimeOffset.UtcNow;
        SmsGateway? existing = null;
        if (!string.IsNullOrWhiteSpace(deviceId))
            existing = await _db.SmsGateways.FirstOrDefaultAsync(g => g.DeviceId == deviceId, ct);

        if (existing is not null)
        {
            existing.Name = name.Trim();
            existing.Description = description;
            existing.PhoneNumber = phoneNumber;
            existing.GatewayKeyHash = ISmsGatewayService.HashKey(plain);
            existing.DeviceModel = deviceModel;
            existing.AndroidVersion = androidVersion;
            existing.AppVersion = appVersion;
            existing.TailscaleIp = tailscaleIp;
            existing.Status = "online";
            existing.LastSeen = now;
            existing.LastHeartbeat = now;
            existing.UpdatedAt = now;
            await _db.SaveChangesAsync(ct);
            return (existing, plain);
        }

        var g = new SmsGateway
        {
            Name = name.Trim(),
            Description = description,
            PhoneNumber = phoneNumber,
            GatewayKeyHash = ISmsGatewayService.HashKey(plain),
            DeviceId = deviceId,
            DeviceModel = deviceModel,
            AndroidVersion = androidVersion,
            AppVersion = appVersion,
            TailscaleIp = tailscaleIp,
            Status = "online",
            LastSeen = now,
            LastHeartbeat = now,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _db.SmsGateways.Add(g);
        await _db.SaveChangesAsync(ct);
        return (g, plain);
    }

    public async Task<SmsGateway?> AuthenticateAsync(int gatewayId, string plainKey, CancellationToken ct = default)
    {
        var g = await _db.SmsGateways.FirstOrDefaultAsync(x => x.Id == gatewayId, ct);
        if (g is null) return null;
        var hash = ISmsGatewayService.HashKey(plainKey);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(hash), Encoding.UTF8.GetBytes(g.GatewayKeyHash))
            ? g
            : null;
    }

    public Task<SmsGateway?> GetAsync(int id, CancellationToken ct = default)
        => _db.SmsGateways.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id, ct);

    public async Task<IReadOnlyList<SmsGateway>> ListAsync(CancellationToken ct = default)
        => await _db.SmsGateways.AsNoTracking().OrderByDescending(g => g.LastSeen).ToListAsync(ct);

    public async Task<SmsGateway?> SelectGatewayAsync(CancellationToken ct = default)
    {
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-2);
        var online = await _db.SmsGateways.AsNoTracking()
            .Where(g => g.Status == "online" && g.LastHeartbeat != null && g.LastHeartbeat >= cutoff)
            .OrderByDescending(g => g.Priority)
            .ThenBy(g => g.Id)
            .ToListAsync(ct);
        if (online.Count == 0) return null;

        // Least busy among online
        var counts = await _db.SmsQueue.AsNoTracking()
            .Where(q => q.Status == "Sending" || q.Status == "Pending")
            .GroupBy(q => q.GatewayId)
            .Select(g => new { GatewayId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var map = counts.Where(c => c.GatewayId != null).ToDictionary(c => c.GatewayId!.Value, c => c.Count);
        return online.OrderBy(g => map.GetValueOrDefault(g.Id, 0)).ThenByDescending(g => g.Priority).First();
    }

    public async Task SetOnlineAsync(int id, bool online, CancellationToken ct = default)
    {
        var g = await _db.SmsGateways.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (g is null) return;
        g.Status = online ? "online" : "offline";
        g.UpdatedAt = DateTimeOffset.UtcNow;
        if (online) g.LastSeen = g.UpdatedAt;
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var g = await _db.SmsGateways.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (g is null) return;
        _db.SmsGateways.Remove(g);
        await _db.SaveChangesAsync(ct);
    }
}

public interface IGatewayHeartbeatService
{
    Task<bool> HeartbeatAsync(int gatewayId, HeartbeatPayload payload, CancellationToken ct = default);
}

public sealed record HeartbeatPayload(
    int? BatteryLevel,
    int? SignalStrength,
    string? NetworkType,
    string? SimOperator,
    string? PhoneNumber,
    string? AndroidVersion,
    string? DeviceModel,
    string? AppVersion,
    string? TailscaleIp,
    int? QueueLength,
    string? Connection);

public sealed class GatewayHeartbeatService : IGatewayHeartbeatService
{
    private readonly LeoOsDbContext _db;
    public GatewayHeartbeatService(LeoOsDbContext db) => _db = db;

    public async Task<bool> HeartbeatAsync(int gatewayId, HeartbeatPayload payload, CancellationToken ct = default)
    {
        var g = await _db.SmsGateways.FirstOrDefaultAsync(x => x.Id == gatewayId, ct);
        if (g is null) return false;
        var now = DateTimeOffset.UtcNow;
        g.LastHeartbeat = now;
        g.LastSeen = now;
        g.Status = "online";
        g.BatteryLevel = payload.BatteryLevel ?? g.BatteryLevel;
        g.SignalStrength = payload.SignalStrength ?? g.SignalStrength;
        g.NetworkType = payload.NetworkType ?? g.NetworkType;
        g.SimOperator = payload.SimOperator ?? g.SimOperator;
        g.PhoneNumber = payload.PhoneNumber ?? g.PhoneNumber;
        g.AndroidVersion = payload.AndroidVersion ?? g.AndroidVersion;
        g.DeviceModel = payload.DeviceModel ?? g.DeviceModel;
        g.AppVersion = payload.AppVersion ?? g.AppVersion;
        g.TailscaleIp = payload.TailscaleIp ?? g.TailscaleIp;
        g.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

public interface ISmsQueueService
{
    Task<SmsQueueItem> EnqueueAsync(
        string recipient, string message, int priority = 0,
        string? referenceType = null, string? referenceId = null, string? templateCode = null,
        int? tenantId = null, CancellationToken ct = default);
    Task<SmsQueueItem?> ClaimNextAsync(CancellationToken ct = default);
    Task CompleteAsync(int queueId, int gatewayId, string? response, CancellationToken ct = default);
    Task FailAsync(int queueId, int? gatewayId, string error, bool scheduleRetry, CancellationToken ct = default);
    Task<IReadOnlyList<SmsQueueItem>> ListPendingAsync(int take = 50, CancellationToken ct = default);
    Task<object> StatisticsAsync(CancellationToken ct = default);
}

public sealed class SmsQueueService : ISmsQueueService
{
    private readonly LeoOsDbContext _db;
    private readonly ISmsGatewayService _gateways;
    private readonly ILogger<SmsQueueService> _log;

    public SmsQueueService(LeoOsDbContext db, ISmsGatewayService gateways, ILogger<SmsQueueService> log)
    {
        _db = db;
        _gateways = gateways;
        _log = log;
    }

    public async Task<SmsQueueItem> EnqueueAsync(
        string recipient, string message, int priority = 0,
        string? referenceType = null, string? referenceId = null, string? templateCode = null,
        int? tenantId = null, CancellationToken ct = default)
    {
        var item = new SmsQueueItem
        {
            Recipient = recipient.Trim(),
            Message = message,
            Priority = priority,
            Status = "Pending",
            TenantId = tenantId ?? 1,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            TemplateCode = templateCode,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.SmsQueue.Add(item);
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("SMS queued id={Id} to={Recipient}", item.Id, item.Recipient);
        return item;
    }

    public async Task<SmsQueueItem?> ClaimNextAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var item = await _db.SmsQueue
            .Where(q => q.Status == "Pending" && (q.NextRetryAt == null || q.NextRetryAt <= now))
            .OrderByDescending(q => q.Priority)
            .ThenBy(q => q.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (item is null) return null;

        var gateway = await _gateways.SelectGatewayAsync(ct);
        if (gateway is null) return null;

        item.Status = "Sending";
        item.GatewayId = gateway.Id;
        item.SentAt = now;
        await _db.SaveChangesAsync(ct);
        return item;
    }

    public async Task CompleteAsync(int queueId, int gatewayId, string? response, CancellationToken ct = default)
    {
        var item = await _db.SmsQueue.FirstOrDefaultAsync(q => q.Id == queueId, ct);
        if (item is null) return;
        var now = DateTimeOffset.UtcNow;
        item.Status = "Sent";
        item.GatewayId = gatewayId;
        item.CompletedAt = now;
        item.ErrorMessage = null;
        _db.SmsLogs.Add(new SmsLog
        {
            QueueId = item.Id,
            GatewayId = gatewayId,
            Recipient = item.Recipient,
            Message = item.Message,
            Status = "Sent",
            Provider = "android-sim",
            SentTime = now,
            Response = response,
            CreatedAt = now,
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task FailAsync(int queueId, int? gatewayId, string error, bool scheduleRetry, CancellationToken ct = default)
    {
        var item = await _db.SmsQueue.FirstOrDefaultAsync(q => q.Id == queueId, ct);
        if (item is null) return;
        var now = DateTimeOffset.UtcNow;
        item.ErrorMessage = error;
        item.RetryCount++;

        if (scheduleRetry && item.RetryCount < 3)
        {
            item.Status = "Pending";
            item.GatewayId = null;
            item.NextRetryAt = item.RetryCount switch
            {
                1 => now.AddSeconds(30),
                2 => now.AddMinutes(2),
                _ => now.AddMinutes(5),
            };
        }
        else
        {
            item.Status = "Failed";
            item.CompletedAt = now;
        }

        _db.SmsLogs.Add(new SmsLog
        {
            QueueId = item.Id,
            GatewayId = gatewayId ?? item.GatewayId,
            Recipient = item.Recipient,
            Message = item.Message,
            Status = item.Status == "Failed" ? "Failed" : "Retry",
            Provider = "android-sim",
            SentTime = now,
            Response = error,
            CreatedAt = now,
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<SmsQueueItem>> ListPendingAsync(int take = 50, CancellationToken ct = default)
        => await _db.SmsQueue.AsNoTracking()
            .Where(q => q.Status == "Pending" || q.Status == "Sending")
            .OrderByDescending(q => q.Priority).ThenBy(q => q.CreatedAt)
            .Take(take).ToListAsync(ct);

    public async Task<object> StatisticsAsync(CancellationToken ct = default)
    {
        var today = DateTimeOffset.UtcNow.Date;
        var rows = await _db.SmsQueue.AsNoTracking().ToListAsync(ct);
        var logsToday = await _db.SmsLogs.AsNoTracking().CountAsync(l => l.CreatedAt >= today, ct);
        return new
        {
            pending = rows.Count(r => r.Status == "Pending"),
            sending = rows.Count(r => r.Status == "Sending"),
            sent = rows.Count(r => r.Status == "Sent"),
            failed = rows.Count(r => r.Status == "Failed"),
            cancelled = rows.Count(r => r.Status == "Cancelled"),
            logsToday,
        };
    }
}

public interface INotificationService
{
    Task<SmsQueueItem> SendSmsAsync(
        string recipient, string message, int priority = 0,
        string? referenceType = null, string? referenceId = null, CancellationToken ct = default);
    Task<SmsQueueItem?> SendSmsTemplateAsync(
        string templateCode, string recipient, IReadOnlyDictionary<string, string>? vars = null,
        int priority = 0, string? referenceType = null, string? referenceId = null, CancellationToken ct = default);
    Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default);
    Task SendPushAsync(string userId, string title, string body, CancellationToken ct = default);
    Task SendWhatsAppAsync(string recipient, string message, CancellationToken ct = default);
}

public sealed class NotificationService : INotificationService
{
    private readonly ISmsQueueService _queue;
    private readonly ISmsTemplateService _templates;
    private readonly ILogger<NotificationService> _log;

    public NotificationService(ISmsQueueService queue, ISmsTemplateService templates, ILogger<NotificationService> log)
    {
        _queue = queue;
        _templates = templates;
        _log = log;
    }

    public Task<SmsQueueItem> SendSmsAsync(
        string recipient, string message, int priority = 0,
        string? referenceType = null, string? referenceId = null, CancellationToken ct = default)
        => _queue.EnqueueAsync(recipient, message, priority, referenceType, referenceId, null, null, ct);

    public async Task<SmsQueueItem?> SendSmsTemplateAsync(
        string templateCode, string recipient, IReadOnlyDictionary<string, string>? vars = null,
        int priority = 0, string? referenceType = null, string? referenceId = null, CancellationToken ct = default)
    {
        var msg = await _templates.RenderAsync(templateCode, vars, ct);
        if (msg is null)
        {
            _log.LogWarning("Template {Code} not found or disabled", templateCode);
            return null;
        }
        return await _queue.EnqueueAsync(recipient, msg, priority, referenceType, referenceId, templateCode, null, ct);
    }

    public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        _log.LogInformation("Email channel not implemented (to={To})", to);
        return Task.CompletedTask;
    }

    public Task SendPushAsync(string userId, string title, string body, CancellationToken ct = default)
    {
        _log.LogInformation("Push channel not implemented (user={User})", userId);
        return Task.CompletedTask;
    }

    public Task SendWhatsAppAsync(string recipient, string message, CancellationToken ct = default)
    {
        _log.LogInformation("WhatsApp channel not implemented (to={To})", recipient);
        return Task.CompletedTask;
    }
}
