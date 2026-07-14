using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class PublicController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public PublicController(LeoOsDbContext db) => _db = db;

    // Public LOA read for unauthenticated print pages
    [HttpGet("loa/public/{id:int}")]
    public async Task<IActionResult> GetPublicLoa(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var loa = await _db.LoaEntries.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loa is null) return NotFound(new { error = "LOA not found" });

        string? letterheadImage = null, signatureImage = null;
        if (loa.CompanyId.HasValue)
        {
            var co = await _db.Companies.AsNoTracking()
                .Where(c => c.Id == loa.CompanyId.Value)
                .Select(c => new { c.LetterheadImage, c.SignatureImage })
                .FirstOrDefaultAsync(ct);
            if (co is not null) { letterheadImage = co.LetterheadImage; signatureImage = co.SignatureImage; }
        }

        return Ok(new
        {
            loa.Id, loa.CompanyId, loa.PassportId,
            loa.CompanyName, loa.CompanyAddress, loa.CompanyEmail, loa.CompanyPhone,
            loa.CompanyCountry, loa.CompanyRegistrationNumber,
            loa.CandidateName, loa.CandidateAddress, loa.CandidateNationality,
            loa.CandidateDateOfBirth, loa.CandidatePassportNumber, loa.CandidateEmergencyContact,
            loa.JobTitle, loa.WorkType, loa.BasicSalary, loa.SalaryPaymentDate,
            loa.WorkSite, loa.DateOfCommence, loa.JobDescription, loa.WorkingHours,
            loa.WorkStatus, loa.ContractDuration,
            loa.SignatoryName, loa.SignatoryDesignation, loa.SignatureDate,
            loa.CreatedAt, loa.UpdatedAt,
            letterheadImage,
            signatureImage,
        });
    }

    // Public companies list (no session — with optional branding)
    [HttpGet("companies/public")]
    public async Task<IActionResult> GetPublicCompanies([FromQuery] bool withBranding = false, CancellationToken ct = default)
    {
        var session = HttpContext.GetLeoSession();
        if (session?.Data.Authenticated == true)
            return NotFound(); // Let CompaniesController handle it

        var rows = await _db.Companies.AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        if (!withBranding)
        {
            return Ok(rows.Select(c => new
            {
                c.Id,
                c.Name,
                c.Address,
                c.Email,
                c.Phone,
                c.Country,
                c.RegistrationNumber,
                c.SignatoryName,
                c.SignatoryDesignation,
                letterheadImage = (string?)null,
                signatureImage = (string?)null,
                invoiceLogoImage = (string?)null,
                c.BankName,
                c.BankAccountNumber,
                c.BankAccountHolder,
                c.BankSwiftCode,
                c.CreatedAt,
                c.UpdatedAt,
            }));
        }
        return Ok(rows);
    }

    // Public user profile
    [HttpGet("u/{userId:int}")]
    public async Task<IActionResult> GetPublicUserProfile(int userId, CancellationToken ct)
    {
        if (userId < 1) return BadRequest(new { error = "Invalid user id" });

        var row = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Join(_db.Companies.AsNoTracking(),
                u => u.CompanyId,
                c => c.Id,
                (u, c) => new
                {
                    u.Id,
                    u.Name,
                    u.Role,
                    u.Designation,
                    u.Phone,
                    u.CompanyId,
                    CompanyName = c.Name,
                })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            // Try without join (no company)
            var u = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.Id, u.Name, u.Role, u.Designation, u.Phone, u.CompanyId })
                .FirstOrDefaultAsync(ct);
            if (u is null) return NotFound(new { error = "User not found" });
            return Ok(new
            {
                id = u.Id,
                name = u.Name,
                role = u.Role,
                designation = u.Designation,
                phone = u.Phone,
                companyName = (string?)null,
            });
        }

        return Ok(new
        {
            id = row.Id,
            name = row.Name,
            role = row.Role,
            designation = row.Designation,
            phone = row.Phone,
            companyName = row.CompanyName,
        });
    }
}
