using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly LeoOsDbContext _db;
    private readonly SessionService _sessions;
    private readonly IConfiguration _config;

    public AuthController(LeoOsDbContext db, SessionService sessions, IConfiguration config)
    {
        _db = db;
        _sessions = sessions;
        _config = config;
    }

    public sealed record LoginBody(string Email, string Password);
    public sealed record RegisterBody(string Email, string Password, string Name);
    public sealed record UpdateProfileBody(string? Name, string? Phone, string? Designation, int? CompanyId);
    public sealed record ChangePasswordBody(string? CurrentPassword, string NewPassword);

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var feature = HttpContext.GetLeoSession();
        if (feature is null || !feature.Data.Authenticated)
        {
            return Ok(new
            {
                authenticated = false,
                userId = (int?)null,
                email = (string?)null,
                name = (string?)null,
                role = (string?)null,
                phone = (string?)null,
                designation = (string?)null,
                companyId = (int?)null,
                linkedEntityId = (string?)null,
            });
        }

        var userId = feature.Data.UserId;
        string? phone = null, designation = null;
        int? companyId = null;
        if (userId is int id)
        {
            var profile = await _db.Users.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new { u.Phone, u.Designation, u.CompanyId })
                .FirstOrDefaultAsync(ct);
            phone = profile?.Phone;
            designation = profile?.Designation;
            companyId = profile?.CompanyId;
        }

        return Ok(new
        {
            authenticated = true,
            userId,
            email = feature.Data.UserEmail,
            name = feature.Data.UserName,
            role = feature.Data.Role,
            linkedEntityId = feature.Data.LinkedEntityId,
            phone,
            designation,
            companyId,
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
            return Unauthorized(new { error = "Invalid credentials" });

        var email = body.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user?.PasswordHash is null || !NodePasswordHasher.Verify(body.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials" });

        if (user.IsBlocked)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Account has been blocked" });
        if (!user.IsApproved)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Account pending approval" });

        var cookieSecureEnv = string.Equals(
            _config["COOKIE_SECURE"] ?? Environment.GetEnvironmentVariable("COOKIE_SECURE"),
            "true",
            StringComparison.OrdinalIgnoreCase);
        // Mirror Express secure: "auto" — Secure flag only when the request is HTTPS
        // (Tailscale HTTP must not get Secure cookies or the browser drops them).
        var forwardedProto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        var isHttps = Request.IsHttps
            || string.Equals(forwardedProto, "https", StringComparison.OrdinalIgnoreCase);
        var cookieSecure = cookieSecureEnv && isHttps;

        var sid = await _sessions.CreateAsync(user, cookieSecure, ct);
        var secret = _config["SESSION_SECRET"]
            ?? Environment.GetEnvironmentVariable("SESSION_SECRET")
            ?? throw new InvalidOperationException("SESSION_SECRET is required");

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromDays(7),
            Secure = cookieSecure,
        };
        Response.Cookies.Append(ExpressSessionCookie.CookieName, ExpressSessionCookie.Sign(sid, secret), cookieOptions);

        return Ok(new { token = sid });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password)
            || body.Password.Length < 6 || string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "Invalid input" });

        var email = body.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { error = "Email already registered" });

        _db.Users.Add(new User
        {
            Email = email,
            Name = body.Name.Trim(),
            Role = "agent",
            IsApproved = false,
            IsBlocked = false,
            PasswordHash = NodePasswordHasher.Hash(body.Password),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        return Accepted(new { message = "Account created, pending admin approval" });
    }

    [HttpGet("mobile-token")]
    [RequireLeoAuth]
    public IActionResult MobileToken()
    {
        var feature = HttpContext.GetLeoSession()!;
        return Ok(new { token = feature.Sid });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var secret = _config["SESSION_SECRET"]
            ?? Environment.GetEnvironmentVariable("SESSION_SECRET")
            ?? "";

        var auth = Request.Headers.Authorization.ToString();
        if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var bearer = auth["Bearer ".Length..].Trim();
            if (!string.IsNullOrEmpty(bearer))
                await _sessions.DestroyAsync(bearer, ct);
        }

        var feature = HttpContext.GetLeoSession();
        if (feature is not null)
            await _sessions.DestroyAsync(feature.Sid, ct);
        else if (Request.Cookies.TryGetValue(ExpressSessionCookie.CookieName, out var raw))
        {
            var sid = ExpressSessionCookie.Unsign(raw, secret);
            if (sid is not null)
                await _sessions.DestroyAsync(sid, ct);
        }

        Response.Cookies.Delete(ExpressSessionCookie.CookieName);
        return NoContent();
    }

    [HttpPatch("me")]
    [RequireLeoAuth]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileBody body, CancellationToken ct)
    {
        var feature = HttpContext.GetLeoSession()!;
        if (feature.Data.UserId is not int userId)
            return Unauthorized(new { error = "Authentication required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Unauthorized(new { error = "Authentication required" });

        var changed = false;
        if (body.Name is not null)
        {
            if (body.Name.Length < 1)
                return BadRequest(new { error = "Invalid input" });
            user.Name = body.Name;
            changed = true;
        }
        if (body.Phone is not null)
        {
            user.Phone = body.Phone;
            changed = true;
        }
        if (body.Designation is not null)
        {
            user.Designation = body.Designation;
            changed = true;
        }
        if (body.CompanyId.HasValue)
        {
            user.CompanyId = body.CompanyId;
            changed = true;
        }

        if (!changed)
            return BadRequest(new { error = "No fields provided" });

        await _db.SaveChangesAsync(ct);
        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            name = user.Name,
            phone = user.Phone,
            designation = user.Designation,
            companyId = user.CompanyId,
        });
    }

    [HttpPost("change-password")]
    [RequireLeoAuth]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordBody body, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(body.NewPassword) || body.NewPassword.Length < 6)
            return BadRequest(new { error = "Invalid input" });

        var feature = HttpContext.GetLeoSession()!;
        if (feature.Data.UserId is not int userId)
            return Unauthorized(new { error = "Authentication required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user?.PasswordHash is null)
            return BadRequest(new { error = "No password set. Contact an admin to reset your password." });

        if (!string.IsNullOrEmpty(body.CurrentPassword))
        {
            if (!NodePasswordHasher.Verify(body.CurrentPassword, user.PasswordHash))
                return Unauthorized(new { error = "Current password is incorrect" });
        }

        user.PasswordHash = NodePasswordHasher.Hash(body.NewPassword);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
