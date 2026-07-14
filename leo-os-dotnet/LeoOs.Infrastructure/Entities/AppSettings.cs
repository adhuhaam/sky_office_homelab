using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("app_settings")]
public class AppSettings
{
    [Key]
    [Column("id")]
    public int Id { get; set; } = 1;
    [Column("app_name")]
    public string AppName { get; set; } = "LEO OS";
    [Column("accent_hue")]
    public int AccentHue { get; set; } = 162;
    [Column("company_name")]
    public string? CompanyName { get; set; }
    [Column("company_address")]
    public string? CompanyAddress { get; set; }
    [Column("company_phone")]
    public string? CompanyPhone { get; set; }
    [Column("company_email")]
    public string? CompanyEmail { get; set; }
    [Column("company_website")]
    public string? CompanyWebsite { get; set; }
    [Column("company_registration_number")]
    public string? CompanyRegistrationNumber { get; set; }
    [Column("logo_image")]
    public string? LogoImage { get; set; }
    [Column("logo_image_dark")]
    public string? LogoImageDark { get; set; }
    [Column("deepseek_api_key")]
    public string? DeepseekApiKey { get; set; }
    [Column("deepseek_ocr_base_url")]
    public string? DeepseekOcrBaseUrl { get; set; }
    [Column("deepseek_ocr_model")]
    public string? DeepseekOcrModel { get; set; }
    [Column("password_hash")]
    public string? PasswordHash { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
