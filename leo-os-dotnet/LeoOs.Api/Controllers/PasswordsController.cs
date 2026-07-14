using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/passwords")]
[RequireLeoAuth]
public sealed class PasswordsController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public PasswordsController(LeoOsDbContext db) => _db = db;

    public sealed record BackfillBody(int CompanyId);
    public sealed record UpdateBody(
        string? EfaasUsername,
        string? EfaasPassword,
        string? GmailUsername,
        string? GmailPassword
    );

    private async Task<object?> LoadWithName(int id, CancellationToken ct)
    {
        return await _db.Passwords.AsNoTracking()
            .Where(p => p.Id == id)
            .Join(_db.Companies.AsNoTracking(), p => p.CompanyId, c => c.Id,
                (p, c) => new
                {
                    p.Id, p.CompanyId,
                    companyName = c.Name,
                    p.EfaasUsername, p.EfaasPassword,
                    p.GmailUsername, p.GmailPassword,
                    p.CreatedAt, p.UpdatedAt,
                })
            .FirstOrDefaultAsync(ct);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken ct)
    {
        var rows = await _db.Passwords.AsNoTracking()
            .Join(_db.Companies.AsNoTracking(), p => p.CompanyId, c => c.Id,
                (p, c) => new
                {
                    p.Id, p.CompanyId,
                    companyName = c.Name,
                    p.EfaasUsername, p.EfaasPassword,
                    p.GmailUsername, p.GmailPassword,
                    p.CreatedAt, p.UpdatedAt,
                })
            .OrderBy(r => r.companyName)
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            rows = rows.Where(p =>
                p.companyName.ToLower().Contains(q) ||
                p.EfaasUsername.ToLower().Contains(q) ||
                p.GmailUsername.ToLower().Contains(q)
            ).ToList();
        }

        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Backfill([FromBody] BackfillBody body, CancellationToken ct)
    {
        var company = await _db.Companies.AsNoTracking()
            .Where(c => c.Id == body.CompanyId)
            .Select(c => new { c.Id })
            .FirstOrDefaultAsync(ct);
        if (company is null) return NotFound(new { error = "Company not found" });

        var existing = await _db.Passwords
            .Where(p => p.CompanyId == body.CompanyId)
            .Select(p => new { p.Id })
            .FirstOrDefaultAsync(ct);
        if (existing is not null)
            return StatusCode(409, new { error = "Password record already exists for this company" });

        var rec = new PasswordRecord { CompanyId = body.CompanyId };
        _db.Passwords.Add(rec);
        await _db.SaveChangesAsync(ct);

        var result = await LoadWithName(rec.Id, ct);
        return StatusCode(201, result);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateBody body, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var rec = await _db.Passwords.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (rec is null) return NotFound(new { error = "Password entry not found" });

        var changed = false;
        if (body.EfaasUsername is not null) { rec.EfaasUsername = body.EfaasUsername.Trim(); changed = true; }
        if (body.EfaasPassword is not null) { rec.EfaasPassword = body.EfaasPassword; changed = true; }
        if (body.GmailUsername is not null) { rec.GmailUsername = body.GmailUsername.Trim(); changed = true; }
        if (body.GmailPassword is not null) { rec.GmailPassword = body.GmailPassword; changed = true; }

        if (!changed) return BadRequest(new { error = "No fields to update" });

        await _db.SaveChangesAsync(ct);

        return Ok(await LoadWithName(id, ct));
    }
}
