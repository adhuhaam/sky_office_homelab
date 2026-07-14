using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/salary-records")]
[RequireLeoAuth]
public sealed class SalaryRecordsController : ControllerBase
{
    private readonly LeoOsDbContext _db;

    public SalaryRecordsController(LeoOsDbContext db) => _db = db;

    public sealed record CreateBody(
        string? EmployeeName, int? PassportId,
        int Month, int Year,
        string? BasicSalary, string? FoodAllowance, string? TransportAllowance,
        string? OtherAllowances, string? Deductions, string? OtherExpenses,
        string? ClientSalary, int? InvoiceId, int? DaysWorked,
        string? Notes, string? Status
    );

    public sealed record PatchBody(
        string? EmployeeName, int? PassportId,
        int? Month, int? Year,
        string? BasicSalary, string? FoodAllowance, string? TransportAllowance,
        string? OtherAllowances, string? Deductions, string? OtherExpenses,
        string? ClientSalary, int? InvoiceId, int? DaysWorked,
        string? Notes, string? Status
    );

    private static string? ValidateConfirmed(string status, int daysWorked, string basicSalary)
    {
        if (status != "confirmed") return null;
        if (Money.SalaryDays(daysWorked) <= 0)
            return "Days worked is required when confirming a salary record";
        if (!decimal.TryParse(basicSalary, out var v) || v <= 0)
            return "Employee daily rate is required when confirming a salary record";
        return null;
    }

