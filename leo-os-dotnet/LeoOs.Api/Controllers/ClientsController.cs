using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/clients")]
[RequireLeoAuth]
public sealed class ClientsController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public ClientsController(LeoOsDbContext db) => _db = db;

    private static bool IsFkViolation(Exception ex) =>
        ex is Npgsql.PostgresException pg && pg.SqlState == "23503";

    public sealed record ClientBody(
        string? Name,
        string? ContactPerson,
        string? Phone,
        string? Email,
        string? Address,
        string? Tin,
        string? Notes
    );

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        IQueryable<Client> query = _db.Clients.AsNoTracking();

        if (role is "superuser" or "admin")
        {
            // unrestricted
        }
        else if (role == "client")
        {
            if (session.Data.LinkedEntityId is not string leid || !int.TryParse(leid, out var linkedId))
                return StatusCode(403, new { error = "Access denied" });
            query = query.Where(c => c.Id == linkedId);
        }
        else
        {
            return StatusCode(403, new { error = "Access denied" });
        }

        var rows = await query.OrderBy(c => c.Name).ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            rows = rows.Where(c =>
                c.Name.ToLower().Contains(q) ||
                (c.ContactPerson?.ToLower().Contains(q) ?? false) ||
                (c.Email?.ToLower().Contains(q) ?? false)).ToList();
        }

        return Ok(rows);
    }

    [HttpPost]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] ClientBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "name is required" });

        var client = new Client
        {
            Name = body.Name.Trim(),
            ContactPerson = body.ContactPerson,
            Phone = body.Phone,
            Email = body.Email,
            Address = body.Address,
            Tin = body.Tin,
            Notes = body.Notes,
        };
        _db.Clients.Add(client);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, client);
    }

    [HttpPatch("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] ClientBody body, CancellationToken ct)
    {
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (client is null) return NotFound(new { error = "Not found" });

        if (body.Name is not null) client.Name = body.Name.Trim();
        if (body.ContactPerson is not null) client.ContactPerson = body.ContactPerson;
        if (body.Phone is not null) client.Phone = body.Phone;
        if (body.Email is not null) client.Email = body.Email;
        if (body.Address is not null) client.Address = body.Address;
        if (body.Tin is not null) client.Tin = body.Tin;
        if (body.Notes is not null) client.Notes = body.Notes;

        await _db.SaveChangesAsync(ct);
        return Ok(client);
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        try
        {
            var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id, ct);
            if (client is null) return NotFound(new { error = "Not found" });
            _db.Clients.Remove(client);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
        catch (Exception ex) when (IsFkViolation(ex))
        {
            return StatusCode(409, new { error = "Client is in use — remove linked passports or billing records first" });
        }
    }
}
