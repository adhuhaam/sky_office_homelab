using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("session")]
public class SessionRow
{
    [Key]
    [Column("sid")]
    public string Sid { get; set; } = "";
    [Column("sess", TypeName = "json")]
    public string Sess { get; set; } = "{}";
    [Column("expire")]
    public DateTime Expire { get; set; }
}
