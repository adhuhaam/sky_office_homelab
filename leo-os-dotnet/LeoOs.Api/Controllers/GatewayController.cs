using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/gateway")]
public sealed class GatewayController : ControllerBase
{
    private readonly ISmsGatewayService _gateways;
    private readonly IGatewayHeartbeatService _heartbeat;
    private readonly ISmsQueueService _queue;
    private readonly LeoOsDbContext _db;

    public GatewayController(
        ISmsGatewayService gateways,
        IGatewayHeartbeatService heartbeat,
        ISmsQueueService queue,
        LeoOsDbContext db)
    {
        _gateways = gateways;
        _heartbeat = heartbeat;
        _queue = queue;
        _db = db;
    }

    public sealed record RegisterBody(
        string Name, string? Description, string? PhoneNumber, string? DeviceId,
        string? DeviceModel, string? AndroidVersion, string? AppVersion, string? TailscaleIp);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterBody body, CancellationToken ct)
    {
        var result = await _gateways.RegisterAsync(
            body.Name, body.Description, body.PhoneNumber, body.DeviceId,
            body.DeviceModel, body.AndroidVersion, body.AppVersion, body.TailscaleIp, ct);
        if (result is null) return BadRequest(new { error = "name is required" });
        var (g, key) = result.Value;
        return Ok(new
        {
            id = g.Id,
            name = g.Name,
            gatewayKey = key,
            hubPath = "/hubs/sms-gateway",
            heartbeatIntervalSeconds = 30,
            isDefault = g.IsDefault,
        });
    }

    public sealed record HeartbeatBody(
        int GatewayId, string GatewayKey,
        int? BatteryLevel, int? SignalStrength, string? NetworkType, string? SimOperator,
        string? PhoneNumber, string? AndroidVersion, string? DeviceModel, string? AppVersion,
        string? TailscaleIp, int? QueueLength, string? Connection);

    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatBody body, CancellationToken ct)
    {
        var g = await _gateways.AuthenticateAsync(body.GatewayId, body.GatewayKey, ct);
        if (g is null) return Unauthorized(new { error = "Invalid gateway credentials" });
        await _heartbeat.HeartbeatAsync(body.GatewayId, new HeartbeatPayload(
            body.BatteryLevel, body.SignalStrength, body.NetworkType, body.SimOperator,
            body.PhoneNumber, body.AndroidVersion, body.DeviceModel, body.AppVersion,
            body.TailscaleIp, body.QueueLength, body.Connection), ct);
        return Ok(new { ok = true });
    }

    public sealed record ResultBody(int GatewayId, string GatewayKey, int QueueId, bool Success, string? Response);

    [HttpPost("result")]
    public async Task<IActionResult> Result([FromBody] ResultBody body, CancellationToken ct)
    {
        var g = await _gateways.AuthenticateAsync(body.GatewayId, body.GatewayKey, ct);
        if (g is null) return Unauthorized(new { error = "Invalid gateway credentials" });
        if (body.Success)
            await _queue.CompleteAsync(body.QueueId, body.GatewayId, body.Response, ct);
        else
            await _queue.FailAsync(body.QueueId, body.GatewayId, body.Response ?? "failed", scheduleRetry: true, ct);
        return Ok(new { ok = true });
    }

    [HttpGet("config")]
    public async Task<IActionResult> Config([FromQuery] int gatewayId, [FromQuery] string gatewayKey, CancellationToken ct)
    {
        var g = await _gateways.AuthenticateAsync(gatewayId, gatewayKey, ct);
        if (g is null) return Unauthorized(new { error = "Invalid gateway credentials" });
        return Ok(new
        {
            gatewayId = g.Id,
            name = g.Name,
            heartbeatIntervalSeconds = 30,
            hubPath = "/hubs/sms-gateway",
            maxRetries = 3,
            isDefault = g.IsDefault,
            role = g.IsDefault ? "default" : "standby",
            status = g.Status,
            lastHeartbeat = g.LastHeartbeat,
        });
    }

    [HttpGet]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var list = await _gateways.ListAsync(ct);
        var today = DateTimeOffset.UtcNow.Date;
        var sentToday = await _db.SmsLogs.AsNoTracking()
            .Where(l => l.Status == "Sent" && l.CreatedAt >= today)
            .GroupBy(l => l.GatewayId)
            .Select(g => new { GatewayId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var failedToday = await _db.SmsLogs.AsNoTracking()
            .Where(l => l.Status == "Failed" && l.CreatedAt >= today)
            .GroupBy(l => l.GatewayId)
            .Select(g => new { GatewayId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var queued = await _db.SmsQueue.AsNoTracking()
            .Where(q => q.Status == "Pending" || q.Status == "Sending")
            .GroupBy(q => q.GatewayId)
            .Select(g => new { GatewayId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return Ok(list.Select(g => new
        {
            g.Id, g.Name, g.Description, g.PhoneNumber, g.Status,
            g.LastHeartbeat, g.BatteryLevel, g.SignalStrength, g.NetworkType, g.SimOperator,
            g.AndroidVersion, g.DeviceModel, g.AppVersion, g.TailscaleIp, g.LastSeen, g.Priority,
            isDefault = g.IsDefault,
            queued = queued.FirstOrDefault(q => q.GatewayId == g.Id)?.Count ?? 0,
            sentToday = sentToday.FirstOrDefault(q => q.GatewayId == g.Id)?.Count ?? 0,
            failedToday = failedToday.FirstOrDefault(q => q.GatewayId == g.Id)?.Count ?? 0,
        }));
    }

    [HttpGet("{id:int}")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var g = await _gateways.GetAsync(id, ct);
        return g is null ? NotFound(new { error = "Not found" }) : Ok(g);
    }

    public sealed record AdminCreateBody(string Name, string? Description, string? PhoneNumber, int? Priority);

    [HttpPost]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> AdminCreate([FromBody] AdminCreateBody body, CancellationToken ct)
    {
        var result = await _gateways.RegisterAsync(body.Name, body.Description, body.PhoneNumber, null, null, null, null, null, ct);
        if (result is null) return BadRequest(new { error = "name is required" });
        var (g, key) = result.Value;
        if (body.Priority is int p)
        {
            var row = await _db.SmsGateways.FirstAsync(x => x.Id == g.Id, ct);
            row.Priority = p;
            await _db.SaveChangesAsync(ct);
            g.Priority = p;
        }
        return Ok(new { g.Id, g.Name, gatewayKey = key, note = "Store gatewayKey now; it is shown once." });
    }

    [HttpPost("{id:int}/set-default")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> SetDefault(int id, CancellationToken ct)
    {
        var ok = await _gateways.SetDefaultAsync(id, ct);
        if (!ok) return NotFound(new { error = "Gateway not found" });
        return Ok(new { id, isDefault = true });
    }

    [HttpDelete("{id:int}")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _gateways.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/sms")]
public sealed class SmsController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly ISmsQueueService _queue;
    private readonly LeoOsDbContext _db;
    private readonly IOrgSmsFollowUp _orgSms;

    public SmsController(
        INotificationService notifications,
        ISmsQueueService queue,
        LeoOsDbContext db,
        IOrgSmsFollowUp orgSms)
    {
        _notifications = notifications;
        _queue = queue;
        _db = db;
        _orgSms = orgSms;
    }

    public sealed record SendBody(string Recipient, string Message, int? Priority, string? ReferenceType, string? ReferenceId, string? TemplateCode);

    public sealed record OrgFollowUpBody(string? Summary);

    [HttpPost("notify-org")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> NotifyOrg([FromBody] OrgFollowUpBody? body, CancellationToken ct)
    {
        var summary = string.IsNullOrWhiteSpace(body?.Summary)
            ? "Manual follow-up from SMS Gateways"
            : body!.Summary!.Trim();
        var phone = await _orgSms.GetOrganizationPhoneAsync(ct);
        if (phone is null)
            return BadRequest(new { error = "Organization phone is not set in Settings" });
        var item = await _orgSms.NotifyAsync(summary, referenceType: "manual_org", ct: ct);
        if (item is null) return BadRequest(new { error = "Failed to enqueue" });
        return Ok(new { id = item.Id, status = item.Status, recipient = phone });
    }

    [HttpGet("org-phone")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> OrgPhone(CancellationToken ct)
    {
        var phone = await _orgSms.GetOrganizationPhoneAsync(ct);
        return Ok(new { phone });
    }

    [HttpPost("send")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Send([FromBody] SendBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Recipient))
            return BadRequest(new { error = "recipient required" });

        SmsQueueItem item;
        if (!string.IsNullOrWhiteSpace(body.TemplateCode))
        {
            var created = await _notifications.SendSmsTemplateAsync(
                body.TemplateCode!, body.Recipient, null, body.Priority ?? 0,
                body.ReferenceType, body.ReferenceId, ct);
            if (created is null) return BadRequest(new { error = "template not found" });
            item = created;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(body.Message))
                return BadRequest(new { error = "message required" });
            item = await _notifications.SendSmsAsync(
                body.Recipient, body.Message, body.Priority ?? 0, body.ReferenceType, body.ReferenceId, ct);
        }
        return Ok(new { id = item.Id, status = item.Status });
    }

    public sealed record BulkBody(IReadOnlyList<SendBody> Messages);

    [HttpPost("sendbulk")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> SendBulk([FromBody] BulkBody body, CancellationToken ct)
    {
        var ids = new List<int>();
        foreach (var m in body.Messages ?? Array.Empty<SendBody>())
        {
            if (string.IsNullOrWhiteSpace(m.Recipient) || string.IsNullOrWhiteSpace(m.Message)) continue;
            var item = await _notifications.SendSmsAsync(m.Recipient, m.Message, m.Priority ?? 0, m.ReferenceType, m.ReferenceId, ct);
            ids.Add(item.Id);
        }
        return Ok(new { queued = ids.Count, ids });
    }

    [HttpGet("pending")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Pending(CancellationToken ct)
        => Ok(await _queue.ListPendingAsync(100, ct));

    [HttpGet("logs")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Logs([FromQuery] int take = 100, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 500);
        var logs = await _db.SmsLogs.AsNoTracking()
            .OrderByDescending(l => l.CreatedAt)
            .Take(take)
            .ToListAsync(ct);
        return Ok(logs);
    }

    [HttpGet("statistics")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Statistics(CancellationToken ct)
        => Ok(await _queue.StatisticsAsync(ct));

    [HttpGet("templates")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Templates([FromServices] ISmsTemplateService templates, CancellationToken ct)
        => Ok(await templates.ListAsync(ct));
}
