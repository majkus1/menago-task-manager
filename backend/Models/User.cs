using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class User : IdentityUser
{
    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;

    public virtual ICollection<TeamMember> TeamMemberships { get; set; } = new List<TeamMember>();
    public virtual ICollection<Board> OwnedBoards { get; set; } = new List<Board>();
    public virtual ICollection<Card> AssignedCards { get; set; } = new List<Card>();
    public virtual ICollection<Card> CreatedCards { get; set; } = new List<Card>();
}
