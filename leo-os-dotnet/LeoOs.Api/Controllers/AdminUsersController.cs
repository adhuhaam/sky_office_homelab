using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[RequireLeoAuth]
[RequireRole("superuser", "admin")]
public sealed class AdminUsersController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public AdminUsersController(LeoOsDbContext db) => _db = db;

    private static object UserShape(User u) => new
    {
        id = u.Id,
        email = u.Email,
        name = u.Name,
        role = u.Role,
        isApproved = u.IsApproved,
        isBlocked = u.IsBlocked,
        linkedEntityId = u.LinkedEntityId,
        phone = u.Phone,
        designation = u.Designation,
        companyId = u.CompanyId,
        hasPassword = u.PasswordHash is not null,
        createdAt = u.CreatedAt.ToString("O"),
    };

    public sealed record CreateUserBody(
        string Email,
        string Name,
        string Role,
        bool? IsApproved,
        string Password,
        string? LinkedEntityId
    );

    public sealed record UpdateUserBody(
        string? Email,
        string? Name,
        string? Role,
        bool? IsApproved,
        bool? IsBlocked,
        string? LinkedEntityId,
        string? Phone,
        string? Designation,
        int? CompanyId,
        string? NewPassword
    );

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var users = await _db.Users.AsNoTracking()
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(ct);
        return Ok(users.Select(UserShape));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Name)
            || string.IsNullOrWhiteSpace(body.Password) || body.Password.Length < 6)
            return BadRequest(new { error = "Invalid input" });

        var session = HttpContext.GetLeoSession()!;
        var actorRole = session.Data.Role ?? "";

        if (body.Role == "superuser" && actorRole != "superuser")
            return StatusCode(403, new { error = "Only superusers may grant the superuser role" });

        var email = body.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { error = "Email already registered" });

        var user = new User
        {
            Email = email,
            Name = body.Name.Trim(),
            Role = body.Role ?? "agent",
            IsApproved = body.IsApproved ?? true,
            IsBlocked = false,
            PasswordHash = NodePasswordHasher.Hash(body.Password),
            LinkedEntityId = body.LinkedEntityId,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, UserShape(user));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserBody body, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var actorRole = session.Data.Role ?? "";
        var actorId = session.Data.UserId as int?;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { error = "User not found" });

        if (user.Role == "superuser" && actorRole != "superuser")
            return StatusCode(403, new { error = "Only superusers may modify another superuser's account" });

        if (body.Role is not null)
        {
            if (id == actorId)
                return StatusCode(403, new { error = "You cannot change your own role" });
            if (body.Role == "superuser" && actorRole != "superuser")
                return StatusCode(403, new { error = "Only superusers may grant the superuser role" });
        }

        if (body.Email is not null)
        {
            var email = body.Email.Trim().ToLowerInvariant();
            if (await _db.Users.AnyAsync(u => u.Email == email && u.Id != id, ct))
                return Conflict(new { error = "Email already registered" });
            user.Email = email;
        }
        if (body.Name is not null) user.Name = body.Name.Trim();
        if (body.Role is not null) user.Role = body.Role;
        if (body.IsApproved.HasValue) user.IsApproved = body.IsApproved.Value;
        if (body.IsBlocked.HasValue) user.IsBlocked = body.IsBlocked.Value;
        if (body.LinkedEntityId is not null) user.LinkedEntityId = body.LinkedEntityId == "" ? null : body.LinkedEntityId;
        if (body.Phone is not null) user.Phone = body.Phone.Trim().Length == 0 ? null : body.Phone.Trim();
        if (body.Designation is not null) user.Designation = body.Designation.Trim().Length == 0 ? null : body.Designation.Trim();
        if (body.CompanyId.HasValue) user.CompanyId = body.CompanyId.Value == 0 ? null : body.CompanyId.Value;
        if (body.NewPassword is not null)
        {
            if (body.NewPassword.Length == 0)
                user.PasswordHash = null;
            else if (body.NewPassword.Length >= 6)
                user.PasswordHash = NodePasswordHasher.Hash(body.NewPassword);
            else
                return BadRequest(new { error = "Password must be at least 6 characters" });
        }

        await _db.SaveChangesAsync(ct);
        return Ok(UserShape(user));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var actorRole = session.Data.Role ?? "";
        var actorId = session.Data.UserId as int?;

        if (id == actorId)
            return StatusCode(403, new { error = "You cannot delete your own account" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound(new { error = "User not found" });

        if (user.Role == "superuser" && actorRole != "superuser")
            return StatusCode(403, new { error = "Only superusers may delete another superuser's account" });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
