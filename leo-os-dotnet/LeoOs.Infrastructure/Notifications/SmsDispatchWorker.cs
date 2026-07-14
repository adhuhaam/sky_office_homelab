using LeoOs.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LeoOs.Infrastructure.Notifications;

public static class NotificationSchemaBootstrap
{
    public static async Task EnsureCreatedAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LeoOsDbContext>();
        var asm = typeof(NotificationSchemaBootstrap).Assembly;
        await using var stream = asm.GetManifestResourceStream("LeoOs.Infrastructure.Sql.001_sms_notifications.sql")
            ?? throw new InvalidOperationException("Embedded SQL 001_sms_notifications.sql not found");
        using var reader = new StreamReader(stream);
        var sql = await reader.ReadToEndAsync(ct);
        await db.Database.ExecuteSqlRawAsync(sql, ct);
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
