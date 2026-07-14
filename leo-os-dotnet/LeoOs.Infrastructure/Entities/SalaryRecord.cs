using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("salary_records")]
public class SalaryRecord
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("employee_name")]
    public string EmployeeName { get; set; } = "";
    [Column("passport_id")]
    public int? PassportId { get; set; }
    [Column("month")]
    public int Month { get; set; }
    [Column("year")]
    public int Year { get; set; }
    [Column("basic_salary", TypeName = "numeric(14,2)")]
    public decimal BasicSalary { get; set; }
    [Column("food_allowance", TypeName = "numeric(14,2)")]
    public decimal FoodAllowance { get; set; }
    [Column("transport_allowance", TypeName = "numeric(14,2)")]
    public decimal TransportAllowance { get; set; }
    [Column("other_allowances", TypeName = "numeric(14,2)")]
    public decimal OtherAllowances { get; set; }
    [Column("deductions", TypeName = "numeric(14,2)")]
    public decimal Deductions { get; set; }
    [Column("other_expenses", TypeName = "numeric(14,2)")]
    public decimal OtherExpenses { get; set; }
    [Column("net_salary", TypeName = "numeric(14,2)")]
    public decimal NetSalary { get; set; }
    [Column("client_salary", TypeName = "numeric(14,2)")]
    public decimal ClientSalary { get; set; }
    [Column("invoice_id")]
    public int? InvoiceId { get; set; }
    [Column("days_worked")]
    public int DaysWorked { get; set; }
    [Column("notes")]
    public string? Notes { get; set; }
    [Column("status")]
    public string Status { get; set; } = "draft";
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
