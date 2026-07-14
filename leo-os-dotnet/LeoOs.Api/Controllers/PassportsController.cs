using LeoOs.Api.Auth;
using LeoOs.Api.Services;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Notifications;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/passports")]
[RequireLeoAuth]
public sealed class PassportsController : ControllerBase
{
    private readonly LeoOsDbContext _db;
    private readonly OcrService _ocr;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<PassportsController> _logger;
    private readonly INotificationService _notifications;

    private const string XpatBase = "https://mobile-xpat.egov.mv/api/v1";
    private const string XpatApiKey = "d110e2a8-5adc-4f7b-90a0-701b4fedf476";

    public PassportsController(
        LeoOsDbContext db, OcrService ocr,
        IHttpClientFactory httpFactory, ILogger<PassportsController> logger,
        INotificationService notifications)
    {
        _db = db;
        _ocr = ocr;
        _httpFactory = httpFactory;
        _logger = logger;
        _notifications = notifications;
    }

    public sealed record UpdatePassportBody(
        string? FullName, string? PassportNumber,
        string? DateOfBirth, string? DateOfIssue, string? DateOfExpiry,
        string? Address, string? EmergencyContactName, string? EmergencyContactPhone,
        string? Nationality, string? Status,
        int? CompanyId, int? ClientId,
        string? WorkPermitNumber, string? Agent,
        string? AgencySalary, string? ClientSalary, string? AgentRate,
        string? EmployeeType, bool? Submitted
    );

    private void ApplyRoleScope(string role, string? linkedId,
        ref IQueryable<Passport> query, out bool ok, out string? error)
    {
        ok = true; error = null;
        if (role is "superuser" or "admin") return;
        if (role == "company")
        {
            if (!int.TryParse(linkedId, out var eid)) { ok = false; error = "Access denied — no linked company on session"; return; }
            query = query.Where(p => p.CompanyId == eid);
        }
        else if (role == "client")
        {
            if (!int.TryParse(linkedId, out var eid)) { ok = false; error = "Access denied — no linked client on session"; return; }
            query = query.Where(p => p.ClientId == eid);
        }
        else if (role == "employee")
        {
            if (!int.TryParse(linkedId, out var pid)) { ok = false; error = "Access denied — no linked passport on session"; return; }
            query = query.Where(p => p.Id == pid);
        }
        else if (role == "agent")
        {
            if (string.IsNullOrEmpty(linkedId)) { ok = false; error = "Access denied — no linked agent name on session"; return; }
            query = query.Where(p => p.Agent == linkedId);
        }
        else { ok = false; error = "Access denied"; }
    }

    private bool CanRead(string role, string? linkedId, Passport p) =>
        role switch
        {
            "superuser" or "admin" => true,
            "company" => int.TryParse(linkedId, out var eid) && p.CompanyId == eid,
            "client" => int.TryParse(linkedId, out var eid) && p.ClientId == eid,
            "employee" => int.TryParse(linkedId, out var pid) && p.Id == pid,
            "agent" => !string.IsNullOrEmpty(linkedId) && p.Agent == linkedId,
            _ => false,
        };

