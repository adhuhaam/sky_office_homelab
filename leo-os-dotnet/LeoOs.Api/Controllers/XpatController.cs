using LeoOs.Api.Auth;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;

namespace LeoOs.Api.Controllers;

[ApiController]
[Route("api/xpat")]
[RequireLeoAuth]
public sealed class XpatController : ControllerBase
{
    private const string XpatBase = "https://mobile-xpat.egov.mv/api/v1";
    private const string XpatApiKey = "d110e2a8-5adc-4f7b-90a0-701b4fedf476";

    private static readonly Regex IdRe = new(@"^[a-zA-Z0-9_-]+$", RegexOptions.Compiled);

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<XpatController> _logger;

    public XpatController(IHttpClientFactory httpFactory, ILogger<XpatController> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    private HttpClient CreateXpatClient(params string[] accepts)
    {
        var http = _httpFactory.CreateClient();
        http.DefaultRequestHeaders.Add("ApiKey", XpatApiKey);
        // MediaTypeWithQualityHeaderValue only accepts a single type — not "image/jpeg,image/*".
        foreach (var accept in accepts)
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        return http;
    }

    [HttpGet("work-permit")]
    public async Task<IActionResult> WorkPermit(
        [FromQuery] string? workPermitNumber, [FromQuery] string? passportNumber, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(workPermitNumber) || string.IsNullOrWhiteSpace(passportNumber))
            return BadRequest(new { error = "workPermitNumber and passportNumber are required" });

        var http = CreateXpatClient("application/json");
        var url = $"{XpatBase}/WorkPermit?WorkPermitNumber={Uri.EscapeDataString(workPermitNumber.Trim())}" +
                  $"&PassportNumber={Uri.EscapeDataString(passportNumber.Trim())}";

        HttpResponseMessage resp;
        try { resp = await http.GetAsync(url, ct); }
        catch (Exception ex) { _logger.LogError(ex, "Xpat API unreachable"); return StatusCode(502, new { error = "Xpat API unreachable" }); }

        if (!resp.IsSuccessStatusCode) return StatusCode(502, new { error = "Xpat API error" });

        var json = await resp.Content.ReadAsStringAsync(ct);
        Response.Headers.CacheControl = "public, max-age=900";
        return Content(json, "application/json");
    }

    [HttpGet("photo")]
    public async Task<IActionResult> Photo(
        [FromQuery] string? photoId, [FromQuery] string? serviceId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(photoId) || string.IsNullOrWhiteSpace(serviceId)
            || !IdRe.IsMatch(photoId) || !IdRe.IsMatch(serviceId))
            return BadRequest(new { error = "photoId and serviceId are required" });

        var http = CreateXpatClient("image/jpeg", "image/*");
        var url = $"{XpatBase}/WorkPermit/GetImage?photoId={Uri.EscapeDataString(photoId)}" +
                  $"&serviceId={Uri.EscapeDataString(serviceId)}";

        HttpResponseMessage resp;
        try { resp = await http.GetAsync(url, ct); }
        catch (Exception ex) { _logger.LogError(ex, "Xpat photo fetch failed"); return StatusCode(502); }

        if (!resp.IsSuccessStatusCode) return StatusCode(502);

        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
        var ct2 = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
        Response.Headers.CacheControl = "public, max-age=3600";
        return File(bytes, ct2);
    }

    [HttpGet("card")]
    public async Task<IActionResult> Card(
        [FromQuery] string? workPermitNumber, [FromQuery] string? passportNumber, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(workPermitNumber) || string.IsNullOrWhiteSpace(passportNumber))
            return BadRequest(new { error = "workPermitNumber and passportNumber are required" });

        var http = CreateXpatClient("image/png", "image/*");
        var url = $"{XpatBase}/WorkPermitCard/GetWorkPermitCard" +
                  $"?WorkPermitNumber={Uri.EscapeDataString(workPermitNumber.Trim())}" +
                  $"&PassportNumber={Uri.EscapeDataString(passportNumber.Trim())}";

        HttpResponseMessage resp;
        try { resp = await http.GetAsync(url, ct); }
        catch (Exception ex) { _logger.LogError(ex, "Xpat card fetch failed"); return StatusCode(502); }

        if (!resp.IsSuccessStatusCode) return StatusCode(502);

        var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
        var ct2 = resp.Content.Headers.ContentType?.MediaType ?? "image/png";
        Response.Headers.CacheControl = "public, max-age=3600";
        return File(bytes, ct2);
    }
}
