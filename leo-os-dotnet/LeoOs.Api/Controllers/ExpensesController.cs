using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[RequireLeoAuth]
public sealed class ExpensesController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public ExpensesController(LeoOsDbContext db) => _db = db;

    public sealed record ExpenseBody(
        int? CategoryId,
        string? Amount,
        string? ExpenseDate,
        string? Remarks
    );

    private static bool IsFkViolation(Exception ex) =>
        ex is Npgsql.PostgresException pg && pg.SqlState == "23503";

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? categoryId, [FromQuery] string? search, CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";
        if (role is not ("superuser" or "admin"))
            return StatusCode(403, new { error = "Access denied" });

        var rows = await _db.Expenses.AsNoTracking()
            .Where(e => categoryId == null || e.CategoryId == categoryId.Value)
            .Join(_db.ExpenseCategories.AsNoTracking(), e => e.CategoryId, c => c.Id,
                (e, c) => new
                {
                    e.Id, e.CategoryId,
                    categoryName = c.Name,
                    categoryColor = c.Color,
                    e.Amount, e.ExpenseDate, e.Remarks, e.CreatedAt,
                })
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            return Ok(rows.Where(r =>
                r.categoryName.ToLower().Contains(q) ||
                (r.Remarks?.ToLower().Contains(q) ?? false)));
        }

        return Ok(rows);
    }

    [HttpPost]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] ExpenseBody body, CancellationToken ct)
    {
        if (!body.CategoryId.HasValue || body.CategoryId.Value <= 0)
            return BadRequest(new { error = "Pick a valid category" });
        if (string.IsNullOrWhiteSpace(body.Amount))
            return BadRequest(new { error = "Enter a valid amount" });

        var amount = Money.NormalizeMoney(body.Amount);
        if (amount is null) return BadRequest(new { error = "Invalid amount" });

        var date = Money.NormalizeDate(body.ExpenseDate);
        if (date == "invalid") return BadRequest(new { error = "Invalid date" });

        DateOnly? expenseDate = date is null ? null : DateOnly.Parse(date);

        try
        {
            var expense = new Expense
            {
                CategoryId = body.CategoryId.Value,
                Amount = decimal.Parse(amount),
                ExpenseDate = expenseDate,
                Remarks = body.Remarks?.Trim().Length == 0 ? null : body.Remarks?.Trim(),
            };
            _db.Expenses.Add(expense);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, expense);
        }
        catch (Exception ex) when (IsFkViolation(ex))
        {
            return BadRequest(new { error = "Pick a valid category" });
        }
    }

    [HttpPatch("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] ExpenseBody body, CancellationToken ct)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (expense is null) return NotFound(new { error = "Not found" });

        if (body.CategoryId.HasValue) expense.CategoryId = body.CategoryId.Value;
        if (body.Amount is not null)
        {
            var amount = Money.NormalizeMoney(body.Amount);
            if (amount is null) return BadRequest(new { error = "Invalid amount" });
            expense.Amount = decimal.Parse(amount);
        }
        if (body.ExpenseDate is not null)
        {
            var date = Money.NormalizeDate(body.ExpenseDate);
            if (date == "invalid") return BadRequest(new { error = "Invalid date" });
            expense.ExpenseDate = date is null ? null : DateOnly.Parse(date);
        }
        if (body.Remarks is not null) expense.Remarks = body.Remarks.Trim().Length == 0 ? null : body.Remarks.Trim();

        try
        {
            await _db.SaveChangesAsync(ct);
            return Ok(expense);
        }
        catch (Exception ex) when (IsFkViolation(ex))
        {
            return BadRequest(new { error = "Pick a valid category" });
        }
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (expense is null) return NotFound(new { error = "Not found" });
        _db.Expenses.Remove(expense);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