    private IQueryable<object> PassportSelect() =>
        _db.Passports.AsNoTracking()
            .GroupJoin(_db.Companies.AsNoTracking(), p => p.CompanyId, c => c.Id, (p, cs) => new { p, cs })
            .SelectMany(x => x.cs.DefaultIfEmpty(), (x, c) => new { x.p, c })
            .GroupJoin(_db.Clients.AsNoTracking(), x => x.p.ClientId, cl => cl.Id, (x, cls) => new { x.p, x.c, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new { x.p, x.c, cl })
            .GroupJoin(_db.LoaEntries.AsNoTracking(), x => x.p.Id, l => l.PassportId, (x, ls) => new { x.p, x.c, x.cl, ls })
            .SelectMany(x => x.ls.DefaultIfEmpty(), (x, l) => new
            {
                x.p.Id, x.p.FullName, x.p.PassportNumber,
                x.p.DateOfBirth, x.p.DateOfIssue, x.p.DateOfExpiry,
                x.p.Address, x.p.EmergencyContactName, x.p.EmergencyContactPhone,
                x.p.Nationality, x.p.Status, x.p.Submitted, x.p.ErrorMessage, x.p.OriginalFilename,
                x.p.CompanyId,
                companyName = x.c != null ? x.c.Name : null,
                x.p.ClientId,
                clientName = x.cl != null ? x.cl.Name : null,
                x.p.WorkPermitNumber, x.p.Agent,
                x.p.AgencySalary, x.p.ClientSalary, x.p.AgentRate,
                x.p.EmployeeType,
                jobTitle = l != null ? l.JobTitle : null,
                x.p.CreatedAt, x.p.UpdatedAt,
            });

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? nationality,
        [FromQuery] string? status,
        [FromQuery] int? companyId,
        [FromQuery] int? clientId,
        CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId;

        var q = _db.Passports.AsNoTracking();
        bool ok; string? scopeError;
        ApplyRoleScope(role, linkedId, ref q, out ok, out scopeError);
        if (!ok) return StatusCode(403, new { error = scopeError });

        if (!string.IsNullOrWhiteSpace(nationality)) q = q.Where(p => p.Nationality == nationality);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(p => p.Status == status);
        if (companyId.HasValue) q = q.Where(p => p.CompanyId == companyId.Value);
        if (clientId.HasValue) q = q.Where(p => p.ClientId == clientId.Value);

        var rows = await q
            .GroupJoin(_db.Companies.AsNoTracking(), p => p.CompanyId, c => c.Id, (p, cs) => new { p, cs })
            .SelectMany(x => x.cs.DefaultIfEmpty(), (x, c) => new { x.p, c })
            .GroupJoin(_db.Clients.AsNoTracking(), x => x.p.ClientId, cl => cl.Id, (x, cls) => new { x.p, x.c, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new { x.p, x.c, cl })
            .GroupJoin(_db.LoaEntries.AsNoTracking(), x => x.p.Id, l => l.PassportId, (x, ls) => new { x.p, x.c, x.cl, ls })
            .SelectMany(x => x.ls.DefaultIfEmpty(), (x, l) => new
            {
                x.p.Id, x.p.FullName, x.p.PassportNumber,
                x.p.DateOfBirth, x.p.DateOfIssue, x.p.DateOfExpiry,
                x.p.Address, x.p.EmergencyContactName, x.p.EmergencyContactPhone,
                x.p.Nationality, x.p.Status, x.p.Submitted, x.p.ErrorMessage, x.p.OriginalFilename,
                x.p.CompanyId,
                companyName = x.c != null ? x.c.Name : (string?)null,
                x.p.ClientId,
                clientName = x.cl != null ? x.cl.Name : (string?)null,
                x.p.WorkPermitNumber, x.p.Agent,
                x.p.AgencySalary, x.p.ClientSalary, x.p.AgentRate,
                x.p.EmployeeType,
                jobTitle = l != null ? l.JobTitle : (string?)null,
                x.p.CreatedAt, x.p.UpdatedAt,
            })
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        IEnumerable<dynamic> result = rows;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q2 = search.Trim().ToLowerInvariant();
            result = rows.Where(p =>
                (p.FullName?.ToLower()?.Contains(q2) ?? false) ||
                (p.PassportNumber?.ToLower()?.Contains(q2) ?? false) ||
                (p.Nationality?.ToLower()?.Contains(q2) ?? false) ||
                (p.companyName?.ToLower()?.Contains(q2) ?? false) ||
                (p.clientName?.ToLower()?.Contains(q2) ?? false));
        }

        return Ok(result);
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId;

        var q = _db.Passports.AsNoTracking();
        bool ok; string? scopeError;
        ApplyRoleScope(role, linkedId, ref q, out ok, out scopeError);
        if (!ok) return StatusCode(403, new { error = scopeError });

        var all = await q.Select(p => new { p.Nationality, p.Status }).ToListAsync(ct);

        return Ok(new
        {
            total = all.Count,
            processing = all.Count(p => p.Status == "processing"),
            completed = all.Count(p => p.Status == "completed"),
            bangladeshi = all.Count(p => p.Nationality?.ToLower() == "bangladesh"),
            indian = all.Count(p => p.Nationality?.ToLower() == "india"),
        });
    }

