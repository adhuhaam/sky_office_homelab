using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/expense-categories")]
[RequireLeoAuth]
public sealed class ExpenseCategoriesController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public ExpenseCategoriesController(LeoOsDbContext db) => _db = db;

    public sealed record CategoryBody(string? Name, string? Color);

    private static bool IsUniqueViolation(Exception ex) =>
        ex is Npgsql.PostgresException pg && pg.SqlState == "23505";

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await _db.ExpenseCategories.AsNoTracking()
            .OrderBy(c => c.Name).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] CategoryBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "Name cannot be empty" });

        var name = body.Name.Trim();
        var dup = await _db.ExpenseCategories.AsNoTracking()
            .Where(c => c.Name.ToLower() == name.ToLower())
            .AnyAsync(ct);
        if (dup) return StatusCode(409, new { error = "A category with this name already exists" });

        try
        {
            var cat = new ExpenseCategory { Name = name, Color = body.Color };
            _db.ExpenseCategories.Add(cat);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, cat);
        }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            return StatusCode(409, new { error = "A category with this name already exists" });
        }
    }

    [HttpPatch("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] CategoryBody body, CancellationToken ct)
    {
        var cat = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cat is null) return NotFound(new { error = "Not found" });

        if (body.Name is not null)
        {
            var trimmed = body.Name.Trim();
            if (trimmed.Length == 0) return BadRequest(new { error = "Name cannot be empty" });

            var dup = await _db.ExpenseCategories.AsNoTracking()
                .Where(c => c.Name.ToLower() == trimmed.ToLower() && c.Id != id)
                .AnyAsync(ct);
            if (dup) return StatusCode(409, new { error = "Another category with this name already exists" });
            cat.Name = trimmed;
        }
        if (body.Color is not null) cat.Color = body.Color;

        try
        {
            await _db.SaveChangesAsync(ct);
            return Ok(cat);
        }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            return StatusCode(409, new { error = "Another category with this name already exists" });
        }
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var inUse = await _db.Expenses.AnyAsync(e => e.CategoryId == id, ct);
        if (inUse)
            return StatusCode(409, new { error = "Category is in use — delete or reassign its expenses first" });

        var cat = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cat is null) return NotFound(new { error = "Not found" });

        try
        {
            _db.ExpenseCategories.Remove(cat);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
        catch (Exception ex) when (ex is Npgsql.PostgresException pg && pg.SqlState == "23503")
        {
            return StatusCode(409, new { error = "Category is in use — delete or reassign its expenses first" });
        }
    }
}
