using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class Card
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(5000)]
    public string? Description { get; set; }

    public int Position { get; set; } = 0;
    public CardPriority Priority { get; set; } = CardPriority.Medium;
    public DateTime? DueDate { get; set; }
    public bool IsArchived { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public Guid ListId { get; set; }
    public virtual List List { get; set; } = null!;

    [Required]
    public string CreatedById { get; set; } = string.Empty;
    public virtual User CreatedBy { get; set; } = null!;

    public string? AssignedToId { get; set; }
    public virtual User? AssignedTo { get; set; }

    public virtual ICollection<CardLabel> CardLabels { get; set; } = new List<CardLabel>();
    public virtual ICollection<CardComment> Comments { get; set; } = new List<CardComment>();
    public virtual ICollection<CardAttachment> Attachments { get; set; } = new List<CardAttachment>();
}

public enum CardPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
}
