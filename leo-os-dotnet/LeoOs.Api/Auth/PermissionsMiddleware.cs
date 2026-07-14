using LeoOs.Api.Auth;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LeoOs.Api.Auth;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireRoleAttribute : Attribute, IAsyncActionFilter
{
    private readonly string[] _roles;

    public RequireRoleAttribute(params string[] roles) => _roles = roles;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var session = context.HttpContext.GetLeoSession();
        if (session is null || !session.Data.Authenticated)
        {
            context.Result = new JsonResult(new { error = "Authentication required" })
            {
                StatusCode = StatusCodes.Status401Unauthorized,
            };
            return;
        }

        var role = session.Data.Role ?? "";
        if (!_roles.Contains(role, StringComparer.Ordinal))
        {
            context.Result = new JsonResult(new { error = "Insufficient permissions" })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
            return;
        }

        await next();
    }
}

public sealed class PermissionsMiddleware
{
    private readonly RequestDelegate _next;

    public PermissionsMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, PermissionsService permissions)
    {
        var session = context.GetLeoSession();
        var role = session?.Data.Role;
        if (string.IsNullOrEmpty(role) || role is "superuser" or "admin")
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";
        var target = PermissionsService.ResolveModuleAction(context.Request.Method, path);
        if (target is null)
        {
            await _next(context);
            return;
        }

        try
        {
            var cache = await permissions.GetCacheAsync(context.RequestAborted);
            cache.TryGetValue($"{role}:{target.Value.Module}", out var perm);
            var allowed = target.Value.Action switch
            {
                "view" => perm.CanView,
                "edit" => perm.CanEdit,
                "delete" => perm.CanDelete,
                _ => false,
            };
            if (!allowed)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "Access denied" });
                return;
            }
        }
        catch
        {
            // fail open — match Node
        }

        await _next(context);
    }
}
