using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class Label
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(7)]
    public string Color { get; set; } = "#0079bf";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public Guid BoardId { get; set; }
    public virtual Board Board { get; set; } = null!;

    public virtual ICollection<CardLabel> CardLabels { get; set; } = new List<CardLabel>();
}
