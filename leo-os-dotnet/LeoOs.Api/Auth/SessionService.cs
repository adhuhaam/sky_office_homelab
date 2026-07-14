using System.Security.Cryptography;
using System.Text.Json;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Sessions;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Auth;

public sealed class SessionService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly LeoOsDbContext _db;
    private readonly TimeSpan _maxAge = TimeSpan.FromDays(7);

    public SessionService(LeoOsDbContext db) => _db = db;

    public async Task<ExpressSessionData?> GetAsync(string sid, CancellationToken ct = default)
    {
        var row = await _db.Sessions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Sid == sid, ct);
        if (row is null)
            return null;

        // sess.expire is timestamp without time zone; treat as UTC
        var expireUtc = DateTime.SpecifyKind(row.Expire, DateTimeKind.Utc);
        if (expireUtc < DateTime.UtcNow)
            return null;

        try
        {
            return JsonSerializer.Deserialize<ExpressSessionData>(row.Sess, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    public async Task DestroyAsync(string sid, CancellationToken ct = default)
    {
        var row = await _db.Sessions.FirstOrDefaultAsync(s => s.Sid == sid, ct);
        if (row is null)
            return;
        _db.Sessions.Remove(row);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<string> CreateAsync(User user, bool cookieSecure, CancellationToken ct = default)
    {
        var sid = GenerateSid();
        var expires = DateTimeOffset.UtcNow.Add(_maxAge);
        var data = new ExpressSessionData
        {
            Cookie = new ExpressCookieData
            {
                OriginalMaxAge = (long)_maxAge.TotalMilliseconds,
                Expires = expires,
                Secure = cookieSecure ? true : false,
                HttpOnly = true,
                Path = "/",
                SameSite = "lax",
            },
            Authenticated = true,
            UserId = user.Id,
            Role = user.Role,
            UserEmail = user.Email,
            UserName = user.Name,
            LinkedEntityId = user.LinkedEntityId,
        };

        var json = JsonSerializer.Serialize(data, JsonOptions);
        // Npgsql rejects Kind=Utc for "timestamp without time zone" (connect-pg-simple column).
        var expireValue = DateTime.SpecifyKind(expires.UtcDateTime, DateTimeKind.Unspecified);
        _db.Sessions.Add(new SessionRow
        {
            Sid = sid,
            Sess = json,
            Expire = expireValue,
        });
        await _db.SaveChangesAsync(ct);
        return sid;
    }

    private static string GenerateSid()
    {
        // uid-safe style: 24 random bytes → base64url
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
