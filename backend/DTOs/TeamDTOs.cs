using System.ComponentModel.DataAnnotations;
using MENAGO_TASK.API.Models;

namespace MENAGO_TASK.API.DTOs;

public class CreateTeamDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }
}

public class UpdateTeamDto
{
    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }
}

public class TeamDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public UserDto Owner { get; set; } = null!;
    public List<TeamMemberDto> Members { get; set; } = new();
    public List<BoardDto> Boards { get; set; } = new();
}

public class TeamMemberDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public Guid TeamId { get; set; }
    public TeamRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsActive { get; set; }
    public UserDto User { get; set; } = null!;
}

public class BoardMemberDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public Guid BoardId { get; set; }
    public BoardRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsActive { get; set; }
    public UserDto User { get; set; } = null!;
}

public class UpdateTeamMemberRoleDto
{
    [Required]
    public Guid TeamMemberId { get; set; }

    [Required]
    public TeamRole Role { get; set; }
}

public class InviteUserToTeamDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public Guid TeamId { get; set; }
    
    public string? Language { get; set; }
}

public class AcceptInvitationDto
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;
}

public class TeamInvitationDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public Guid TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string InvitedByUserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsAccepted { get; set; }
    public bool IsExpired { get; set; }
}

public class AddBoardMemberDto
{
    [Required]
    public Guid BoardId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public BoardRole Role { get; set; } = BoardRole.Member;
}

public class RemoveBoardMemberDto
{
    [Required]
    public Guid BoardId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;
}

