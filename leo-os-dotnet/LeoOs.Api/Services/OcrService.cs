using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LeoOs.Api.Services;

public sealed class OcrService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<OcrService> _logger;

    public OcrService(IHttpClientFactory httpFactory, IConfiguration config, ILogger<OcrService> logger)
    {
        _httpFactory = httpFactory;
        _config = config;
        _logger = logger;
    }

    private sealed record OcrConfig(string ApiKey, string BaseUrl, string Model);

    private async Task<OcrConfig?> GetConfigAsync(LeoOsDbContext db, CancellationToken ct)
    {
        var envKey = _config["OPENAI_API_KEY"] ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
                  ?? _config["DEEPSEEK_API_KEY"] ?? Environment.GetEnvironmentVariable("DEEPSEEK_API_KEY");
        var envBase = _config["OPENAI_OCR_BASE_URL"] ?? Environment.GetEnvironmentVariable("OPENAI_OCR_BASE_URL")
                   ?? _config["DEEPSEEK_OCR_BASE_URL"] ?? Environment.GetEnvironmentVariable("DEEPSEEK_OCR_BASE_URL");
        var envModel = _config["OPENAI_OCR_MODEL"] ?? Environment.GetEnvironmentVariable("OPENAI_OCR_MODEL")
                    ?? _config["DEEPSEEK_OCR_MODEL"] ?? Environment.GetEnvironmentVariable("DEEPSEEK_OCR_MODEL");

        if (!string.IsNullOrEmpty(envKey))
        {
            return new OcrConfig(
                envKey.Trim(),
                (envBase?.TrimEnd('/')) ?? "https://api.openai.com/v1",
                envModel?.Trim() ?? "gpt-4o-mini"
            );
        }

        var settings = await db.AppSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        if (!string.IsNullOrEmpty(settings?.DeepseekApiKey))
        {
            return new OcrConfig(
                settings.DeepseekApiKey,
                (settings.DeepseekOcrBaseUrl?.TrimEnd('/') ?? envBase?.TrimEnd('/') ?? "https://api.openai.com/v1"),
                settings.DeepseekOcrModel ?? envModel ?? "gpt-4o-mini"
            );
        }

        return null;
    }

    public sealed class ExtractedPassportData
    {
        public string? FullName { get; init; }
        public string? PassportNumber { get; init; }
        public string? DateOfBirth { get; init; }
        public string? DateOfIssue { get; init; }
        public string? DateOfExpiry { get; init; }
        public string? Nationality { get; init; }
        public string? Address { get; init; }
    }

    private sealed class ChatCompletionResponse
    {
        [JsonPropertyName("choices")]
        public Choice[]? Choices { get; init; }

        public sealed class Choice
        {
            [JsonPropertyName("message")]
            public Message? Message { get; init; }
        }

        public sealed class Message
        {
            [JsonPropertyName("content")]
            public string? Content { get; init; }
        }
    }

    public async Task<ExtractedPassportData?> ExtractPassportDataAsync(
        byte[] imageBytes, string mimeType, LeoOsDbContext db, CancellationToken ct)
    {
        var cfg = await GetConfigAsync(db, ct);
        if (cfg is null)
        {
            _logger.LogWarning("OCR: no API key configured, skipping extraction");
            return null;
        }

        var base64 = Convert.ToBase64String(imageBytes);
        var dataUrl = $"data:{mimeType};base64,{base64}";

        var payload = new
        {
            model = cfg.Model,
            messages = new object[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "text",
                            text = """
                                Extract passport information from this image. Return JSON with these exact keys:
                                fullName, passportNumber, dateOfBirth, dateOfIssue, dateOfExpiry, nationality, address.
                                Use ISO date format (YYYY-MM-DD) for dates. Return null for missing fields.
                                Respond with only the JSON object, no markdown.
                                """
                        },
                        new
                        {
                            type = "image_url",
                            image_url = new { url = dataUrl }
                        }
                    }
                }
            },
            max_tokens = 500,
        };

        var http = _httpFactory.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cfg.ApiKey);

        var content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsync($"{cfg.BaseUrl}/chat/completions", content, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OCR: HTTP request failed");
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OCR: API returned {Status}", response.StatusCode);
            return null;
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        ChatCompletionResponse? result;
        try
        {
            result = JsonSerializer.Deserialize<ChatCompletionResponse>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return null;
        }

        var text = result?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
        if (string.IsNullOrEmpty(text)) return null;

        // Strip markdown fences if present
        if (text.StartsWith("```"))
        {
            var lines = text.Split('\n');
            text = string.Join('\n', lines.Skip(1).TakeWhile(l => !l.StartsWith("```")));
        }

        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            return new ExtractedPassportData
            {
                FullName = root.TryGetProperty("fullName", out var fn) ? fn.GetString() : null,
                PassportNumber = root.TryGetProperty("passportNumber", out var pn) ? pn.GetString() : null,
                DateOfBirth = root.TryGetProperty("dateOfBirth", out var dob) ? dob.GetString() : null,
                DateOfIssue = root.TryGetProperty("dateOfIssue", out var doi) ? doi.GetString() : null,
                DateOfExpiry = root.TryGetProperty("dateOfExpiry", out var doe) ? doe.GetString() : null,
                Nationality = root.TryGetProperty("nationality", out var nat) ? nat.GetString() : null,
                Address = root.TryGetProperty("address", out var addr) ? addr.GetString() : null,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OCR: Failed to parse response JSON: {text}", text);
            return null;
        }
    }
}