    [HttpGet("work-permit-alerts")]
    public async Task<IActionResult> WorkPermitAlerts(CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId;

        var q = _db.Passports.AsNoTracking();
        bool ok; string? scopeError;
        ApplyRoleScope(role, linkedId, ref q, out ok, out scopeError);
        if (!ok) return StatusCode(403, new { error = scopeError });

        var candidates = await q
            .Where(p => p.WorkPermitNumber != null && p.PassportNumber != null
                && p.WorkPermitNumber != "" && p.PassportNumber != "")
            .Select(p => new {
                p.Id, p.WorkPermitNumber, p.PassportNumber, p.FullName, p.EmergencyContactPhone
            })
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var threeMonths = today.AddMonths(3);

        var http = _httpFactory.CreateClient();
        http.DefaultRequestHeaders.Add("ApiKey", XpatApiKey);
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var expired = new List<object>();
        var expiringSoon = new List<object>();
        var notifyJobs = new List<(int PassportId, string Name, string PassportNumber, string Expiry, string? Phone)>();

        var sem = new SemaphoreSlim(6, 6);
        await Task.WhenAll(candidates.Select(async p =>
        {
            await sem.WaitAsync(ct);
            try
            {
                var url = $"{XpatBase}/WorkPermit?WorkPermitNumber={Uri.EscapeDataString(p.WorkPermitNumber!)}" +
                          $"&PassportNumber={Uri.EscapeDataString(p.PassportNumber!)}";
                HttpResponseMessage resp;
                try { resp = await http.GetAsync(url, ct); }
                catch { return; }
                if (!resp.IsSuccessStatusCode) return;

                using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                if (!root.TryGetProperty("workPermitExpiry", out var expProp)) return;
                var expStr = expProp.GetString();
                if (!DateOnly.TryParse(expStr, out var expiry)) return;

                string? status = null;
                if (expiry < today) status = "expired";
                else if (expiry <= threeMonths) status = "expiring_soon";
                if (status is null) return;

                var name = root.TryGetProperty("fullName", out var fn) ? fn.GetString() ?? p.FullName ?? "Unknown" : p.FullName ?? "Unknown";
                var row = new
                {
                    passportId = p.Id,
                    employeeName = name,
                    employerName = root.TryGetProperty("employerName", out var en) ? en.GetString() : (string?)null,
                    workPermitNumber = p.WorkPermitNumber!,
                    passportNumber = p.PassportNumber!,
                    expiryDate = expStr,
                    photoUrl = root.TryGetProperty("photoUrl", out var ph) ? ph.GetString() : (string?)null,
                    status,
                };

                lock (expired)
                {
                    if (status == "expired") expired.Add(row);
                    else
                    {
                        expiringSoon.Add(row);
                        notifyJobs.Add((p.Id, name, p.PassportNumber!, expStr!, p.EmergencyContactPhone));
                    }
                }
            }
            finally { sem.Release(); }
        }));

        await TryNotifyPermitExpiringAsync(notifyJobs, ct);

        Response.Headers.CacheControl = "public, max-age=900";
        return Ok(new
        {
            expired = expired.OrderBy(r => ((dynamic)r).expiryDate),
            expiringSoon = expiringSoon.OrderBy(r => ((dynamic)r).expiryDate),
        });
    }

    private async Task TryNotifyPermitExpiringAsync(
        List<(int PassportId, string Name, string PassportNumber, string Expiry, string? Phone)> jobs,
        CancellationToken ct)
    {
        if (jobs.Count == 0) return;
        var since = DateTimeOffset.UtcNow.AddDays(-7);
        foreach (var job in jobs)
        {
            try
            {
                var phone = ExtractPhone(job.Phone);
                if (phone is null) continue;

                var refId = job.PassportId.ToString();
                var recent = await _db.SmsQueue.AsNoTracking().AnyAsync(q =>
                    q.ReferenceType == "permit_expiry" && q.ReferenceId == refId && q.CreatedAt >= since, ct);
                if (recent) continue;

                var vars = new Dictionary<string, string>
                {
                    ["name"] = job.Name,
                    ["passport"] = job.PassportNumber,
                    ["expiryDate"] = job.Expiry,
                };
                await _notifications.SendSmsTemplateAsync(
                    "PermitExpiring", phone, vars, priority: 8,
                    referenceType: "permit_expiry", referenceId: refId, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to enqueue permit expiry SMS for passport {Id}", job.PassportId);
            }
        }
    }

    private static string? ExtractPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = Regex.Replace(raw, @"[^\d+]", "");
        return digits.Length >= 7 ? digits : null;
    }

