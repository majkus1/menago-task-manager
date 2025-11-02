using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class BoardMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public string UserId { get; set; } = string.Empty;
    public virtual User User { get; set; } = null!;

    [Required]
    public Guid BoardId { get; set; }
    public virtual Board Board { get; set; } = null!;

    public BoardRole Role { get; set; } = BoardRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
}

public enum BoardRole
{
    Member = 0,
    Admin = 1,
    Owner = 2
}
