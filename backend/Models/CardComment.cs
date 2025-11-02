using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class CardComment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public Guid CardId { get; set; }
    public virtual Card Card { get; set; } = null!;

    [Required]
    public string UserId { get; set; } = string.Empty;
    public virtual User User { get; set; } = null!;
}
