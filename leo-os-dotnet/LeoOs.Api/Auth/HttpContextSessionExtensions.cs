using LeoOs.Infrastructure.Sessions;

namespace LeoOs.Api.Auth;

public sealed class LeoSessionFeature
{
    public string Sid { get; init; } = "";
    public ExpressSessionData Data { get; init; } = new();
}

public static class HttpContextSessionExtensions
{
    public const string FeatureKey = "LeoOs.Session";

    public static LeoSessionFeature? GetLeoSession(this HttpContext ctx) =>
        ctx.Items.TryGetValue(FeatureKey, out var v) ? v as LeoSessionFeature : null;

    public static void SetLeoSession(this HttpContext ctx, LeoSessionFeature feature) =>
        ctx.Items[FeatureKey] = feature;
}
