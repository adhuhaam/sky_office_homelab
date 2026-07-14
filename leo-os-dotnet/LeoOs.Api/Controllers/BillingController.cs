using LeoOs.Api.Auth;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/billing")]
public sealed class BillingController : ControllerBase
{
    private readonly LeoOsDbContext _db;
    private const string IssuerName = "LEO EMPLOYMENT SERVICES PVT LTD";

    public BillingController(LeoOsDbContext db) => _db = db;

    public sealed record ItemBody(
        string Description, string? Detail,
        string? Qty, string? Rate
    );

    public sealed record DocumentBody(
        string Kind,
        int? CompanyId, int? ClientId,
        string CustomerName, string? CustomerAddress, string? CustomerTin,
        string IssueDate, string? DueDate, string? Terms,
        string? GstRate, bool? GstInclusive, string? Notes, string? Status,
        List<ItemBody> Items,
        List<int>? LinkedSalaryIds
    );

    private bool CanAccessDocument(int docCompanyId, int? docClientId)
    {
        var session = HttpContext.GetLeoSession();
        if (session is null || !session.Data.Authenticated) return false;
        var role = session.Data.Role ?? "";
        if (role is "superuser" or "admin") return true;
        if (!int.TryParse(session.Data.LinkedEntityId, out var eid)) return false;
        if (role == "company") return docCompanyId == eid;
        if (role == "client") return docClientId == eid;
        return false;
    }

    private static string Pad(int n) => n.ToString().PadLeft(6, '0');

    private async Task<string> AllocateNumberAsync(string kind, CancellationToken ct)
    {
        var prefix = kind == "invoice" ? "INV-" : "QT-";
        var numbers = await _db.BillingDocuments.AsNoTracking()
            .Where(d => d.Kind == kind)
            .Select(d => d.Number)
            .ToListAsync(ct);
        int max = 0;
        foreach (var num in numbers)
        {
            if (num.StartsWith(prefix) && int.TryParse(num[prefix.Length..], out var n))
                max = Math.Max(max, n);
        }
        return $"{prefix}{Pad(max + 1)}";
    }

    private async Task<int> GetOrCreateIssuerIdAsync(CancellationToken ct)
    {
        var existing = await _db.Companies.AsNoTracking()
            .Where(c => c.Name.ToLower() == IssuerName.ToLower())
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);
        if (existing != 0) return existing;

