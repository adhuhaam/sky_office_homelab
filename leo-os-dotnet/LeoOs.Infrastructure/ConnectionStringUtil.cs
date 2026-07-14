using Npgsql;

namespace LeoOs.Infrastructure;

public static class ConnectionStringUtil
{
    /// <summary>
    /// Converts <c>postgresql://user:pass@host:port/db</c> to an Npgsql connection string.
    /// Optional <paramref name="hostOverride"/> replaces the host (e.g. Docker bridge IP from the host).
    /// </summary>
    public static string FromDatabaseUrl(string databaseUrl, string? hostOverride = null)
    {
        if (string.IsNullOrWhiteSpace(databaseUrl))
            throw new ArgumentException("DATABASE_URL is required", nameof(databaseUrl));

        if (!databaseUrl.Contains("://", StringComparison.Ordinal))
            return databaseUrl; // already a key=value connection string

        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);
        var user = Uri.UnescapeDataString(userInfo[0]);
        var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var host = hostOverride ?? uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.Trim('/');

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Username = user,
            Password = pass,
            Database = database,
        };
        return builder.ConnectionString;
    }
}