    private static object Shape(SalaryRecord r,
        string? passportNumber = null, string? employeeType = null, string? jobTitle = null,
        string? agencySalary = null, int? companyId = null, string? companyName = null,
        string? companyAddress = null, string? companyEmail = null, string? companyPhone = null,
        string? companySignatoryName = null, string? companySignatoryDesignation = null)
    => new
    {
        r.Id, r.EmployeeName, r.PassportId,
        r.Month, r.Year,
        r.BasicSalary, r.FoodAllowance, r.TransportAllowance,
        r.OtherAllowances, r.Deductions, r.OtherExpenses,
        r.NetSalary, r.ClientSalary, r.InvoiceId, r.DaysWorked,
        r.Notes, r.Status,
        createdAt = r.CreatedAt.ToString("O"),
        updatedAt = r.UpdatedAt.ToString("O"),
        passportNumber, employeeType, jobTitle, agencySalary,
        companyId, companyName, companyAddress, companyEmail, companyPhone,
        companySignatoryName, companySignatoryDesignation,
    };

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? month, [FromQuery] int? year, [FromQuery] string? status,
        [FromQuery] int? passportId, [FromQuery] int? clientId,
        [FromQuery] bool unlinked = false, [FromQuery] bool forInvoice = false,
        CancellationToken ct = default)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        IQueryable<SalaryRecord> q = _db.SalaryRecords.AsNoTracking();

        if (role == "employee")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var pid))
                return StatusCode(403, new { error = "Access denied — no linked passport on session" });
            q = q.Where(r => r.PassportId == pid);
        }
        else if (role is not ("superuser" or "admin"))
        {
            return StatusCode(403, new { error = "Access denied" });
        }

        if (month.HasValue) q = q.Where(r => r.Month == month.Value);
        if (year.HasValue) q = q.Where(r => r.Year == year.Value);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(r => r.Status == status);
        if (passportId.HasValue) q = q.Where(r => r.PassportId == passportId.Value);
        if (unlinked || forInvoice) q = q.Where(r => r.InvoiceId == null);

        var rows = await q
            .GroupJoin(_db.Passports.AsNoTracking(),
                r => r.PassportId, p => p.Id, (r, ps) => new { r, ps })
            .SelectMany(x => x.ps.DefaultIfEmpty(), (x, p) => new { x.r, p })
            .GroupJoin(_db.Companies.AsNoTracking(),
                x => x.p != null ? x.p.CompanyId : null, c => c.Id, (x, cs) => new { x.r, x.p, cs })
            .SelectMany(x => x.cs.DefaultIfEmpty(), (x, c) => new { x.r, x.p, c })
            .GroupJoin(_db.LoaEntries.AsNoTracking(),
                x => x.p != null ? x.p.Id : null, l => l.PassportId, (x, ls) => new { x.r, x.p, x.c, ls })
            .SelectMany(x => x.ls.DefaultIfEmpty(), (x, l) => new
            {
                x.r,
                passportNumber = x.p != null ? x.p.PassportNumber : null,
                employeeType = x.p != null ? x.p.EmployeeType : null,
                agencySalary = x.p != null ? x.p.AgencySalary.ToString() : null,
                companyId = x.p != null ? x.p.CompanyId : null,
                companyName = x.c != null ? x.c.Name : null,
                companyAddress = x.c != null ? x.c.Address : null,
                companyEmail = x.c != null ? x.c.Email : null,
                companyPhone = x.c != null ? x.c.Phone : null,
                companySignatoryName = x.c != null ? x.c.SignatoryName : null,
                companySignatoryDesignation = x.c != null ? x.c.SignatoryDesignation : null,
                jobTitle = l != null ? l.JobTitle : null,
                clientId = x.p != null ? x.p.ClientId : null,
            })
            .OrderBy(x => x.r.Year).ThenBy(x => x.r.Month)
            .ToListAsync(ct);

        // client filter: filter by clientId via passport
        IEnumerable<dynamic> result = rows;
        if (clientId.HasValue)
            result = rows.Where(x => x.clientId == clientId.Value && x.employeeType == "casual");

        return Ok(result.Select(x => Shape(x.r,
            x.passportNumber, x.employeeType, x.jobTitle, x.agencySalary,
            x.companyId, x.companyName, x.companyAddress, x.companyEmail, x.companyPhone,
            x.companySignatoryName, x.companySignatoryDesignation)));
    }

    [HttpPost]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] CreateBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.EmployeeName) && !body.PassportId.HasValue)
            return BadRequest(new { error = "employeeName or passportId is required" });
        if (body.Month < 1 || body.Month > 12) return BadRequest(new { error = "Invalid month" });
        if (body.Year < 2000 || body.Year > 2100) return BadRequest(new { error = "Invalid year" });

        var days = body.DaysWorked ?? 0;
        var basicSalary = Money.NormalizeMoney(body.BasicSalary ?? "0") ?? "0.00";
        var foodAllowance = Money.NormalizeMoney(body.FoodAllowance ?? "0") ?? "0.00";
        var transportAllowance = Money.NormalizeMoney(body.TransportAllowance ?? "0") ?? "0.00";
        var otherAllowances = Money.NormalizeMoney(body.OtherAllowances ?? "0") ?? "0.00";
        var deductions = Money.NormalizeMoney(body.Deductions ?? "0") ?? "0.00";
        var otherExpenses = Money.NormalizeMoney(body.OtherExpenses ?? "0") ?? "0.00";
        var clientSalary = Money.NormalizeMoney(body.ClientSalary ?? "0") ?? "0.00";
        var status = body.Status ?? "draft";

        var confirmError = ValidateConfirmed(status, days, basicSalary);
        if (confirmError is not null) return BadRequest(new { error = confirmError });

        var netSalary = Money.ComputeEmployeeNet(
            decimal.Parse(basicSalary), decimal.Parse(foodAllowance),
            decimal.Parse(transportAllowance), decimal.Parse(otherAllowances),
            decimal.Parse(deductions), decimal.Parse(otherExpenses), days);

        string employeeName = body.EmployeeName?.Trim() ?? "";
        if (string.IsNullOrEmpty(employeeName) && body.PassportId.HasValue)
        {
            var pp = await _db.Passports.AsNoTracking()
                .Where(p => p.Id == body.PassportId.Value)
                .Select(p => p.FullName)
                .FirstOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(pp))
                return BadRequest(new { error = "Passport not found or has no full name" });
            employeeName = pp!.Trim();
        }

        try
        {
            var rec = new SalaryRecord
            {
                EmployeeName = employeeName,
                PassportId = body.PassportId,
                Month = body.Month, Year = body.Year,
                BasicSalary = decimal.Parse(basicSalary),
                FoodAllowance = decimal.Parse(foodAllowance),
                TransportAllowance = decimal.Parse(transportAllowance),
                OtherAllowances = decimal.Parse(otherAllowances),
                Deductions = decimal.Parse(deductions),
                OtherExpenses = decimal.Parse(otherExpenses),
                NetSalary = decimal.Parse(netSalary),
                ClientSalary = decimal.Parse(clientSalary),
                InvoiceId = body.InvoiceId,
                DaysWorked = days,
                Notes = body.Notes,
                Status = status,
            };
            _db.SalaryRecords.Add(rec);
            await _db.SaveChangesAsync(ct);
            return StatusCode(201, Shape(rec));
        }
        catch (Exception ex) when (ex is Npgsql.PostgresException pg && pg.SqlState == "23505")
        {
            return StatusCode(409, new { error = "Salary record already exists for this employee/month/year" });
        }
    }

    [HttpPatch("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] PatchBody body, CancellationToken ct)
    {
        var rec = await _db.SalaryRecords.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rec is null) return NotFound(new { error = "Not found" });

        if (body.EmployeeName is not null) rec.EmployeeName = body.EmployeeName.Trim();
        if (body.PassportId.HasValue) rec.PassportId = body.PassportId.Value == 0 ? null : body.PassportId;
        if (body.Month.HasValue) rec.Month = body.Month.Value;
        if (body.Year.HasValue) rec.Year = body.Year.Value;
        if (body.InvoiceId.HasValue) rec.InvoiceId = body.InvoiceId.Value == 0 ? null : body.InvoiceId;
        if (body.DaysWorked.HasValue) rec.DaysWorked = body.DaysWorked.Value;
        if (body.Notes is not null) rec.Notes = body.Notes;
        if (body.Status is not null) rec.Status = body.Status;

        foreach (var (val, setter) in new (string? val, Action<decimal> setter)[]
        {
            (body.BasicSalary, v => rec.BasicSalary = v),
            (body.FoodAllowance, v => rec.FoodAllowance = v),
            (body.TransportAllowance, v => rec.TransportAllowance = v),
            (body.OtherAllowances, v => rec.OtherAllowances = v),
            (body.Deductions, v => rec.Deductions = v),
            (body.OtherExpenses, v => rec.OtherExpenses = v),
            (body.ClientSalary, v => rec.ClientSalary = v),
        })
        {
            if (val is not null)
            {
                var norm = Money.NormalizeMoney(val) ?? "0.00";
                setter(decimal.Parse(norm));
            }
        }

        var confirmError = ValidateConfirmed(rec.Status, rec.DaysWorked, rec.BasicSalary.ToString());
        if (confirmError is not null) return BadRequest(new { error = confirmError });

        rec.NetSalary = decimal.Parse(Money.ComputeEmployeeNet(
            rec.BasicSalary, rec.FoodAllowance, rec.TransportAllowance,
            rec.OtherAllowances, rec.Deductions, rec.OtherExpenses, rec.DaysWorked));

        await _db.SaveChangesAsync(ct);
        return Ok(Shape(rec));
    }

    [HttpDelete("{id:int}")]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var rec = await _db.SalaryRecords.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rec is null) return NotFound(new { error = "Not found" });
        _db.SalaryRecords.Remove(rec);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
