using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LeoOs.Infrastructure;

namespace LeoOs.Api.Controllers;

[ApiController]
public sealed class HealthController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public HealthController(LeoOsDbContext db) => _db = db;

    [HttpGet("api/health")]
    [HttpGet("api/healthz")]
    public IActionResult Health() => Ok(new { status = "ok" });

    /// <summary>Dev/ops check that EF can reach Postgres (not exposed via nginx in production initially).</summary>
    [HttpGet("api/health/db")]
    public async Task<IActionResult> HealthDb(CancellationToken ct)
    {
        try
        {
            var ok = await _db.Database.CanConnectAsync(ct);
            return ok
                ? Ok(new { status = "ok", database = true })
                : StatusCode(503, new { error = "Database unreachable" });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = "Database unreachable", detail = ex.Message });
        }
    }
}
