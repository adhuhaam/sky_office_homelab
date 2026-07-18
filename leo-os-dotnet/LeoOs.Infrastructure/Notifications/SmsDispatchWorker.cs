using LeoOs.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LeoOs.Infrastructure.Notifications;

public static class NotificationSchemaBootstrap
{
    private static readonly string[] Scripts =
    {
        "LeoOs.Infrastructure.Sql.001_sms_notifications.sql",
        "LeoOs.Infrastructure.Sql.002_sms_gateway_default.sql",
    };

    public static async Task EnsureCreatedAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LeoOsDbContext>();
        var asm = typeof(NotificationSchemaBootstrap).Assembly;

        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await db.Database.OpenConnectionAsync(ct);

        foreach (var resource in Scripts)
        {
            await using var stream = asm.GetManifestResourceStream(resource)
                ?? throw new InvalidOperationException($"Embedded SQL {resource} not found");
            using var reader = new StreamReader(stream);
            var sql = await reader.ReadToEndAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }
}

public sealed class SmsDispatchWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<SmsDispatchWorker> _log;
    private readonly ISmsDispatchPublisher _publisher;

    public SmsDispatchWorker(
        IServiceScopeFactory scopes,
        ILogger<SmsDispatchWorker> log,
        ISmsDispatchPublisher publisher)
    {
        _scopes = scopes;
        _log = log;
        _publisher = publisher;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("SMS dispatch worker started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var queue = scope.ServiceProvider.GetRequiredService<ISmsQueueService>();
                var item = await queue.ClaimNextAsync(stoppingToken);
                if (item is null || item.GatewayId is null)
                {
                    await Task.Delay(2000, stoppingToken);
                    continue;
                }

                var pushed = await _publisher.PublishSendSmsAsync(
                    item.GatewayId.Value, item.Id, item.Recipient, item.Message, stoppingToken);
                if (!pushed)
                {
                    await queue.FailAsync(item.Id, item.GatewayId, "No online gateway connection", scheduleRetry: true, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "SMS dispatch loop error");
                await Task.Delay(5000, stoppingToken);
            }
        }
    }
}

/// <summary>Implemented in Api layer via SignalR hub context.</summary>
public interface ISmsDispatchPublisher
{
    Task<bool> PublishSendSmsAsync(int gatewayId, int queueId, string recipient, string message, CancellationToken ct = default);
}
