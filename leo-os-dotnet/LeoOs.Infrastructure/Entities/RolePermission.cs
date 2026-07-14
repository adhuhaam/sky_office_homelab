using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeoOs.Infrastructure.Entities;

[Table("role_permissions")]
public class RolePermission
{
    [Column("role")]
    public string Role { get; set; } = "";
    [Column("module")]
    public string Module { get; set; } = "";
    [Column("can_view")]
    public bool CanView { get; set; } = true;
    [Column("can_edit")]
    public bool CanEdit { get; set; }
    [Column("can_delete")]
    public bool CanDelete { get; set; }
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
