using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class TeamMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public string UserId { get; set; } = string.Empty;
    public virtual User User { get; set; } = null!;

    [Required]
    public Guid TeamId { get; set; }
    public virtual Team Team { get; set; } = null!;

    public TeamRole Role { get; set; } = TeamRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
}

public enum TeamRole
{
    Member = 0,
    Admin = 1,
    Owner = 2
}
