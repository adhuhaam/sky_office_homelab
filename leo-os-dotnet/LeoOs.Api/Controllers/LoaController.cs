using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.RegularExpressions;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api")]
[RequireLeoAuth]
public sealed class LoaController : ControllerBase
{
    private readonly LeoOsDbContext _db;
    private readonly INotificationService _notifications;
    private readonly ILogger<LoaController> _logger;

    public LoaController(LeoOsDbContext db, INotificationService notifications, ILogger<LoaController> logger)
    {
        _db = db;
        _notifications = notifications;
        _logger = logger;
    }

    public sealed record LoaBody(
        int? CompanyId, int? PassportId,
        string? CompanyName, string? CompanyAddress, string? CompanyEmail,
        string? CompanyPhone, string? CompanyCountry, string? CompanyRegistrationNumber,
        string? CandidateName, string? CandidateAddress, string? CandidateNationality,
        string? CandidateDateOfBirth, string? CandidatePassportNumber, string? CandidateEmergencyContact,
        string? JobTitle, string? WorkType, string? BasicSalary, string? SalaryPaymentDate,
        string? WorkSite, string? DateOfCommence, string? JobDescription, string? WorkingHours,
        string? WorkStatus, string? ContractDuration,
        string? SignatoryName, string? SignatoryDesignation, string? SignatureDate
    );

    [HttpGet("loa")]
    public async Task<IActionResult> List([FromQuery] int? passportId, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        IQueryable<LoaEntry> q = _db.LoaEntries.AsNoTracking();

        if (passportId.HasValue && passportId.Value > 0)
            q = q.Where(l => l.PassportId == passportId.Value);

        if (role is "superuser" or "admin")
        {
            // unrestricted
        }
        else if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            q = q.Where(l => l.CompanyId == eid);
        }
        else
        {
            return StatusCode(403, new { error = "Access denied" });
        }

