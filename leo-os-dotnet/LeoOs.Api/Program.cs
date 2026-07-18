using System.Text.Json.Serialization;
using LeoOs.Api.Auth;
using LeoOs.Api.Hubs;
using LeoOs.Api.Services;
using LeoOs.Infrastructure;
using LeoOs.Infrastructure.Notifications;
using LeoOs.Infrastructure.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var databaseUrl = builder.Configuration["DATABASE_URL"]
    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("LeoOs");
var hostOverride = builder.Configuration["DATABASE_HOST_OVERRIDE"]
    ?? Environment.GetEnvironmentVariable("DATABASE_HOST_OVERRIDE");

if (string.IsNullOrWhiteSpace(databaseUrl))
{
    throw new InvalidOperationException(
        "DATABASE_URL (or ConnectionStrings:LeoOs) is required. See leo-os-dotnet/README.md");
}

var connectionString = ConnectionStringUtil.FromDatabaseUrl(databaseUrl, hostOverride);

builder.Services.AddDbContext<LeoOsDbContext>(opt => opt.UseNpgsql(connectionString));
builder.Services.AddScoped<SessionService>();
builder.Services.AddSingleton<PermissionsService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<OcrService>();

builder.Services.AddScoped<ISmsTemplateService, SmsTemplateService>();
builder.Services.AddScoped<ISmsGatewayService, SmsGatewayService>();
builder.Services.AddScoped<IGatewayHeartbeatService, GatewayHeartbeatService>();
builder.Services.AddScoped<ISmsQueueService, SmsQueueService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IOrgSmsFollowUp, OrgSmsFollowUp>();
builder.Services.AddSingleton<ISmsDispatchPublisher, SignalRSmsDispatchPublisher>();
builder.Services.AddHostedService<SmsDispatchWorker>();
builder.Services.AddSignalR();

builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    opts.KnownNetworks.Clear();
    opts.KnownProxies.Clear();
});

builder.Services.Configure<KestrelServerOptions>(opts =>
{
    opts.Limits.MaxRequestBodySize = 20 * 1024 * 1024; // 20 MB
});

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Leo OS API (.NET)", Version = "v1" });
});

var corsOrigin = builder.Configuration["CORS_ORIGIN"]
    ?? Environment.GetEnvironmentVariable("CORS_ORIGIN")
    ?? "";
var origins = corsOrigin.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (origins.Length == 0)
            policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        else
            policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

var port = builder.Configuration["PORT"]
    ?? Environment.GetEnvironmentVariable("PORT")
    ?? "5080";

if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

try
{
    await NotificationSchemaBootstrap.EnsureCreatedAsync(app.Services);
    app.Logger.LogInformation("SMS notification schema ensured");
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Failed to ensure SMS notification schema");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();
app.UseCors();
app.UseMiddleware<ExpressSessionMiddleware>();
app.UseMiddleware<PermissionsMiddleware>();
app.MapControllers();
app.MapHub<SmsGatewayHub>(SmsGatewayHub.Path);

app.Logger.LogInformation(
    "LEO ASP.NET API listening (PORT={Port}). Primary production API.",
    port);

app.Run();

public partial class Program;
