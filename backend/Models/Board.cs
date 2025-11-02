using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class Board
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public string Color { get; set; } = "#0079bf";
    public bool IsArchived { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public string OwnerId { get; set; } = string.Empty;
    public virtual User Owner { get; set; } = null!;

    public Guid? TeamId { get; set; }
    public virtual Team? Team { get; set; }

    public virtual ICollection<List> Lists { get; set; } = new List<List>();
    public virtual ICollection<BoardMember> Members { get; set; } = new List<BoardMember>();
}
