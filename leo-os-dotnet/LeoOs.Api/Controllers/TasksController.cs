using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[RequireLeoAuth]
public sealed class TasksController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public TasksController(LeoOsDbContext db) => _db = db;

    private static readonly HashSet<string> ValidStatus = ["todo", "in_progress", "done"];
    private static readonly HashSet<string> ValidPriority = ["low", "medium", "high"];

    public sealed record CreateTaskBody(
        string Title, string? Notes,
        string? Status, string? Priority,
        string? DueDate, int? ParentId
    );

    public sealed record UpdateTaskBody(
        string? Title, string? Notes,
        string? Status, string? Priority,
        string? DueDate, int? ParentId, int? Position
    );

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await _db.Tasks.AsNoTracking()
            .OrderBy(t => t.Position).ThenBy(t => t.Id)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskBody body, CancellationToken ct)
    {
        var title = body.Title?.Trim() ?? "";
        if (string.IsNullOrEmpty(title)) return BadRequest(new { error = "Title is required" });

        var status = body.Status ?? "todo";
        var priority = body.Priority ?? "medium";

        if (!ValidStatus.Contains(status) || !ValidPriority.Contains(priority))
            return BadRequest(new { error = "Invalid status or priority" });

        if (body.ParentId.HasValue)
        {
            var parent = await _db.Tasks.AnyAsync(t => t.Id == body.ParentId.Value, ct);
            if (!parent) return BadRequest(new { error = "Parent task not found" });
        }

        var parentId = body.ParentId;
        var maxPos = parentId.HasValue
            ? await _db.Tasks.Where(t => t.ParentId == parentId).MaxAsync(t => (int?)t.Position, ct) ?? 0
            : await _db.Tasks.Where(t => t.ParentId == null).MaxAsync(t => (int?)t.Position, ct) ?? 0;

        var task = new TaskItem
        {
            Title = title,
            Notes = body.Notes?.Trim().Length == 0 ? null : body.Notes?.Trim(),
            Status = status,
            Priority = priority,
            DueDate = string.IsNullOrWhiteSpace(body.DueDate) ? null : DateOnly.TryParse(body.DueDate, out var d) ? d : null,
            ParentId = parentId,
            Position = maxPos + 1,
            CompletedAt = status == "done" ? DateTimeOffset.UtcNow : null,
        };
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync(ct);
        return StatusCode(201, task);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskBody body, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });

        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (task is null) return NotFound(new { error = "Task not found" });

        if (body.Title is not null)
        {
            var v = body.Title.Trim();
            if (string.IsNullOrEmpty(v)) return BadRequest(new { error = "Title cannot be empty" });
            task.Title = v;
        }
        if (body.Notes is not null) task.Notes = body.Notes.Trim().Length == 0 ? null : body.Notes.Trim();
        if (body.Status is not null)
        {
            if (!ValidStatus.Contains(body.Status)) return BadRequest(new { error = "Invalid status" });
            task.Status = body.Status;
            task.CompletedAt = body.Status == "done" ? DateTimeOffset.UtcNow : null;
        }
        if (body.Priority is not null)
        {
            if (!ValidPriority.Contains(body.Priority)) return BadRequest(new { error = "Invalid priority" });
            task.Priority = body.Priority;
        }
        if (body.DueDate is not null)
            task.DueDate = string.IsNullOrWhiteSpace(body.DueDate) ? null : DateOnly.TryParse(body.DueDate, out var d) ? d : null;

        if (body.ParentId is not null)
        {
            var newParentId = body.ParentId == 0 ? (int?)null : body.ParentId;
            if (newParentId == id) return BadRequest(new { error = "A task cannot be its own parent" });

            if (newParentId.HasValue)
            {
                var cursor = (int?)newParentId;
                var seen = new HashSet<int>();
                while (cursor.HasValue)
                {
                    if (cursor.Value == id) return BadRequest(new { error = "Cannot move a task under one of its descendants" });
                    if (seen.Contains(cursor.Value)) break;
                    seen.Add(cursor.Value);
                    var parentRow = await _db.Tasks.AsNoTracking()
                        .Where(t => t.Id == cursor.Value)
                        .Select(t => new { t.Id, t.ParentId })
                        .FirstOrDefaultAsync(ct);
                    if (parentRow is null) return BadRequest(new { error = "Parent task not found" });
                    cursor = parentRow.ParentId;
                }
            }
            task.ParentId = newParentId;
        }
        if (body.Position.HasValue) task.Position = body.Position.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(task);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid id" });
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (task is null) return NotFound(new { error = "Task not found" });
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