        var entries = await q.OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return Ok(entries);
    }

    [HttpPost("loa")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Create([FromBody] LoaBody body, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            if (body.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — you may only create LOAs for your own company" });
        }

        if (body.PassportId.HasValue)
        {
            var existing = await _db.LoaEntries.AsNoTracking()
                .Where(l => l.PassportId == body.PassportId.Value)
                .OrderByDescending(l => l.CreatedAt)
                .FirstOrDefaultAsync(ct);
            if (existing is not null) return Ok(existing);
        }

        var loa = new LoaEntry
        {
            CompanyId = body.CompanyId, PassportId = body.PassportId,
            CompanyName = body.CompanyName, CompanyAddress = body.CompanyAddress,
            CompanyEmail = body.CompanyEmail, CompanyPhone = body.CompanyPhone,
            CompanyCountry = body.CompanyCountry, CompanyRegistrationNumber = body.CompanyRegistrationNumber,
            CandidateName = body.CandidateName, CandidateAddress = body.CandidateAddress,
            CandidateNationality = body.CandidateNationality, CandidateDateOfBirth = body.CandidateDateOfBirth,
            CandidatePassportNumber = body.CandidatePassportNumber, CandidateEmergencyContact = body.CandidateEmergencyContact,
            JobTitle = body.JobTitle, WorkType = body.WorkType, BasicSalary = body.BasicSalary,
            SalaryPaymentDate = body.SalaryPaymentDate, WorkSite = body.WorkSite,
            DateOfCommence = body.DateOfCommence, JobDescription = body.JobDescription,
            WorkingHours = body.WorkingHours, WorkStatus = body.WorkStatus, ContractDuration = body.ContractDuration,
            SignatoryName = body.SignatoryName, SignatoryDesignation = body.SignatoryDesignation,
            SignatureDate = body.SignatureDate,
        };
        _db.LoaEntries.Add(loa);
        await _db.SaveChangesAsync(ct);

        if (body.PassportId.HasValue)
        {
            var passport = await _db.Passports.FirstOrDefaultAsync(p => p.Id == body.PassportId.Value, ct);
            if (passport is not null) { passport.Submitted = true; await _db.SaveChangesAsync(ct); }
        }

        await TryNotifyLoaCreatedAsync(loa, ct);

        return StatusCode(201, loa);
    }

    private async Task TryNotifyLoaCreatedAsync(LoaEntry loa, CancellationToken ct)
    {
        try
        {
            var phone = ExtractPhone(loa.CandidateEmergencyContact) ?? ExtractPhone(loa.CompanyPhone);
            if (string.IsNullOrWhiteSpace(phone)) return;

            var vars = new Dictionary<string, string>
            {
                ["name"] = loa.CandidateName ?? "candidate",
                ["loaId"] = loa.Id.ToString(),
            };
            await _notifications.SendSmsTemplateAsync(
                "LoaCreated", phone, vars, priority: 5,
                referenceType: "loa", referenceId: loa.Id.ToString(), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to enqueue LOA created SMS for loa {Id}", loa.Id);
        }
    }

    private static string? ExtractPhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = Regex.Replace(raw, @"[^\d+]", "");
        if (digits.Length < 7) return null;
        return digits;
    }

    [HttpGet("loa/{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var loa = await _db.LoaEntries.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loa is null) return NotFound(new { error = "LOA not found" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        if (role is "superuser" or "admin") { /* ok */ }
        else if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid) || loa.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied" });
        }
        else return StatusCode(403, new { error = "Access denied" });

        return Ok(loa);
    }

    [HttpPatch("loa/{id:int}")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Update(int id, [FromBody] LoaBody body, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        var loa = await _db.LoaEntries.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loa is null) return NotFound(new { error = "LOA not found" });

        if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            if (loa.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — LOA not linked to your company" });
        }

        if (body.CompanyId.HasValue) loa.CompanyId = body.CompanyId;
        if (body.PassportId.HasValue) loa.PassportId = body.PassportId;
        if (body.CompanyName is not null) loa.CompanyName = body.CompanyName;
        if (body.CompanyAddress is not null) loa.CompanyAddress = body.CompanyAddress;
        if (body.CompanyEmail is not null) loa.CompanyEmail = body.CompanyEmail;
        if (body.CompanyPhone is not null) loa.CompanyPhone = body.CompanyPhone;
        if (body.CompanyCountry is not null) loa.CompanyCountry = body.CompanyCountry;
        if (body.CompanyRegistrationNumber is not null) loa.CompanyRegistrationNumber = body.CompanyRegistrationNumber;
        if (body.CandidateName is not null) loa.CandidateName = body.CandidateName;
        if (body.CandidateAddress is not null) loa.CandidateAddress = body.CandidateAddress;
        if (body.CandidateNationality is not null) loa.CandidateNationality = body.CandidateNationality;
        if (body.CandidateDateOfBirth is not null) loa.CandidateDateOfBirth = body.CandidateDateOfBirth;
        if (body.CandidatePassportNumber is not null) loa.CandidatePassportNumber = body.CandidatePassportNumber;
        if (body.CandidateEmergencyContact is not null) loa.CandidateEmergencyContact = body.CandidateEmergencyContact;
        if (body.JobTitle is not null) loa.JobTitle = body.JobTitle;
        if (body.WorkType is not null) loa.WorkType = body.WorkType;
        if (body.BasicSalary is not null) loa.BasicSalary = body.BasicSalary;
        if (body.SalaryPaymentDate is not null) loa.SalaryPaymentDate = body.SalaryPaymentDate;
        if (body.WorkSite is not null) loa.WorkSite = body.WorkSite;
        if (body.DateOfCommence is not null) loa.DateOfCommence = body.DateOfCommence;
        if (body.JobDescription is not null) loa.JobDescription = body.JobDescription;
        if (body.WorkingHours is not null) loa.WorkingHours = body.WorkingHours;
        if (body.WorkStatus is not null) loa.WorkStatus = body.WorkStatus;
        if (body.ContractDuration is not null) loa.ContractDuration = body.ContractDuration;
        if (body.SignatoryName is not null) loa.SignatoryName = body.SignatoryName;
        if (body.SignatoryDesignation is not null) loa.SignatoryDesignation = body.SignatoryDesignation;
        if (body.SignatureDate is not null) loa.SignatureDate = body.SignatureDate;

        await _db.SaveChangesAsync(ct);
        return Ok(loa);
    }

    [HttpDelete("loa/{id:int}")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        var loa = await _db.LoaEntries.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loa is null) return NotFound(new { error = "LOA not found" });

        if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied — no linked company on session" });
            if (loa.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — LOA not linked to your company" });
        }

        _db.LoaEntries.Remove(loa);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("loa/{id:int}/pdf")]
    public async Task<IActionResult> GetPdf(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var loa = await _db.LoaEntries.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loa is null) return NotFound(new { error = "LOA not found" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        if (role is "superuser" or "admin") { /* ok */ }
        else if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid) || loa.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied" });
        }
        else return StatusCode(403, new { error = "Access denied" });

        // Return a plain-text placeholder PDF
        var filename = $"LOA-{(loa.CandidateName?.Replace(" ", "-") ?? id.ToString())}.txt";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{filename}\"";
        var sb = new StringBuilder();
        sb.AppendLine("LETTER OF APPOINTMENT");
        sb.AppendLine();
        sb.AppendLine($"Employer: {loa.CompanyName}");
        sb.AppendLine($"Employee: {loa.CandidateName}");
        sb.AppendLine($"Job Title: {loa.JobTitle}");
        sb.AppendLine($"Basic Salary: {loa.BasicSalary}");
        sb.AppendLine($"Date of Commence: {loa.DateOfCommence}");
        sb.AppendLine($"Signatory: {loa.SignatoryName} ({loa.SignatoryDesignation})");
        return Content(sb.ToString(), "text/plain");
    }
}

