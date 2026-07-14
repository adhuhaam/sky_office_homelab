using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class SystemController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public SystemController(LeoOsDbContext db) => _db = db;

    private static readonly Regex DataUrlRe =
        new(@"^data:image/(png|jpe?g|svg\+xml|webp);base64,([A-Za-z0-9+/=]+)$",
            RegexOptions.Compiled);

    private static string? ValidateImageDataUrl(string? value, string label)
    {
        if (value is null) return null;
        var m = DataUrlRe.Match(value);
        if (!m.Success) return $"{label} must be a data:image URL";
        var b64 = m.Groups[2].Value;
        var pad = b64.EndsWith("==") ? 2 : b64.EndsWith('=') ? 1 : 0;
        var bytes = (int)Math.Floor(b64.Length * 3.0 / 4) - pad;
        if (bytes > 1024 * 1024) return $"{label} exceeds 1 MB limit";
        return null;
    }

    private async Task<AppSettings> ReadSettingsAsync(CancellationToken ct)
    {
        var row = await _db.AppSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is not null) return row;
        row = new AppSettings { Id = 1 };
        _db.AppSettings.Add(row);
        await _db.SaveChangesAsync(ct);
        return row;
    }

    private static object BrandingMetadata(AppSettings r) => new
    {
        appName = r.AppName,
        accentHue = r.AccentHue,
        companyName = r.CompanyName,
        companyAddress = r.CompanyAddress,
        companyPhone = r.CompanyPhone,
        companyEmail = r.CompanyEmail,
        companyWebsite = r.CompanyWebsite,
        companyRegistrationNumber = r.CompanyRegistrationNumber,
        hasLogo = !string.IsNullOrEmpty(r.LogoImage),
        hasLogoDark = !string.IsNullOrEmpty(r.LogoImageDark),
    };

    private static object BrandingLogos(AppSettings r) => new
    {
        logoImage = r.LogoImage,
        logoImageDark = r.LogoImageDark,
    };

    private static object SettingsShape(AppSettings r) => new
    {
        appName = r.AppName,
        accentHue = r.AccentHue,
        companyName = r.CompanyName,
        companyAddress = r.CompanyAddress,
        companyPhone = r.CompanyPhone,
        companyEmail = r.CompanyEmail,
        companyWebsite = r.CompanyWebsite,
        companyRegistrationNumber = r.CompanyRegistrationNumber,
        hasLogo = !string.IsNullOrEmpty(r.LogoImage),
        hasLogoDark = !string.IsNullOrEmpty(r.LogoImageDark),
        logoImage = r.LogoImage,
        logoImageDark = r.LogoImageDark,
        hasCustomPassword = !string.IsNullOrEmpty(r.PasswordHash),
        hasOpenaiApiKey = !string.IsNullOrEmpty(r.DeepseekApiKey),
        openaiOcrBaseUrl = r.DeepseekOcrBaseUrl,
        openaiOcrModel = r.DeepseekOcrModel,
    };

    [HttpGet("system/branding")]
    public async Task<IActionResult> GetBranding(CancellationToken ct)
    {
        var row = await ReadSettingsAsync(ct);
        Response.Headers.CacheControl = "public, max-age=300";
        return Ok(BrandingMetadata(row));
    }

    [HttpGet("system/branding/logos")]
    public async Task<IActionResult> GetBrandingLogos(CancellationToken ct)
    {
        var row = await ReadSettingsAsync(ct);
        Response.Headers.CacheControl = "public, max-age=3600";
        return Ok(BrandingLogos(row));
    }

    [HttpGet("system/settings")]
    [RequireLeoAuth]
    [RequireRole("superuser")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var row = await ReadSettingsAsync(ct);
        return Ok(SettingsShape(row));
    }

    [HttpGet("system/about")]
    [RequireLeoAuth]
    [RequireRole("superuser")]
    public async Task<IActionResult> GetAbout(CancellationToken ct)
    {
        string dbStatus = "ok";
        double dbLatencyMs = 0;
        string? dbError = null;

        try
        {
            var t0 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            await _db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
            dbLatencyMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - t0;
        }
        catch (Exception ex)
        {
            dbStatus = "error";
            dbError = ex.Message;
        }

        string appName = "Sky Office";
        try
        {
            var row = await ReadSettingsAsync(ct);
            if (!string.IsNullOrEmpty(row.AppName)) appName = row.AppName;
        }
        catch { /* ignore */ }

        var proc = System.Diagnostics.Process.GetCurrentProcess();
        long processUptimeSeconds;
        try
        {
            processUptimeSeconds = (long)(DateTimeOffset.UtcNow - proc.StartTime).TotalSeconds;
        }
        catch
        {
            processUptimeSeconds = 0;
        }

        long totalMem = 0, freeMem = 0;
        try
        {
            foreach (var line in System.IO.File.ReadAllLines("/proc/meminfo"))
            {
                if (line.StartsWith("MemTotal:", StringComparison.Ordinal))
                    totalMem = ParseMemKb(line) * 1024;
                else if (line.StartsWith("MemAvailable:", StringComparison.Ordinal))
                    freeMem = ParseMemKb(line) * 1024;
            }
        }
        catch { /* ignore */ }

        double load1 = 0, load5 = 0, load15 = 0;
        try
        {
            var load = System.IO.File.ReadAllText("/proc/loadavg").Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (load.Length >= 3)
            {
                _ = double.TryParse(load[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out load1);
                _ = double.TryParse(load[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out load5);
                _ = double.TryParse(load[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out load15);
            }
        }
        catch { /* ignore */ }

        var cpuCount = Environment.ProcessorCount;
        string? cpuModel = null;
        try
        {
            foreach (var line in System.IO.File.ReadLines("/proc/cpuinfo"))
            {
                if (!line.StartsWith("model name", StringComparison.OrdinalIgnoreCase)) continue;
                var idx = line.IndexOf(':');
                if (idx >= 0) cpuModel = line[(idx + 1)..].Trim();
                break;
            }
        }
        catch { /* ignore */ }

        var overall = dbStatus == "ok" ? "healthy" : "degraded";
        var apiStatus = "live";
        var dbNodeStatus = dbStatus == "ok" ? "live" : "degraded";

        return Ok(new
        {
            generatedAt = DateTimeOffset.UtcNow.ToString("O"),
            pollHintSeconds = 5,
            health = new
            {
                api = "ok",
                database = dbStatus,
                databaseLatencyMs = dbLatencyMs,
                databaseError = dbError,
                overall,
            },
            application = new
            {
                name = appName,
                product = "Sky Office (LEO OS)",
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "production",
                apiRuntime = "aspnetcore",
                rewriteRuntime = "aspnetcore (primary)",
            },
            server = new
            {
                hostname = Environment.MachineName,
                platform = "linux",
                arch = RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant(),
                release = RuntimeInformation.OSDescription,
                type = "Linux",
                uptimeSeconds = (long)(Environment.TickCount64 / 1000),
                processUptimeSeconds,
                nodeVersion = $".NET {Environment.Version}",
                pid = proc.Id,
                cwd = Directory.GetCurrentDirectory(),
                cpuModel,
                cpuCount,
                loadAverage = new Dictionary<string, double>
                {
                    ["1m"] = Math.Round(load1, 2),
                    ["5m"] = Math.Round(load5, 2),
                    ["15m"] = Math.Round(load15, 2),
                },
                memory = new
                {
                    totalBytes = totalMem,
                    freeBytes = freeMem,
                    processRssBytes = proc.WorkingSet64,
                    processHeapUsedBytes = GC.GetTotalMemory(false),
                },
            },
            stack = new
            {
                languages = new[]
                {
                    new { name = "C#", role = "Primary API (ASP.NET Core 8)" },
                    new { name = "TypeScript", role = "React PWA + Expo mobile" },
                    new { name = "SQL (PostgreSQL)", role = "Persistence (leoos)" },
                },
                runtimes = new[]
                {
                    new { name = ".NET", version = Environment.Version.ToString() },
                    new { name = "React", version = "19" },
                    new { name = "PostgreSQL", version = "17" },
                    new { name = "Expo / React Native", version = "54" },
                },
                toolchain = new[]
                {
                    new { name = "Docker Compose", role = "Homelab deployment" },
                    new { name = "nginx", role = "TLS proxy + static SPA" },
                    new { name = "EF Core", role = "ORM" },
                    new { name = "Tailscale", role = "Private remote access" },
                },
            },
            access = new
            {
                lan = "https://192.168.18.150/",
                tailscale = "http://100.126.222.96/",
                mobileApi = "http://100.126.222.96",
            },
            structure = BuildSystemStructure(overall, apiStatus, dbNodeStatus, dbLatencyMs),
        });
    }

    private static object BuildSystemStructure(string overall, string apiStatus, string dbStatus, double dbLatencyMs)
    {
        object N(string id, string label, string? detail = null, string? status = null, object[]? children = null) => new
        {
            id,
            label,
            detail,
            status,
            children,
        };

        return N("sky-office", "Sky Office / LEO OS", "Self-hosted employment ops platform (Maldives)", overall, new object[]
        {
            N("runtime", "Runtime (Docker · homelab)", "Production request path", overall, new object[]
            {
                N("leo-proxy", "leo-proxy", "Public edge · LAN HTTPS · Tailscale HTTP", "live"),
                N("react-app", "react-app", "Static PWA + nginx /api → .NET", "live"),
                N("leo-api-dotnet", "leo-api-dotnet", "ASP.NET Core 8 · :8080 · primary API", apiStatus),
                N("postgres", "postgres", $"PostgreSQL 17 · database leoos · probe {dbLatencyMs:0} ms", dbStatus),
            }),
            N("clients", "Clients", "Surfaces talking to /api", "live", new object[]
            {
                N("web-pwa", "Web PWA", "leo-os/apps/web → react/app · office admin", "live"),
                N("mobile", "Expo Mobile", "leo-os/apps/mobile · Bearer session", "live"),
            }),
            N("api-modules", "API modules (leo-os-dotnet)", "Controllers + EF Core · same /api contract", apiStatus, new object[]
            {
                N("auth", "Auth & sessions", "login · me · logout · mobile-token · cookie leo.sid", "live"),
                N("system", "System", "branding · settings · about (this page)", "live"),
                N("crm", "CRM", "companies · clients · loa-options · passwords", "live"),
                N("admin", "Admin", "users · role permissions", "live"),
                N("passports", "Passports", "master list · CRUD · stats · OCR upload", "live"),
                N("loa", "Letters of Appointment", "CRUD · print/PDF", "live"),
                N("finance", "Finance", "salary records · billing · expenses · categories", "live"),
                N("tasks", "Tasks", "dashboard task board", "live"),
                N("xpat", "Xpat & permits", "work-permit proxy · photo · card · alerts", "live"),
                N("notifications", "Notifications / SMS", "queue · templates · gateway hub · SignalR", "live"),
            }),
            N("workflows", "Core workflows", "End-to-end office flows", "live", new object[]
            {
                N("wf-onboard", "Worker onboarding", "Passport OCR → company/client → auto LOA", "live"),
                N("wf-payroll", "Payroll & billing", "Salary roster → confirm → invoice lines", "live"),
                N("wf-permits", "Work permits", "Xpat lookup → expiry alerts on dashboard", "live"),
                N("wf-sms", "SMS notifications", "LOA created · permit expiring → android SIM gateway", "live"),
            }),
            N("source", "Source layout", "/home/adhuhaam/apps", null, new object[]
            {
                N("src-dotnet", "leo-os-dotnet/", "Primary API · Dockerfile · LeoOs.Api + Infrastructure", "live"),
                N("src-web", "leo-os/apps/web", "React 19 · Vite · PWA (deploy:web)", "live"),
                N("src-android", "leo-android/", "Native admin · Kotlin Compose (Expo replacement)", "building"),
                N("src-sms-gw", "leo-sms-gateway/", "Android SIM SMS gateway · SignalR FGS", "building"),
                N("src-mobile", "leo-os/apps/mobile", "Expo 54 · reference until native parity QA", "legacy"),
                N("src-api-legacy", "leo-os/apps/api", "Express (retired from path · rollback only)", "legacy"),
                N("src-db", "leo-os/packages/db", "Drizzle schema reference (source of table shapes)", "live"),
                N("src-docs", "docs/", "SYSTEM-MAP · API · SMS-GATEWAY · ARCHITECTURE", "live"),
                N("src-compose", "docker-compose.yml", "postgres · leo-api-dotnet · react · leo-proxy", "live"),
            }),
        });
    }

    private static long ParseMemKb(string line)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2 && long.TryParse(parts[1], out var kb) ? kb : 0;
    }

    public sealed record UpdateSettingsBody(
        string? AppName,
        int? AccentHue,
        string? CompanyName,
        string? CompanyAddress,
        string? CompanyPhone,
        string? CompanyEmail,
        string? CompanyWebsite,
        string? CompanyRegistrationNumber,
        string? LogoImage,
        string? LogoImageDark,
        string? OpenaiApiKey,
        string? OpenaiOcrBaseUrl,
        string? OpenaiOcrModel
    );

    [HttpPatch("system/settings")]
    [RequireLeoAuth]
    [RequireRole("superuser")]
    public async Task<IActionResult> PatchSettings([FromBody] UpdateSettingsBody body, CancellationToken ct)
    {
        if (body.AppName is not null && (body.AppName.Length < 1 || body.AppName.Length > 60))
            return BadRequest(new { error = "appName must be between 1 and 60 characters" });
        if (body.AccentHue is not null && (body.AccentHue < 0 || body.AccentHue > 360))
            return BadRequest(new { error = "accentHue must be between 0 and 360" });

        var logoErr = ValidateImageDataUrl(body.LogoImage, "logoImage");
        if (logoErr is not null) return BadRequest(new { error = logoErr });
        var logoDarkErr = ValidateImageDataUrl(body.LogoImageDark, "logoImageDark");
        if (logoDarkErr is not null) return BadRequest(new { error = logoDarkErr });

        if (body.OpenaiApiKey is not null && body.OpenaiApiKey.Length > 0)
        {
            if (!body.OpenaiApiKey.StartsWith("sk-"))
                return BadRequest(new { error = "OpenAI API keys must start with \"sk-\"" });
        }

        var row = await ReadSettingsAsync(ct);
        var changed = false;

        static string? TrimOrNull(string? v) => v is null ? null : v.Trim().Length == 0 ? null : v.Trim();

        if (body.AppName is not null) { row.AppName = body.AppName.Trim(); changed = true; }
        if (body.AccentHue is not null) { row.AccentHue = body.AccentHue.Value; changed = true; }
        if (body.CompanyName is not null) { row.CompanyName = TrimOrNull(body.CompanyName); changed = true; }
        if (body.CompanyAddress is not null) { row.CompanyAddress = TrimOrNull(body.CompanyAddress); changed = true; }
        if (body.CompanyPhone is not null) { row.CompanyPhone = TrimOrNull(body.CompanyPhone); changed = true; }
        if (body.CompanyEmail is not null) { row.CompanyEmail = TrimOrNull(body.CompanyEmail); changed = true; }
        if (body.CompanyWebsite is not null) { row.CompanyWebsite = TrimOrNull(body.CompanyWebsite); changed = true; }
        if (body.CompanyRegistrationNumber is not null) { row.CompanyRegistrationNumber = TrimOrNull(body.CompanyRegistrationNumber); changed = true; }
        if (body.LogoImage is not null) { row.LogoImage = body.LogoImage.Length == 0 ? null : body.LogoImage; changed = true; }
        if (body.LogoImageDark is not null) { row.LogoImageDark = body.LogoImageDark.Length == 0 ? null : body.LogoImageDark; changed = true; }
        if (body.OpenaiApiKey is not null)
        {
            row.DeepseekApiKey = body.OpenaiApiKey.Length == 0 ? null : body.OpenaiApiKey.Trim();
            changed = true;
        }
        if (body.OpenaiOcrBaseUrl is not null) { row.DeepseekOcrBaseUrl = TrimOrNull(body.OpenaiOcrBaseUrl); changed = true; }
        if (body.OpenaiOcrModel is not null) { row.DeepseekOcrModel = TrimOrNull(body.OpenaiOcrModel); changed = true; }

        if (changed)
            await _db.SaveChangesAsync(ct);

        return Ok(SettingsShape(row));
    }
}
