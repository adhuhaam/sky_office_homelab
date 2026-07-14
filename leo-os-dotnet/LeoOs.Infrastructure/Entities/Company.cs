using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("companies")]
public class Company
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    [Column("name")]
    public string Name { get; set; } = "";
    [Column("address")]
    public string? Address { get; set; }
    [Column("email")]
    public string? Email { get; set; }
    [Column("phone")]
    public string? Phone { get; set; }
    [Column("country")]
    public string? Country { get; set; }
    [Column("registration_number")]
    public string? RegistrationNumber { get; set; }
    [Column("signatory_name")]
    public string? SignatoryName { get; set; }
    [Column("signatory_designation")]
    public string? SignatoryDesignation { get; set; }
    [Column("letterhead_image")]
    public string? LetterheadImage { get; set; }
    [Column("signature_image")]
    public string? SignatureImage { get; set; }
    [Column("invoice_logo_image")]
    public string? InvoiceLogoImage { get; set; }
    [Column("bank_name")]
    public string? BankName { get; set; }
    [Column("bank_account_number")]
    public string? BankAccountNumber { get; set; }
    [Column("bank_account_holder")]
    public string? BankAccountHolder { get; set; }
    [Column("bank_swift_code")]
    public string? BankSwiftCode { get; set; }
    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
