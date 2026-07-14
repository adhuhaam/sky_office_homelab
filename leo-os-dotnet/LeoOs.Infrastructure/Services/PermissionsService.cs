using System.Collections.Concurrent;
using LeoOs.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LeoOs.Infrastructure.Services;

public sealed class PermissionsService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private ConcurrentDictionary<string, PermEntry>? _cache;
    private long _cacheTimestamp;
    private const long CacheTtlMs = 60_000;

    public PermissionsService(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public void Invalidate()
    {
        _cache = null;
        _cacheTimestamp = 0;
    }

    public async Task<IReadOnlyDictionary<string, PermEntry>> GetCacheAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (_cache is not null && now - _cacheTimestamp < CacheTtlMs)
            return _cache;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LeoOsDbContext>();
        var rows = await db.RolePermissions.AsNoTracking().ToListAsync(ct);
        var map = new ConcurrentDictionary<string, PermEntry>();
        foreach (var row in rows)
        {
            map[$"{row.Role}:{row.Module}"] = new PermEntry(row.CanView, row.CanEdit, row.CanDelete);
        }
        _cache = map;
        _cacheTimestamp = now;
        return map;
    }

    public static (string Module, string Action)? ResolveModuleAction(string method, string path)
    {
        var m = method.ToUpperInvariant();
        var p = path.Split('?')[0];
        // Strip /api prefix if present
        if (p.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
            p = p[4..];
        if (!p.StartsWith('/')) p = "/" + p;

        if (RegexMatch(p, @"^/passports/upload$") && m == "POST") return ("upload", "edit");
        if (RegexMatch(p, @"^/passports(/\d+|/stats)?$") && m == "GET") return ("masterlist", "view");
        if (RegexMatch(p, @"^/passports/\d+$") && m == "PATCH") return ("masterlist", "edit");
        if (RegexMatch(p, @"^/passports/\d+$") && m == "DELETE") return ("masterlist", "delete");

        if (RegexMatch(p, @"^/companies(/\d+)?$") && m == "GET") return ("companies", "view");
        if (RegexMatch(p, @"^/companies$") && m == "POST") return ("companies", "edit");
        if (RegexMatch(p, @"^/companies/\d+(/branding)?$") && m is "PATCH" or "PUT" or "POST") return ("companies", "edit");
        if (RegexMatch(p, @"^/companies/\d+$") && m == "DELETE") return ("companies", "delete");

        if (RegexMatch(p, @"^/clients(/\d+)?$") && m == "GET") return ("clients", "view");
        if (RegexMatch(p, @"^/clients$") && m == "POST") return ("clients", "edit");
        if (RegexMatch(p, @"^/clients/\d+$") && m is "PATCH" or "PUT") return ("clients", "edit");
        if (RegexMatch(p, @"^/clients/\d+$") && m == "DELETE") return ("clients", "delete");

        if (RegexMatch(p, @"^/loa(/\d+)?$") && m == "GET") return ("loa", "view");
        if (RegexMatch(p, @"^/loa/\d+/pdf$") && m == "GET") return ("loa", "view");
        if (RegexMatch(p, @"^/loa$") && m == "POST") return ("loa", "edit");
        if (RegexMatch(p, @"^/loa/\d+$") && m is "PATCH" or "PUT") return ("loa", "edit");
        if (RegexMatch(p, @"^/loa/\d+$") && m == "DELETE") return ("loa", "delete");

        if (RegexMatch(p, @"^/billing/documents(/\d+)?$") && m == "GET") return ("billing", "view");
        if (RegexMatch(p, @"^/billing/documents$") && m == "POST") return ("billing", "edit");
        if (RegexMatch(p, @"^/billing/documents/\d+$") && m is "PATCH" or "PUT") return ("billing", "edit");
        if (RegexMatch(p, @"^/billing/documents/\d+$") && m == "DELETE") return ("billing", "delete");

        if (RegexMatch(p, @"^/expenses(/\d+)?$") && m == "GET") return ("expenses", "view");
        if (RegexMatch(p, @"^/expenses$") && m == "POST") return ("expenses", "edit");
        if (RegexMatch(p, @"^/expenses/\d+$") && m is "PATCH" or "PUT") return ("expenses", "edit");
        if (RegexMatch(p, @"^/expenses/\d+$") && m == "DELETE") return ("expenses", "delete");

        if (RegexMatch(p, @"^/passwords(/\d+)?$") && m == "GET") return ("passwords", "view");
        if (RegexMatch(p, @"^/passwords$") && m == "POST") return ("passwords", "edit");
        if (RegexMatch(p, @"^/passwords/\d+$") && m is "PATCH" or "PUT") return ("passwords", "edit");

        return null;
    }

    private static bool RegexMatch(string input, string pattern) =>
        System.Text.RegularExpressions.Regex.IsMatch(input, pattern);
}

public readonly record struct PermEntry(bool CanView, bool CanEdit, bool CanDelete);
