using LeoOs.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace LeoOs.Infrastructure;

public class LeoOsDbContext : DbContext
{
    public LeoOsDbContext(DbContextOptions<LeoOsDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<SessionRow> Sessions => Set<SessionRow>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Passport> Passports => Set<Passport>();
    public DbSet<PasswordRecord> Passwords => Set<PasswordRecord>();
    public DbSet<SalaryRecord> SalaryRecords => Set<SalaryRecord>();
    public DbSet<BillingDocument> BillingDocuments => Set<BillingDocument>();
    public DbSet<BillingItem> BillingItems => Set<BillingItem>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<LoaEntry> LoaEntries => Set<LoaEntry>();
    public DbSet<LoaOption> LoaOptions => Set<LoaOption>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<SmsGateway> SmsGateways => Set<SmsGateway>();
    public DbSet<SmsQueueItem> SmsQueue => Set<SmsQueueItem>();
    public DbSet<SmsLog> SmsLogs => Set<SmsLog>();
    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<SessionRow>(e =>
        {
            e.Property(x => x.Sess).HasColumnType("json");
            e.Property(x => x.Expire).HasColumnType("timestamp without time zone");
        });

        modelBuilder.Entity<RolePermission>(e =>
        {
            e.HasKey(x => new { x.Role, x.Module });
        });

        modelBuilder.Entity<PasswordRecord>(e =>
        {
            e.HasIndex(x => x.CompanyId).IsUnique();
        });

        modelBuilder.Entity<SalaryRecord>(e =>
        {
            e.HasIndex(x => new { x.EmployeeName, x.Month, x.Year }).IsUnique();
        });

        modelBuilder.Entity<BillingDocument>(e =>
        {
            e.HasIndex(x => new { x.Kind, x.Number }).IsUnique();
        });

        modelBuilder.Entity<LoaOption>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Category, x.Value }).IsUnique();
        });

        modelBuilder.Entity<ExpenseCategory>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<NotificationTemplate>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<SmsGateway>(e =>
        {
            e.HasIndex(x => x.DeviceId);
        });

        modelBuilder.Entity<SmsQueueItem>(e =>
        {
            e.HasIndex(x => new { x.Status, x.Priority, x.CreatedAt });
        });
    }
}
