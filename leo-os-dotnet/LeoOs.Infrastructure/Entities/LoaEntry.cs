using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("loa_entries")]
public class LoaEntry
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("company_id")]
    public int? CompanyId { get; set; }
    [Column("passport_id")]
    public int? PassportId { get; set; }
    [Column("company_name")]
    public string? CompanyName { get; set; }
    [Column("company_address")]
    public string? CompanyAddress { get; set; }
    [Column("company_email")]
    public string? CompanyEmail { get; set; }
    [Column("company_phone")]
    public string? CompanyPhone { get; set; }
    [Column("company_country")]
    public string? CompanyCountry { get; set; }
    [Column("company_registration_number")]
    public string? CompanyRegistrationNumber { get; set; }
    [Column("candidate_name")]
    public string? CandidateName { get; set; }
    [Column("candidate_address")]
    public string? CandidateAddress { get; set; }
    [Column("candidate_nationality")]
    public string? CandidateNationality { get; set; }
    [Column("candidate_date_of_birth")]
    public string? CandidateDateOfBirth { get; set; }
    [Column("candidate_passport_number")]
    public string? CandidatePassportNumber { get; set; }
    [Column("candidate_emergency_contact")]
    public string? CandidateEmergencyContact { get; set; }
    [Column("job_title")]
    public string? JobTitle { get; set; }
    [Column("work_type")]
    public string? WorkType { get; set; }
    [Column("basic_salary")]
    public string? BasicSalary { get; set; }
    [Column("salary_payment_date")]
    public string? SalaryPaymentDate { get; set; }
    [Column("work_site")]
    public string? WorkSite { get; set; }
    [Column("date_of_commence")]
    public string? DateOfCommence { get; set; }
    [Column("job_description")]
    public string? JobDescription { get; set; }
    [Column("working_hours")]
    public string? WorkingHours { get; set; }
    [Column("work_status")]
    public string? WorkStatus { get; set; }
    [Column("contract_duration")]
    public string? ContractDuration { get; set; }
    [Column("signatory_name")]
    public string? SignatoryName { get; set; }
    [Column("signatory_designation")]
    public string? SignatoryDesignation { get; set; }
    [Column("signature_date")]
    public string? SignatureDate { get; set; }
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
