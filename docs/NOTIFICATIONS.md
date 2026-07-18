# Notifications module notes (agents)

When changing SMS / Android / about status:

1. Prefer edits in `leo-os-dotnet` Notification slice + docs — do not start a second .NET solution.
2. Business features enqueue via `INotificationService` only.
3. Keep a **single** Android app: `leo-android` (**Sky Office**, `com.sky.office`) with SMS as `:feature-sms-gateway`.
4. Update [docs/SMS-GATEWAY.md](../docs/SMS-GATEWAY.md) and [docs/ANDROID-APPS.md](../docs/ANDROID-APPS.md) when contracts change.
5. Schema SQL is embedded; braces in templates must not go through EF `ExecuteSqlRaw` (use ADO bootstrap).
