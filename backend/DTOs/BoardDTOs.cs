using System.ComponentModel.DataAnnotations;

namespace MENAGO_TASK.API.DTOs;

public class CreateBoardDto
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(7)]
    public string Color { get; set; } = "#0079bf";

    public Guid? TeamId { get; set; }
    
    public List<string>? MemberUserIds { get; set; }
    
    public bool AddAllTeamMembers { get; set; } = false;
}

public class UpdateBoardDto
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(7)]
    public string? Color { get; set; }

    public bool? IsArchived { get; set; }
}

public class BoardDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = string.Empty;
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public UserDto Owner { get; set; } = null!;
    public TeamDto? Team { get; set; }
    public List<ListDto> Lists { get; set; } = new();
    public List<BoardMemberDto> Members { get; set; } = new();
}

public class CreateListDto
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public Guid BoardId { get; set; }

    public int Position { get; set; } = 0;
}

public class UpdateListDto
{
    [MaxLength(200)]
    public string? Title { get; set; }

    public int? Position { get; set; }

    public bool? IsArchived { get; set; }
}

public class ListDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Position { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid BoardId { get; set; }
    public List<CardDto> Cards { get; set; } = new();
}
