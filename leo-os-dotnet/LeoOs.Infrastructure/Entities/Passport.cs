using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("passports")]
public class Passport
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("full_name")]
    public string? FullName { get; set; }
    [Column("passport_number")]
    public string? PassportNumber { get; set; }
    [Column("date_of_birth")]
    public string? DateOfBirth { get; set; }
    [Column("date_of_issue")]
    public string? DateOfIssue { get; set; }
    [Column("date_of_expiry")]
    public string? DateOfExpiry { get; set; }
    [Column("address")]
    public string? Address { get; set; }
    [Column("emergency_contact_name")]
    public string? EmergencyContactName { get; set; }
    [Column("emergency_contact_phone")]
    public string? EmergencyContactPhone { get; set; }
    [Column("nationality")]
    public string? Nationality { get; set; }
    [Column("status")]
    public string Status { get; set; } = "processing";
    [Column("submitted")]
    public bool Submitted { get; set; }
    [Column("error_message")]
    public string? ErrorMessage { get; set; }
    [Column("original_filename")]
    public string? OriginalFilename { get; set; }
    [Column("company_id")]
    public int? CompanyId { get; set; }
    [Column("client_id")]
    public int? ClientId { get; set; }
    [Column("work_permit_number")]
    public string? WorkPermitNumber { get; set; }
    [Column("agent")]
    public string? Agent { get; set; }
    [Column("agency_salary", TypeName = "numeric(12,2)")]
    public decimal? AgencySalary { get; set; }
    [Column("client_salary", TypeName = "numeric(12,2)")]
    public decimal? ClientSalary { get; set; }
    [Column("agent_rate", TypeName = "numeric(12,2)")]
    public decimal? AgentRate { get; set; }
    [Column("employee_type")]
    public string EmployeeType { get; set; } = "casual";
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
