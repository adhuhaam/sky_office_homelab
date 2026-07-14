using System.Security.Cryptography;
using System.Text;

namespace LeoOs.Api.Auth;

/// <summary>express-session cookie signing (cookie-signature) for name <c>leo.sid</c>.</summary>
public static class ExpressSessionCookie
{
    public const string CookieName = "leo.sid";

    public static string Sign(string sessionId, string secret)
    {
        var sig = SignRaw(sessionId, secret);
        return $"s:{sessionId}.{sig}";
    }

    public static string? Unsign(string? cookieValue, string secret)
    {
        if (string.IsNullOrEmpty(cookieValue))
            return null;

        var value = cookieValue;
        if (value.StartsWith("s:", StringComparison.Ordinal))
            value = value[2..];

        var lastDot = value.LastIndexOf('.');
        if (lastDot <= 0)
            return null;

        var sid = value[..lastDot];
        var sig = value[(lastDot + 1)..];
        var expected = SignRaw(sid, secret);
        if (!FixedTimeEqualsUtf8(sig, expected))
            return null;
        return sid;
    }

    private static string SignRaw(string val, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(val));
        return Convert.ToBase64String(hash).TrimEnd('=');
    }

    private static bool FixedTimeEqualsUtf8(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        if (ba.Length != bb.Length)
            return false;
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }
}
