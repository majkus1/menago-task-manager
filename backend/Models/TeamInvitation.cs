using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class TeamInvitation
{
    public Guid Id { get; set; }
    
    [Required]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;
    
    [Required]
    public string InvitedByUserId { get; set; } = string.Empty;
    public User InvitedBy { get; set; } = null!;
    
    [Required]
    public string Token { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
    public bool IsAccepted { get; set; } = false;
    public DateTime? AcceptedAt { get; set; }
    
    public bool IsExpired => DateTime.UtcNow > ExpiresAt;
    public bool IsValid => !IsExpired && !IsAccepted;
}
