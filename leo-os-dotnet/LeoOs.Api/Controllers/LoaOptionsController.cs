using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/loa-options")]
[RequireLeoAuth]
public sealed class LoaOptionsController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public LoaOptionsController(LeoOsDbContext db) => _db = db;

    private static bool IsUniqueViolation(Exception ex) =>
        ex is Npgsql.PostgresException pg && pg.SqlState == "23505";

    public sealed record CreateBody(int CompanyId, string Category, string Value);
    public sealed record UpdateBody(string Value, int? CompanyId);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int companyId, [FromQuery] string? category, CancellationToken ct)
    {
        if (companyId <= 0)
            return BadRequest(new { error = "companyId is required and must be a positive integer" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        if (role == "company")
        {
            if (session.Data.LinkedEntityId is not string leid || !int.TryParse(leid, out var eid) || companyId != eid)
                return StatusCode(403, new { error = "Access denied — you may only view options for your own company" });
        }
        else if (role is not ("superuser" or "admin" or "employee" or "agent"))
        {
            return StatusCode(403, new { error = "Access denied" });
        }

        IQueryable<LoaOption> query = _db.LoaOptions.AsNoTracking()
            .Where(o => o.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(o => o.Category == category);

        var rows = await query
            .OrderBy(o => o.Category)
            .ThenBy(o => o.Value)
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpPost]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Create([FromBody] CreateBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Value))
            return BadRequest(new { error = "Value cannot be empty" });

        var value = body.Value.Trim().ToLowerInvariant();
        if (value.Length == 0) return BadRequest(new { error = "Value cannot be empty" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        if (role == "company")
        {
            if (session.Data.LinkedEntityId is not string leid || !int.TryParse(leid, out var eid) || body.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — you may only create options for your own company" });
        }

        try
        {
            var opt = new LoaOption
            {
                CompanyId = body.CompanyId,
                Category = body.Category,
                Value = value,
            };
            _db.LoaOptions.Add(opt);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, opt);
        }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            return StatusCode(409, new { error = "Option already exists in this category" });
        }
    }

    [HttpPatch("{id:int}")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Value))
            return BadRequest(new { error = "Value cannot be empty" });

        var value = body.Value.Trim().ToLowerInvariant();
        if (value.Length == 0) return BadRequest(new { error = "Value cannot be empty" });

        var opt = await _db.LoaOptions.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (opt is null) return NotFound(new { error = "Option not found" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        if (role == "company")
        {
            if (session.Data.LinkedEntityId is not string leid || !int.TryParse(leid, out var eid) || opt.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — option does not belong to your company" });
        }

        if (body.CompanyId.HasValue && body.CompanyId.Value != opt.CompanyId)
            return StatusCode(403, new { error = "Option does not belong to the specified company" });

        try
        {
            opt.Value = value;
            await _db.SaveChangesAsync(ct);
            return Ok(opt);
        }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            return StatusCode(409, new { error = "Another option with this value already exists" });
        }
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin", "company")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var opt = await _db.LoaOptions.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (opt is null) return NotFound(new { error = "Option not found" });

        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        if (role == "company")
        {
            if (session.Data.LinkedEntityId is not string leid || !int.TryParse(leid, out var eid) || opt.CompanyId != eid)
                return StatusCode(403, new { error = "Access denied — option does not belong to your company" });
        }

        _db.LoaOptions.Remove(opt);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
