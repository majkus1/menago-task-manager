using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.Models;

public class CardAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string FilePath { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public Guid CardId { get; set; }
    public virtual Card Card { get; set; } = null!;

    [Required]
    public string UploadedById { get; set; } = string.Empty;
    public virtual User UploadedBy { get; set; } = null!;
}
