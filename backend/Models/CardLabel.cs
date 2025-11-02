using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class CardLabel
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CardId { get; set; }
    public virtual Card Card { get; set; } = null!;

    [Required]
    public Guid LabelId { get; set; }
    public virtual Label Label { get; set; } = null!;

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
