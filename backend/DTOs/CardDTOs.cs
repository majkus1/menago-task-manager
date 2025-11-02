using System.ComponentModel.DataAnnotations;
using MENAGO_TASK.API.Models;

namespace MENAGO_TASK.API.DTOs;

public class CreateCardDto
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(5000)]
    public string? Description { get; set; }

    [Required]
    public Guid ListId { get; set; }

    public int Position { get; set; } = 0;
    public CardPriority Priority { get; set; } = CardPriority.Medium;
    public DateTime? DueDate { get; set; }
    public string? AssignedToId { get; set; }
}

public class UpdateCardDto
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(5000)]
    public string? Description { get; set; }

    public int? Position { get; set; }
    public CardPriority? Priority { get; set; }
    public DateTime? DueDate { get; set; }
    public string? AssignedToId { get; set; }
    public bool? IsArchived { get; set; }
}

public class MoveCardDto
{
    [Required]
    public Guid CardId { get; set; }

    [Required]
    public Guid TargetListId { get; set; }

    public int Position { get; set; } = 0;
}

public class CardDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Position { get; set; }
    public CardPriority Priority { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid ListId { get; set; }
    public UserDto CreatedBy { get; set; } = null!;
    public UserDto? AssignedTo { get; set; }
    public List<LabelDto> Labels { get; set; } = new();
    public List<CardCommentDto> Comments { get; set; } = new();
    public List<CardAttachmentDto> Attachments { get; set; } = new();
}

public class CreateCommentDto
{
    [Required]
    [MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    [Required]
    public Guid CardId { get; set; }
}

public class UpdateCommentDto
{
    [MaxLength(2000)]
    public string? Content { get; set; }
}

public class CardCommentDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid CardId { get; set; }
    public UserDto User { get; set; } = null!;
}

public class CreateLabelDto
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(7)]
    public string Color { get; set; } = "#0079bf";

    [Required]
    public Guid BoardId { get; set; }
}

public class UpdateLabelDto
{
    [MaxLength(100)]
    public string? Name { get; set; }

    [MaxLength(7)]
    public string? Color { get; set; }
}

public class LabelDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public Guid BoardId { get; set; }
}

public class CardAttachmentDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
    public Guid CardId { get; set; }
    public UserDto UploadedBy { get; set; } = null!;
}