        var co = new Company { Name = IssuerName, RegistrationNumber = "C20542025" };
        _db.Companies.Add(co);
        await _db.SaveChangesAsync(ct);
        return co.Id;
    }

    private static decimal ComputeLineAmount(decimal qty, decimal rate) => qty * rate;

    private async Task<object?> LoadDocumentByIdAsync(int id, CancellationToken ct)
    {
        var doc = await _db.BillingDocuments.AsNoTracking()
            .Where(d => d.Id == id)
            .Join(_db.Companies.AsNoTracking(), d => d.CompanyId, c => c.Id,
                (d, c) => new { d, c })
            .GroupJoin(_db.Clients.AsNoTracking(), x => x.d.ClientId, cl => cl.Id,
                (x, cls) => new { x.d, x.c, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new
            {
                x.d.Id, x.d.Kind, x.d.Number,
                x.d.CompanyId, companyName = x.c.Name,
                companyAddress = x.c.Address, companyEmail = x.c.Email, companyPhone = x.c.Phone,
                companyRegistrationNumber = x.c.RegistrationNumber,
                companyBankName = x.c.BankName, companyBankAccountNumber = x.c.BankAccountNumber,
                companyBankAccountHolder = x.c.BankAccountHolder, companyBankSwiftCode = x.c.BankSwiftCode,
                letterheadImage = x.c.LetterheadImage, invoiceLogoImage = x.c.InvoiceLogoImage,
                signatoryName = x.c.SignatoryName, signatoryDesignation = x.c.SignatoryDesignation,
                signatureImage = x.c.SignatureImage,
                x.d.ClientId, clientName = cl != null ? cl.Name : (string?)null,
                x.d.CustomerName, x.d.CustomerAddress, x.d.CustomerTin,
                x.d.IssueDate, x.d.DueDate, x.d.Terms,
                x.d.GstRate, x.d.GstInclusive, x.d.Notes, x.d.Status,
                x.d.CreatedAt, x.d.UpdatedAt,
            })
            .FirstOrDefaultAsync(ct);

        if (doc is null) return null;

        var items = await _db.BillingItems.AsNoTracking()
            .Where(i => i.DocumentId == id)
            .OrderBy(i => i.Position)
            .ToListAsync(ct);

        var settings = await _db.AppSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        var subtotal = items.Sum(i => i.Amount);
        var gstRate = doc.GstRate;
        var grand = doc.GstInclusive
            ? subtotal
            : subtotal + subtotal * gstRate / 100;

        // salary cost
        var salaryCost = await _db.SalaryRecords.AsNoTracking()
            .Where(r => r.InvoiceId == id)
            .SumAsync(r => r.BasicSalary * r.DaysWorked + r.FoodAllowance + r.TransportAllowance
                + r.OtherAllowances + r.OtherExpenses - r.Deductions, ct);

        return new
        {
            doc.Id, doc.Kind, doc.Number,
            doc.CompanyId, doc.companyName, doc.companyAddress, doc.companyEmail, doc.companyPhone,
            doc.companyRegistrationNumber, doc.companyBankName, doc.companyBankAccountNumber,
            doc.companyBankAccountHolder, doc.companyBankSwiftCode,
            doc.letterheadImage, doc.invoiceLogoImage, doc.signatoryName,
            doc.signatoryDesignation, doc.signatureImage,
            doc.ClientId, doc.clientName,
            doc.CustomerName, doc.CustomerAddress, doc.CustomerTin,
            doc.IssueDate, doc.DueDate, doc.Terms,
            doc.GstRate, doc.GstInclusive, doc.Notes, doc.Status,
            doc.CreatedAt, doc.UpdatedAt,
            items,
            subtotal = subtotal.ToString("F2"),
            grandTotal = grand.ToString("F2"),
            employeeCost = salaryCost.ToString("F2"),
            profit = (grand - salaryCost).ToString("F2"),
            systemLogoImage = settings?.LogoImage,
        };
    }

    // ─── Public endpoints (no auth) ──────────────────────────────────────────

    [HttpGet("public/{id:int}")]
    public async Task<IActionResult> GetPublic(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid document id" });
        var doc = await LoadDocumentByIdAsync(id, ct);
        if (doc is null) return NotFound(new { error = "Not found" });
        return Ok(doc);
    }

    [HttpGet("public/{id:int}/print")]
    public async Task<IActionResult> GetPublicPrint(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid document id" });
        var doc = await LoadDocumentByIdAsync(id, ct);
        if (doc is null) return NotFound(new { error = "Not found" });
        return Ok(doc);
    }

    [HttpGet("public/{id:int}/preview")]
    public async Task<IActionResult> GetPublicPreview(int id, CancellationToken ct)
    {
        if (id <= 0) return BadRequest(new { error = "Invalid document id" });
        var doc = await LoadDocumentByIdAsync(id, ct);
        if (doc is null) return NotFound(new { error = "Not found" });
        // Return a minimal HTML stub
        var html = $"<html><body><h1>Document {id}</h1><pre>{System.Text.Json.JsonSerializer.Serialize(doc)}</pre></body></html>";
        return Content(html, "text/html; charset=utf-8");
    }

    // ─── Authed endpoints ─────────────────────────────────────────────────────

    [HttpGet("documents")]
    [RequireLeoAuth]
    public async Task<IActionResult> List(
        [FromQuery] string? search, [FromQuery] string? kind,
        [FromQuery] string? status, [FromQuery] int? companyId, [FromQuery] int? clientId,
        CancellationToken ct)
    {
        var session = HttpContext.GetLeoSession()!;
        var role = session.Data.Role ?? "";

        IQueryable<BillingDocument> q = _db.BillingDocuments.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(kind)) q = q.Where(d => d.Kind == kind);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(d => d.Status == status);
        if (companyId.HasValue) q = q.Where(d => d.CompanyId == companyId.Value);
        if (clientId.HasValue) q = q.Where(d => d.ClientId == clientId.Value);

        if (role is "superuser" or "admin") { /* unrestricted */ }
        else if (role == "company")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied" });
            q = q.Where(d => d.CompanyId == eid);
        }
        else if (role == "client")
        {
            if (!int.TryParse(session.Data.LinkedEntityId, out var eid))
                return StatusCode(403, new { error = "Access denied" });
            q = q.Where(d => d.ClientId == eid);
        }
        else
        {
            return StatusCode(403, new { error = "Access denied" });
        }

        var rows = await q
            .Join(_db.Companies.AsNoTracking(), d => d.CompanyId, c => c.Id,
                (d, c) => new { d, c })
            .GroupJoin(_db.Clients.AsNoTracking(), x => x.d.ClientId, cl => cl.Id,
                (x, cls) => new { x.d, x.c, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new
            {
                x.d.Id, x.d.Kind, x.d.Number,
                x.d.CompanyId, companyName = x.c.Name,
                x.d.ClientId, clientName = cl != null ? cl.Name : (string?)null,
                x.d.CustomerName, x.d.IssueDate, x.d.DueDate,
                x.d.GstRate, x.d.GstInclusive, x.d.Status,
                x.d.CreatedAt,
            })
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct);

        var docIds = rows.Select(r => r.Id).ToList();

        // Compute subtotals
        var subtotals = await _db.BillingItems.AsNoTracking()
            .Where(i => docIds.Contains(i.DocumentId))
            .GroupBy(i => i.DocumentId)
            .Select(g => new { DocumentId = g.Key, Total = g.Sum(i => i.Amount) })
            .ToListAsync(ct);
        var subtotalMap = subtotals.ToDictionary(x => x.DocumentId, x => x.Total);

        // salary costs
        var salaryCosts = await _db.SalaryRecords.AsNoTracking()
            .Where(r => r.InvoiceId != null && docIds.Contains(r.InvoiceId!.Value))
            .GroupBy(r => r.InvoiceId)
            .Select(g => new
            {
                InvoiceId = g.Key,
                Cost = g.Sum(r => r.BasicSalary * r.DaysWorked + r.FoodAllowance +
                    r.TransportAllowance + r.OtherAllowances + r.OtherExpenses - r.Deductions)
            })
            .ToListAsync(ct);
        var costMap = salaryCosts.Where(x => x.InvoiceId.HasValue).ToDictionary(x => x.InvoiceId!.Value, x => x.Cost);

        var result = rows.Select(r =>
        {
            var sub = subtotalMap.TryGetValue(r.Id, out var s) ? s : 0m;
            var gst = r.GstRate;
            var grand = r.GstInclusive ? sub : sub + sub * gst / 100;
            var cost = costMap.TryGetValue(r.Id, out var c) ? c : 0m;
            return new
            {
                r.Id, r.Kind, r.Number,
                r.CompanyId, r.companyName,
                r.ClientId, r.clientName,
                r.CustomerName, r.IssueDate, r.DueDate,
                r.GstRate, r.GstInclusive, r.Status,
                r.CreatedAt,
                subtotal = sub.ToString("F2"),
                grandTotal = grand.ToString("F2"),
                employeeCost = cost.ToString("F2"),
                profit = (grand - cost).ToString("F2"),
            };
        });

        if (!string.IsNullOrWhiteSpace(search))
        {
            var sq = search.Trim().ToLowerInvariant();
            result = result.Where(r =>
                r.Number.ToLower().Contains(sq) ||
                r.CustomerName.ToLower().Contains(sq) ||
                (r.companyName?.ToLower().Contains(sq) ?? false));
        }

        return Ok(result);
    }

    [HttpGet("documents/{id:int}/preview")]
    [RequireLeoAuth]
    public async Task<IActionResult> Preview(int id, [FromQuery] bool print = false, CancellationToken ct = default)
    {
        var doc = await _db.BillingDocuments.AsNoTracking()
            .Where(d => d.Id == id)
            .Select(d => new { d.CompanyId, d.ClientId })
            .FirstOrDefaultAsync(ct);
        if (doc is null) return NotFound("Not found");
        if (!CanAccessDocument(doc.CompanyId, doc.ClientId)) return StatusCode(403, "Access denied");

        var full = await LoadDocumentByIdAsync(id, ct);
        if (full is null) return NotFound("Not found");

        var html = $"<html><body><pre>{System.Text.Json.JsonSerializer.Serialize(full)}</pre></body></html>";
        return Content(html, "text/html; charset=utf-8");
    }

    [HttpGet("documents/{id:int}")]
    [RequireLeoAuth]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var doc = await _db.BillingDocuments.AsNoTracking()
            .Where(d => d.Id == id)
            .Select(d => new { d.CompanyId, d.ClientId })
            .FirstOrDefaultAsync(ct);
        if (doc is null) return NotFound(new { error = "Not found" });
        if (!CanAccessDocument(doc.CompanyId, doc.ClientId)) return StatusCode(403, new { error = "Access denied" });
        return Ok(await LoadDocumentByIdAsync(id, ct));
    }

    [HttpPost("documents")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Create([FromBody] DocumentBody body, CancellationToken ct)
    {
        if (body.Items is null || body.Items.Count == 0)
            return BadRequest(new { error = "At least one item is required" });
        if (string.IsNullOrWhiteSpace(body.CustomerName))
            return BadRequest(new { error = "customerName is required" });

        var issueDate = Money.NormalizeDate(body.IssueDate);
        if (issueDate is null or "invalid") return BadRequest(new { error = "Invalid issue date" });
        var dueDate = Money.NormalizeDate(body.DueDate);
        if (dueDate == "invalid") return BadRequest(new { error = "Invalid due date" });
        var gstRate = Money.NormalizeMoney(body.GstRate ?? "0", 2, 3) ?? "0.00";

        var companyId = body.CompanyId ?? await GetOrCreateIssuerIdAsync(ct);
        var number = await AllocateNumberAsync(body.Kind, ct);

        var doc = new BillingDocument
        {
            Kind = body.Kind,
            Number = number,
            CompanyId = companyId,
            ClientId = body.ClientId,
            CustomerName = body.CustomerName.Trim(),
            CustomerAddress = body.CustomerAddress,
            CustomerTin = body.CustomerTin,
            IssueDate = DateOnly.Parse(issueDate),
            DueDate = dueDate is null ? null : DateOnly.Parse(dueDate),
            Terms = body.Terms,
            GstRate = decimal.Parse(gstRate),
            GstInclusive = body.GstInclusive ?? true,
            Notes = body.Notes,
            Status = body.Status ?? "draft",
        };
        _db.BillingDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);

        for (int i = 0; i < body.Items.Count; i++)
        {
            var item = body.Items[i];
            var qty = decimal.Parse(Money.NormalizeMoney(item.Qty ?? "1", 4, 10) ?? "1.0000");
            var rate = decimal.Parse(Money.NormalizeMoney(item.Rate ?? "0", 4, 10) ?? "0.0000");
            _db.BillingItems.Add(new BillingItem
            {
                DocumentId = doc.Id,
                Position = i,
                Description = item.Description.Trim(),
                Detail = item.Detail,
                Qty = qty,
                Rate = rate,
                Amount = qty * rate,
            });
        }

        if (body.LinkedSalaryIds is { Count: > 0 })
        {
            await _db.SalaryRecords
                .Where(r => body.LinkedSalaryIds.Contains(r.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.InvoiceId, doc.Id), ct);
        }

        await _db.SaveChangesAsync(ct);
        return StatusCode(201, await LoadDocumentByIdAsync(doc.Id, ct));
    }

    [HttpPatch("documents/{id:int}")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] DocumentBody body, CancellationToken ct)
    {
        var doc = await _db.BillingDocuments.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return NotFound(new { error = "Not found" });

        if (body.CustomerName is not null) doc.CustomerName = body.CustomerName.Trim();
        if (body.CustomerAddress is not null) doc.CustomerAddress = body.CustomerAddress;
        if (body.CustomerTin is not null) doc.CustomerTin = body.CustomerTin;
        if (body.ClientId.HasValue) doc.ClientId = body.ClientId.Value == 0 ? null : body.ClientId;
        if (body.Terms is not null) doc.Terms = body.Terms;
        if (body.Notes is not null) doc.Notes = body.Notes;
        if (body.Status is not null)
        {
            if (body.Status == "voided")
            {
                await _db.SalaryRecords.Where(r => r.InvoiceId == id)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.InvoiceId, (int?)null), ct);
            }
            doc.Status = body.Status;
        }
        if (body.GstRate is not null)
            doc.GstRate = decimal.Parse(Money.NormalizeMoney(body.GstRate, 2, 3) ?? "0.00");
        if (body.GstInclusive.HasValue) doc.GstInclusive = body.GstInclusive.Value;
        if (body.IssueDate is not null)
        {
            var d = Money.NormalizeDate(body.IssueDate);
            if (d is null or "invalid") return BadRequest(new { error = "Invalid issue date" });
            doc.IssueDate = DateOnly.Parse(d);
        }
        if (body.DueDate is not null)
        {
            var d = Money.NormalizeDate(body.DueDate);
            if (d == "invalid") return BadRequest(new { error = "Invalid due date" });
            doc.DueDate = d is null ? null : DateOnly.Parse(d);
        }

        if (body.Items is { Count: > 0 })
        {
            var existing = await _db.BillingItems.Where(i => i.DocumentId == id).ToListAsync(ct);
            _db.BillingItems.RemoveRange(existing);
            for (int i = 0; i < body.Items.Count; i++)
            {
                var item = body.Items[i];
                var qty = decimal.Parse(Money.NormalizeMoney(item.Qty ?? "1", 4, 10) ?? "1.0000");
                var rate = decimal.Parse(Money.NormalizeMoney(item.Rate ?? "0", 4, 10) ?? "0.0000");
                _db.BillingItems.Add(new BillingItem
                {
                    DocumentId = id,
                    Position = i,
                    Description = item.Description.Trim(),
                    Detail = item.Detail,
                    Qty = qty,
                    Rate = rate,
                    Amount = qty * rate,
                });
            }
        }

        if (body.LinkedSalaryIds is { Count: > 0 })
        {
            await _db.SalaryRecords
                .Where(r => body.LinkedSalaryIds.Contains(r.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.InvoiceId, id), ct);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(await LoadDocumentByIdAsync(id, ct));
    }

    [HttpDelete("documents/{id:int}")]
    [RequireLeoAuth]
    [RequireRole("superuser", "admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _db.SalaryRecords.Where(r => r.InvoiceId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.InvoiceId, (int?)null), ct);

        var doc = await _db.BillingDocuments.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return NotFound(new { error = "Not found" });
        _db.BillingDocuments.Remove(doc);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
