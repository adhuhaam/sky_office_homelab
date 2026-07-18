using System.Text.RegularExpressions;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LeoOs.Infrastructure.Notifications;

/// <summary>
/// Office follow-ups to Settings → Organization → Phone (app_settings.company_phone).
/// </summary>
public interface IOrgSmsFollowUp
{
    Task<SmsQueueItem?> NotifyAsync(
        string summary,
        string? referenceType = null,
        string? referenceId = null,
        int priority = 5,
        CancellationToken ct = default);

    Task<string?> GetOrganizationPhoneAsync(CancellationToken ct = default);
}

public sealed class OrgSmsFollowUp : IOrgSmsFollowUp
{
    private readonly LeoOsDbContext _db;
    private readonly INotificationService _notifications;
    private readonly ILogger<OrgSmsFollowUp> _log;

    public OrgSmsFollowUp(LeoOsDbContext db, INotificationService notifications, ILogger<OrgSmsFollowUp> log)
    {
        _db = db;
        _notifications = notifications;
        _log = log;
    }

    public async Task<string?> GetOrganizationPhoneAsync(CancellationToken ct = default)
    {
        var row = await _db.AppSettings.AsNoTracking().OrderBy(s => s.Id).FirstOrDefaultAsync(ct);
        return ExtractPhone(row?.CompanyPhone);
    }

    public async Task<SmsQueueItem?> NotifyAsync(
        string summary,
        string? referenceType = null,
        string? referenceId = null,
        int priority = 5,
        CancellationToken ct = default)
    {
        var phone = await GetOrganizationPhoneAsync(ct);
        if (phone is null)
        {
            _log.LogInformation("Org follow-up skipped — Organization phone not set in settings");
            return null;
        }

        var vars = new Dictionary<string, string> { ["summary"] = summary };
        return await _notifications.SendSmsTemplateAsync(
            "OrgFollowUp", phone, vars, priority, referenceType, referenceId, ct);
    }

    private static string? ExtractPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = Regex.Replace(raw, @"[^\d+]", "");
        return digits.Length >= 7 ? digits : null;
    }
}
