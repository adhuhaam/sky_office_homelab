using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/admin/permissions")]
[RequireLeoAuth]
[RequireRole("superuser", "admin")]
public sealed class AdminPermissionsController : ControllerBase
{
    private readonly LeoOsDbContext _db;
    private readonly PermissionsService _permissions;

    public AdminPermissionsController(LeoOsDbContext db, PermissionsService permissions)
    {
        _db = db;
        _permissions = permissions;
    }

    private static readonly (string Role, string Module, bool View, bool Edit, bool Delete)[] DefaultPermissions =
    [
        // admin — all modules
        .. new[] { "masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload" }
            .Select(m => ("admin", m, true, true, true)),
        // company
        ("company", "masterlist", true, true, false),
        ("company", "companies", true, false, false),
        ("company", "clients", false, false, false),
        ("company", "loa", true, true, false),
        ("company", "billing", true, false, false),
        ("company", "expenses", false, false, false),
        ("company", "passwords", false, false, false),
        ("company", "upload", true, true, false),
        // client
        ("client", "masterlist", true, false, false),
        ("client", "companies", false, false, false),
        ("client", "clients", false, false, false),
        ("client", "loa", false, false, false),
        ("client", "billing", true, false, false),
        ("client", "expenses", false, false, false),
        ("client", "passwords", false, false, false),
        ("client", "upload", false, false, false),
        // employee
        .. new[] { "masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload" }
            .Select(m => ("employee", m, m == "masterlist", false, false)),
        // agent
        .. new[] { "masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload" }
            .Select(m => ("agent", m, m == "masterlist", false, false)),
    ];

    private static object FormatRow(RolePermission r) => new
    {
        role = r.Role,
        module = r.Module,
        canView = r.CanView,
        canEdit = r.CanEdit,
        canDelete = r.CanDelete,
    };

    public sealed record PermissionRow(
        string Role, string Module,
        bool CanView, bool CanEdit, bool CanDelete
    );

    private async Task EnsureDefaultsAsync(CancellationToken ct)
    {
        foreach (var (role, module, view, edit, delete) in DefaultPermissions)
        {
            var exists = await _db.RolePermissions.AnyAsync(p => p.Role == role && p.Module == module, ct);
            if (!exists)
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    Role = role, Module = module,
                    CanView = view, CanEdit = edit, CanDelete = delete,
                });
            }
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task UpsertPermissionsAsync(IEnumerable<PermissionRow> perms, CancellationToken ct)
    {
        foreach (var p in perms)
        {
            var existing = await _db.RolePermissions
                .FirstOrDefaultAsync(r => r.Role == p.Role && r.Module == p.Module, ct);
            if (existing is null)
            {
                _db.RolePermissions.Add(new RolePermission
                {
                    Role = p.Role, Module = p.Module,
                    CanView = p.CanView, CanEdit = p.CanEdit, CanDelete = p.CanDelete,
                });
            }
            else
            {
                existing.CanView = p.CanView;
                existing.CanEdit = p.CanEdit;
                existing.CanDelete = p.CanDelete;
            }
        }
        await _db.SaveChangesAsync(ct);
        _permissions.Invalidate();
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var rows = await _db.RolePermissions.AsNoTracking().ToListAsync(ct);
        if (rows.Count == 0)
        {
            await EnsureDefaultsAsync(ct);
            rows = await _db.RolePermissions.AsNoTracking().ToListAsync(ct);
        }
        return Ok(rows
            .OrderBy(r => r.Role).ThenBy(r => r.Module)
            .Select(FormatRow));
    }

    [HttpPut]
    public async Task<IActionResult> Replace([FromBody] List<PermissionRow> body, CancellationToken ct)
    {
        if (body is null || body.Count == 0)
            return BadRequest(new { error = "Permissions list is required" });

        await UpsertPermissionsAsync(body, ct);

        var rows = await _db.RolePermissions.AsNoTracking()
            .OrderBy(r => r.Role).ThenBy(r => r.Module)
            .ToListAsync(ct);
        return Ok(rows.Select(FormatRow));
    }

    public sealed record PatchBody(List<PermissionRow> Permissions);

    [HttpPatch]
    public async Task<IActionResult> Patch([FromBody] PatchBody body, CancellationToken ct)
    {
        if (body?.Permissions is null || body.Permissions.Count == 0)
            return BadRequest(new { error = "permissions list is required" });

        await UpsertPermissionsAsync(body.Permissions, ct);

        var rows = await _db.RolePermissions.AsNoTracking()
            .OrderBy(r => r.Role).ThenBy(r => r.Module)
            .ToListAsync(ct);
        return Ok(rows.Select(FormatRow));
    }
}
