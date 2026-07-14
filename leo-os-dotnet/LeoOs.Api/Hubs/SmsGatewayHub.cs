using LeoOs.Infrastructure.Notifications;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace LeoOs.Api.Hubs;

public sealed class SmsGatewayHub : Hub
{
    public const string Path = "/hubs/sms-gateway";
    private readonly IServiceScopeFactory _scopes;

    public SmsGatewayHub(IServiceScopeFactory scopes) => _scopes = scopes;

    public override async Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        var idStr = http?.Request.Query["gatewayId"].FirstOrDefault();
        var key = http?.Request.Query["gatewayKey"].FirstOrDefault();
        if (!int.TryParse(idStr, out var gatewayId) || string.IsNullOrWhiteSpace(key))
        {
            Context.Abort();
            return;
        }

        using var scope = _scopes.CreateScope();
        var gateways = scope.ServiceProvider.GetRequiredService<ISmsGatewayService>();
        var g = await gateways.AuthenticateAsync(gatewayId, key, Context.ConnectionAborted);
        if (g is null)
        {
            Context.Abort();
            return;
        }

        Context.Items["gatewayId"] = gatewayId;
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(gatewayId));
        await gateways.SetOnlineAsync(gatewayId, true, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("GatewayOnline", new { gatewayId });
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("gatewayId", out var idObj) && idObj is int gatewayId)
        {
            using var scope = _scopes.CreateScope();
            var gateways = scope.ServiceProvider.GetRequiredService<ISmsGatewayService>();
            await gateways.SetOnlineAsync(gatewayId, false, CancellationToken.None);
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task Heartbeat(HeartbeatDto dto)
    {
        if (!TryGetGatewayId(out var gatewayId)) return;
        using var scope = _scopes.CreateScope();
        var hb = scope.ServiceProvider.GetRequiredService<IGatewayHeartbeatService>();
        await hb.HeartbeatAsync(gatewayId, new HeartbeatPayload(
            dto.BatteryLevel, dto.SignalStrength, dto.NetworkType, dto.SimOperator,
            dto.PhoneNumber, dto.AndroidVersion, dto.DeviceModel, dto.AppVersion,
            dto.TailscaleIp, dto.QueueLength, dto.Connection), Context.ConnectionAborted);
    }

    public async Task SmsCompleted(SmsResultDto dto)
    {
        if (!TryGetGatewayId(out var gatewayId)) return;
        using var scope = _scopes.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<ISmsQueueService>();
        await queue.CompleteAsync(dto.QueueId, gatewayId, dto.Response, Context.ConnectionAborted);
    }

    public async Task SmsFailed(SmsResultDto dto)
    {
        if (!TryGetGatewayId(out var gatewayId)) return;
        using var scope = _scopes.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<ISmsQueueService>();
        await queue.FailAsync(dto.QueueId, gatewayId, dto.Response ?? "SMS failed", scheduleRetry: true, Context.ConnectionAborted);
    }

    private bool TryGetGatewayId(out int gatewayId)
    {
        if (Context.Items.TryGetValue("gatewayId", out var idObj) && idObj is int id)
        {
            gatewayId = id;
            return true;
        }
        gatewayId = 0;
        return false;
    }

    public static string GroupName(int gatewayId) => $"gateway:{gatewayId}";

    public sealed record HeartbeatDto(
        int? BatteryLevel, int? SignalStrength, string? NetworkType, string? SimOperator,
        string? PhoneNumber, string? AndroidVersion, string? DeviceModel, string? AppVersion,
        string? TailscaleIp, int? QueueLength, string? Connection);

    public sealed record SmsResultDto(int QueueId, string? Response);
}

public sealed class SignalRSmsDispatchPublisher : ISmsDispatchPublisher
{
    private readonly IHubContext<SmsGatewayHub> _hub;

    public SignalRSmsDispatchPublisher(IHubContext<SmsGatewayHub> hub) => _hub = hub;

    public async Task<bool> PublishSendSmsAsync(int gatewayId, int queueId, string recipient, string message, CancellationToken ct = default)
    {
        var clients = _hub.Clients.Group(SmsGatewayHub.GroupName(gatewayId));
        await clients.SendAsync("SendSms", new { queueId, recipient, message }, ct);
        return true;
    }
}
