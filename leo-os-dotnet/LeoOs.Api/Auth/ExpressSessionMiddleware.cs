namespace LeoOs.Api.Auth;

/// <summary>
/// Loads express-compatible session from leo.sid cookie or Authorization Bearer sid.
/// </summary>
public sealed class ExpressSessionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _secret;

    public ExpressSessionMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _secret = config["SESSION_SECRET"]
            ?? Environment.GetEnvironmentVariable("SESSION_SECRET")
            ?? throw new InvalidOperationException("SESSION_SECRET is required");
    }

    public async Task InvokeAsync(HttpContext context, SessionService sessions)
    {
        string? sid = null;

        if (context.Request.Cookies.TryGetValue(ExpressSessionCookie.CookieName, out var cookieVal))
            sid = ExpressSessionCookie.Unsign(cookieVal, _secret);

        if (sid is null)
        {
            var auth = context.Request.Headers.Authorization.ToString();
            if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var token = auth["Bearer ".Length..].Trim();
                if (!string.IsNullOrEmpty(token))
                    sid = token;
            }
        }

        if (sid is not null)
        {
            var data = await sessions.GetAsync(sid, context.RequestAborted);
            if (data is { Authenticated: true })
            {
                context.SetLeoSession(new LeoSessionFeature { Sid = sid, Data = data });
            }
        }

        await _next(context);
    }
}
