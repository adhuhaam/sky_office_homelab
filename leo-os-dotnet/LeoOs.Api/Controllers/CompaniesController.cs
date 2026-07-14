using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/companies")]
[RequireLeoAuth]
public sealed class CompaniesController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public CompaniesController(LeoOsDbContext db) => _db = db;

    private static readonly Regex DataUrlRe =
        new(@"^data:image/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$", RegexOptions.Compiled);

    private static string? ValidateImageDataUrl(string? value, string label)
    {
        if (value is null) return null;
        var m = DataUrlRe.Match(value);
        if (!m.Success) return $"{label} must be a data:image/(png|jpeg);base64 URL";
        var b64 = m.Groups[2].Value;
        var pad = b64.EndsWith("==") ? 2 : b64.EndsWith('=') ? 1 : 0;
        var bytes = (int)Math.Floor(b64.Length * 3.0 / 4) - pad;
        if (bytes > 2 * 1024 * 1024) return $"{label} exceeds 2048 KB limit";
        return null;
    }

    private bool CanEdit(string role, int? linkedId, int companyId)
    {
        if (role is "superuser" or "admin") return true;
        if (role == "company" && linkedId.HasValue) return linkedId.Value == companyId;
        return false;
    }

    private static bool IsFkViolation(Exception ex) =>
        ex is Npgsql.PostgresException pg && pg.SqlState == "23503";

    public sealed record CompanyBody(
        string? Name,
        string? Address,
        string? Email,
        string? Phone,
        string? Country,
        string? RegistrationNumber,
        string? SignatoryName,
        string? SignatoryDesignation,
        string? LetterheadImage,
        string? SignatureImage,
        string? InvoiceLogoImage,
        string? BankName,
        string? BankAccountNumber,
        string? BankAccountHolder,
        string? BankSwiftCode
    );

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool withBranding = false, CancellationToken ct = default)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId is string s && int.TryParse(s, out var n) ? (int?)n : null;

        if (role is "employee" or "agent" or "client")
            return StatusCode(403, new { error = "Access denied" });

        IQueryable<Company> query = _db.Companies.AsNoTracking();

        if (role == "company")
        {
            if (!linkedId.HasValue) return StatusCode(403, new { error = "Access denied" });
            query = query.Where(c => c.Id == linkedId.Value);
        }

        var rows = await query.OrderBy(c => c.Name).ToListAsync(ct);

        if (!withBranding)
        {
            return Ok(rows.Select(c => new
            {
                c.Id, c.Name, c.Address, c.Email, c.Phone, c.Country,
                c.RegistrationNumber, c.SignatoryName, c.SignatoryDesignation,
                letterheadImage = (string?)null, signatureImage = (string?)null, invoiceLogoImage = (string?)null,
                c.BankName, c.BankAccountNumber, c.BankAccountHolder, c.BankSwiftCode,
                c.CreatedAt, c.UpdatedAt,
            }));
        }
        return Ok(rows);
    }

    [HttpPost]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] CompanyBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "name is required" });

        var lhErr = ValidateImageDataUrl(body.LetterheadImage, "letterheadImage");
        var sigErr = ValidateImageDataUrl(body.SignatureImage, "signatureImage");
        var logoErr = ValidateImageDataUrl(body.InvoiceLogoImage, "invoiceLogoImage");
        var imgErr = lhErr ?? sigErr ?? logoErr;
        if (imgErr is not null) return BadRequest(new { error = imgErr });

        var company = new Company
        {
            Name = body.Name.Trim(),
            Address = body.Address,
            Email = body.Email,
            Phone = body.Phone,
            Country = body.Country,
            RegistrationNumber = body.RegistrationNumber,
            SignatoryName = body.SignatoryName,
            SignatoryDesignation = body.SignatoryDesignation,
            LetterheadImage = body.LetterheadImage,
            SignatureImage = body.SignatureImage,
            InvoiceLogoImage = body.InvoiceLogoImage,
            BankName = body.BankName,
            BankAccountNumber = body.BankAccountNumber,
            BankAccountHolder = body.BankAccountHolder,
            BankSwiftCode = body.BankSwiftCode,
        };
        _db.Companies.Add(company);
        await _db.SaveChangesAsync(ct);

        // Ensure password record
        _db.Passwords.Add(new PasswordRecord { CompanyId = company.Id });
        try { await _db.SaveChangesAsync(ct); } catch { /* ignore duplicate */ }

        return StatusCode(201, company);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CompanyBody body, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId is string s && int.TryParse(s, out var n) ? (int?)n : null;

        if (!CanEdit(role, linkedId, id))
            return StatusCode(403, new { error = "Access denied" });

        var lhErr = ValidateImageDataUrl(body.LetterheadImage, "letterheadImage");
        var sigErr = ValidateImageDataUrl(body.SignatureImage, "signatureImage");
        var logoErr = ValidateImageDataUrl(body.InvoiceLogoImage, "invoiceLogoImage");
        var imgErr = lhErr ?? sigErr ?? logoErr;
        if (imgErr is not null) return BadRequest(new { error = imgErr });

        var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (company is null) return NotFound(new { error = "Not found" });

        if (body.Name is not null) company.Name = body.Name.Trim();
        if (body.Address is not null) company.Address = body.Address;
        if (body.Email is not null) company.Email = body.Email;
        if (body.Phone is not null) company.Phone = body.Phone;
        if (body.Country is not null) company.Country = body.Country;
        if (body.RegistrationNumber is not null) company.RegistrationNumber = body.RegistrationNumber;
        if (body.SignatoryName is not null) company.SignatoryName = body.SignatoryName;
        if (body.SignatoryDesignation is not null) company.SignatoryDesignation = body.SignatoryDesignation;
        if (body.LetterheadImage is not null) company.LetterheadImage = body.LetterheadImage;
        if (body.SignatureImage is not null) company.SignatureImage = body.SignatureImage;
        if (body.InvoiceLogoImage is not null) company.InvoiceLogoImage = body.InvoiceLogoImage;
        if (body.BankName is not null) company.BankName = body.BankName;
        if (body.BankAccountNumber is not null) company.BankAccountNumber = body.BankAccountNumber;
        if (body.BankAccountHolder is not null) company.BankAccountHolder = body.BankAccountHolder;
        if (body.BankSwiftCode is not null) company.BankSwiftCode = body.BankSwiftCode;

        await _db.SaveChangesAsync(ct);
        return Ok(company);
    }

    [HttpPost("{id:int}/branding")]
    public async Task<IActionResult> UploadBranding(int id, IFormCollection form, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        var linkedId = session.Data.LinkedEntityId is string s && int.TryParse(s, out var n) ? (int?)n : null;

        if (!CanEdit(role, linkedId, id))
            return StatusCode(403, new { error = "Access denied" });

        var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (company is null) return NotFound(new { error = "Company not found" });

        var updated = false;
        foreach (var (field, dbProp) in new[] { ("letterhead", "lh"), ("signature", "sig"), ("invoiceLogo", "logo") })
        {
            var file = form.Files.GetFile(field);
            if (file is null) continue;
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var mime = file.ContentType.StartsWith("image/") ? file.ContentType : "image/png";
            var dataUrl = $"data:{mime};base64,{Convert.ToBase64String(ms.ToArray())}";
            switch (dbProp)
            {
                case "lh": company.LetterheadImage = dataUrl; break;
                case "sig": company.SignatureImage = dataUrl; break;
                case "logo": company.InvoiceLogoImage = dataUrl; break;
            }
            updated = true;
        }

        if (!updated) return BadRequest(new { error = "No files uploaded" });
        await _db.SaveChangesAsync(ct);
        return Ok(company);
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var hasBilling = await _db.BillingDocuments.AnyAsync(b => b.CompanyId == id, ct);
        if (hasBilling)
            return StatusCode(409, new { error = "Company has billing documents and cannot be deleted" });

        try
        {
            var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
            if (company is null) return NotFound(new { error = "Not found" });
            _db.Companies.Remove(company);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
        catch (Exception ex) when (IsFkViolation(ex))
        {
            return StatusCode(409, new { error = "Company is in use — remove linked users, passports, or LOA records first" });
        }
    }
}