    [HttpPost("upload")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Upload(IFormFile? file, [FromForm] int? companyId, CancellationToken ct)
    {
        if (file is null) return BadRequest(new { error = "No file uploaded" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        int? effectiveCompanyId = companyId;
        if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            effectiveCompanyId = eid;
        }

        var allowed = new[] { "image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf" };
        if (!allowed.Contains(file.ContentType))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, and PDF files are allowed" });

        var passport = new Passport
        {
            Status = "processing",
            OriginalFilename = file.FileName,
            CompanyId = effectiveCompanyId,
        };
        _db.Passports.Add(passport);
        await _db.SaveChangesAsync(ct);

        var passportId = passport.Id;
        var mime = file.ContentType;

        // Read file bytes before request ends
        byte[] fileBytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms, ct);
            fileBytes = ms.ToArray();
        }

        // Run OCR in background
        _ = Task.Run(async () =>
        {
            using var scope = HttpContext.RequestServices.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LeoOsDbContext>();
            var ocr = scope.ServiceProvider.GetRequiredService<OcrService>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<PassportsController>>();
            try
            {
                var extracted = await ocr.ExtractPassportDataAsync(fileBytes, mime, db, CancellationToken.None);
                var rec = await db.Passports.FirstOrDefaultAsync(p => p.Id == passportId);
                if (rec is null) return;
                if (extracted is not null)
                {
                    rec.FullName = extracted.FullName;
                    rec.PassportNumber = extracted.PassportNumber;
                    rec.DateOfBirth = extracted.DateOfBirth;
                    rec.DateOfIssue = extracted.DateOfIssue;
                    rec.DateOfExpiry = extracted.DateOfExpiry;
                    rec.Nationality = extracted.Nationality;
                    rec.Address = extracted.Address;
                }
                rec.Status = "completed";
                await db.SaveChangesAsync();
                logger.LogInformation("OCR extraction completed for passport {Id}", passportId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "OCR extraction failed for passport {Id} — deleting draft", passportId);
                try
                {
                    var rec = await db.Passports.FirstOrDefaultAsync(p => p.Id == passportId);
                    if (rec is not null) { db.Passports.Remove(rec); await db.SaveChangesAsync(); }
                }
                catch { }
            }
        });

        return StatusCode(201, passport);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var passport = await _db.Passports.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        if (passport is null) return NotFound(new { error = "Passport not found" });

        var session = HttpContext.GetLeoSession()!;
        if (!CanRead(session.Data.Role ?? "", session.Data.LinkedEntityId, passport))
            return StatusCode(403, new { error = "Access denied" });

        var result = await _db.Passports.AsNoTracking()
            .Where(p => p.Id == id)
            .GroupJoin(_db.Companies.AsNoTracking(), p => p.CompanyId, c => c.Id, (p, cs) => new { p, cs })
            .SelectMany(x => x.cs.DefaultIfEmpty(), (x, c) => new { x.p, c })
            .GroupJoin(_db.Clients.AsNoTracking(), x => x.p.ClientId, cl => cl.Id, (x, cls) => new { x.p, x.c, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new { x.p, x.c, cl })
            .GroupJoin(_db.LoaEntries.AsNoTracking(), x => x.p.Id, l => l.PassportId, (x, ls) => new { x.p, x.c, x.cl, ls })
            .SelectMany(x => x.ls.DefaultIfEmpty(), (x, l) => new
            {
                x.p.Id, x.p.FullName, x.p.PassportNumber,
                x.p.DateOfBirth, x.p.DateOfIssue, x.p.DateOfExpiry,
                x.p.Address, x.p.EmergencyContactName, x.p.EmergencyContactPhone,
                x.p.Nationality, x.p.Status, x.p.Submitted, x.p.ErrorMessage, x.p.OriginalFilename,
                x.p.CompanyId,
                companyName = x.c != null ? x.c.Name : (string?)null,
                x.p.ClientId,
                clientName = x.cl != null ? x.cl.Name : (string?)null,
                x.p.WorkPermitNumber, x.p.Agent,
                x.p.AgencySalary, x.p.ClientSalary, x.p.AgentRate,
                x.p.EmployeeType,
                jobTitle = l != null ? l.JobTitle : (string?)null,
                x.p.CreatedAt, x.p.UpdatedAt,
            })
            .FirstOrDefaultAsync(ct);

        return Ok(result);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePassportBody body, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        var passport = await _db.Passports.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (passport is null) return NotFound(new { error = "Passport not found" });

        if (role is "superuser" or "admin")
        {
            // ok
        }
        else if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            if (passport.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — passport not linked to your company" });
            if (body.ClientId.HasValue)
                return StatusCode(403, new { error = "Company role cannot assign client allocations" });
        }
        else
        {
            return StatusCode(403, new { error = "Insufficient permissions to update passports" });
        }

        if (body.ClientId.HasValue && body.ClientId.Value != 0)
        {
            var exists = await _db.Clients.AnyAsync(c => c.Id == body.ClientId.Value, ct);
            if (!exists) return BadRequest(new { error = "Allocation client does not exist" });
        }
        if (body.CompanyId.HasValue && body.CompanyId.Value != 0)
        {
            var exists = await _db.Companies.AnyAsync(c => c.Id == body.CompanyId.Value, ct);
            if (!exists) return BadRequest(new { error = "Company does not exist" });
        }

        bool ecChanged = false, companyChanged = false;

        if (body.FullName is not null) passport.FullName = body.FullName;
        if (body.PassportNumber is not null) passport.PassportNumber = body.PassportNumber;
        if (body.DateOfBirth is not null) passport.DateOfBirth = body.DateOfBirth;
        if (body.DateOfIssue is not null) passport.DateOfIssue = body.DateOfIssue;
        if (body.DateOfExpiry is not null) passport.DateOfExpiry = body.DateOfExpiry;
        if (body.Address is not null) passport.Address = body.Address;
        if (body.EmergencyContactName is not null) { passport.EmergencyContactName = body.EmergencyContactName; ecChanged = true; }
        if (body.EmergencyContactPhone is not null) { passport.EmergencyContactPhone = body.EmergencyContactPhone; ecChanged = true; }
        if (body.Nationality is not null) passport.Nationality = body.Nationality;
        if (body.Status is not null) passport.Status = body.Status;
        if (body.ClientId.HasValue) passport.ClientId = body.ClientId.Value == 0 ? null : body.ClientId;
        if (body.CompanyId.HasValue) { passport.CompanyId = body.CompanyId.Value == 0 ? null : body.CompanyId; companyChanged = true; }
        if (body.WorkPermitNumber is not null) passport.WorkPermitNumber = body.WorkPermitNumber;
        if (body.Agent is not null) passport.Agent = body.Agent;
        if (body.EmployeeType is not null) passport.EmployeeType = body.EmployeeType;
        if (body.Submitted.HasValue) passport.Submitted = body.Submitted.Value;

        await _db.SaveChangesAsync(ct);

        // Propagate EC to LOA
        if (ecChanged)
        {
            var loa = await _db.LoaEntries.FirstOrDefaultAsync(l => l.PassportId == id, ct);
            if (loa is not null)
            {
                loa.CandidateEmergencyContact = EmergencyContact.Format(passport.EmergencyContactName, passport.EmergencyContactPhone);
                await _db.SaveChangesAsync(ct);
            }
        }

        // Propagate company info to LOA
        if (companyChanged)
        {
            var loa = await _db.LoaEntries.FirstOrDefaultAsync(l => l.PassportId == id, ct);
            if (loa is not null)
            {
                if (passport.CompanyId is int cid)
                {
                    var company = await _db.Companies.AsNoTracking()
                        .FirstOrDefaultAsync(c => c.Id == cid, ct);
                    if (company is not null)
                    {
                        loa.CompanyId = company.Id;
                        loa.CompanyName = company.Name;
                        loa.CompanyAddress = company.Address;
                        loa.CompanyEmail = company.Email;
                        loa.CompanyPhone = company.Phone;
                        loa.CompanyCountry = company.Country;
                        loa.CompanyRegistrationNumber = company.RegistrationNumber;
                    }
                }
                else
                {
                    loa.CompanyId = null;
                    loa.CompanyName = null; loa.CompanyAddress = null;
                    loa.CompanyEmail = null; loa.CompanyPhone = null;
                    loa.CompanyCountry = null; loa.CompanyRegistrationNumber = null;
                }
                await _db.SaveChangesAsync(ct);
            }
        }

        return Ok(passport);
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var passport = await _db.Passports.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (passport is null) return NotFound(new { error = "Passport not found" });

        _db.Passports.Remove(passport);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
