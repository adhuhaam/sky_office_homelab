using System.Text.Json.Serialization;

namespace LeoOs.Infrastructure.Sessions;

public sealed class ExpressSessionData
{
    [JsonPropertyName("cookie")]
    public ExpressCookieData? Cookie { get; set; }

    [JsonPropertyName("authenticated")]
    public bool Authenticated { get; set; }

    [JsonPropertyName("userId")]
    public int? UserId { get; set; }

    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("userEmail")]
    public string? UserEmail { get; set; }

    [JsonPropertyName("userName")]
    public string? UserName { get; set; }

    [JsonPropertyName("linkedEntityId")]
    public string? LinkedEntityId { get; set; }
}

public sealed class ExpressCookieData
{
    [JsonPropertyName("originalMaxAge")]
    public long? OriginalMaxAge { get; set; }

    [JsonPropertyName("expires")]
    public DateTimeOffset? Expires { get; set; }

    [JsonPropertyName("secure")]
    public bool? Secure { get; set; }

    [JsonPropertyName("httpOnly")]
    public bool HttpOnly { get; set; } = true;

    [JsonPropertyName("path")]
    public string Path { get; set; } = "/";

    [JsonPropertyName("sameSite")]
    public string SameSite { get; set; } = "lax";
}
