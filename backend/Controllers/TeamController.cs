using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using MENAGO_TASK.API.Services;
using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/teams")]
[Authorize]
public class TeamController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthService _authService;
    private readonly IInvitationService _invitationService;
    private readonly IMemoryCache _cache;

    public TeamController(ApplicationDbContext context, IAuthService authService, IInvitationService invitationService, IMemoryCache cache)
    {
        _context = context;
        _authService = authService;
        _invitationService = invitationService;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeamDto>>> GetTeams()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Try to get from cache first
        var cacheKey = $"user_teams_{userId}";
        if (_cache.TryGetValue(cacheKey, out List<TeamDto>? cachedTeams))
        {
            return Ok(cachedTeams);
        }

        // Use AsSplitQuery() for better performance with multiple includes
        var teams = await _context.Teams
            .Where(t => t.OwnerId == userId || t.Members.Any(m => m.UserId == userId))
            .Include(t => t.Owner)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .Include(t => t.Boards)
            .AsSplitQuery() // Split queries to avoid Cartesian explosion
            .OrderByDescending(t => t.UpdatedAt)
            .ToListAsync();

        var teamDtos = teams.Select(MapToTeamDto).ToList();
        
        // Cache for 5 minutes
        _cache.Set(cacheKey, teamDtos, TimeSpan.FromMinutes(5));
        
        return Ok(teamDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TeamDto>> GetTeam(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var team = await _context.Teams
            .Where(t => t.Id == id && (t.OwnerId == userId || t.Members.Any(m => m.UserId == userId)))
            .Include(t => t.Owner)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .Include(t => t.Boards)
            .FirstOrDefaultAsync();

        if (team == null)
        {
            return NotFound();
        }

        return Ok(MapToTeamDto(team));
    }

    [HttpPost]
    public async Task<ActionResult<TeamDto>> CreateTeam(CreateTeamDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var team = new Team
        {
            Name = dto.Name,
            Description = dto.Description,
            OwnerId = userId
        };

        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        // Add the creator as a team member with Owner role
        var teamMember = new TeamMember
        {
            UserId = userId,
            TeamId = team.Id,
            Role = Models.TeamRole.Owner,
            JoinedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.TeamMembers.Add(teamMember);
        await _context.SaveChangesAsync();

        // Load the team with all relations
        var createdTeam = await _context.Teams
            .Include(t => t.Owner)
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .Include(t => t.Boards)
            .FirstOrDefaultAsync(t => t.Id == team.Id);

        if (createdTeam == null)
        {
            return NotFound();
        }

        // Clear cache for the user who created the team
        _cache.Remove($"user_teams_{userId}");

        return Ok(MapToTeamDto(createdTeam));
    }

    [HttpGet("{teamId}/members")]
    public async Task<ActionResult<List<TeamMemberDto>>> GetTeamMembers(Guid teamId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var team = await _context.Teams
            .Include(t => t.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team == null)
        {
            return NotFound();
        }

        // Check if user is a member of the team
        var isMember = team.OwnerId == userId || team.Members.Any(m => m.UserId == userId);
        if (!isMember)
        {
            return Forbid("You are not a member of this team");
        }

        var members = team.Members.Select(m => new TeamMemberDto
        {
            Id = m.Id,
            UserId = m.UserId,
            TeamId = m.TeamId,
            Role = m.Role,
            JoinedAt = m.JoinedAt,
            IsActive = m.IsActive,
            User = new UserDto
            {
                Id = m.User.Id,
                Email = m.User.Email!,
                FirstName = m.User.FirstName,
                LastName = m.User.LastName
            }
        }).ToList();

        return Ok(members);
    }

    [HttpPost("invite-user")]
    public async Task<ActionResult<InvitationResult>> InviteUserToTeam(InviteUserToTeamDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user is team owner or admin
        var teamMember = await _context.TeamMembers
            .Where(tm => tm.TeamId == dto.TeamId && tm.UserId == userId)
            .FirstOrDefaultAsync();

        var team = await _context.Teams
            .Where(t => t.Id == dto.TeamId && t.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (team == null && (teamMember == null || teamMember.Role < TeamRole.Admin))
        {
            return Forbid("Only team owners and admins can invite users");
        }

        try
        {
            var result = await _invitationService.InviteUserToTeamAsync(dto, userId);
            
            // If user is added directly (existing user was added, not new invitation), clear their cache
            if (result.Success && !result.RequiresRegistration)
            {
                // Get user ID from email
                var invitedUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
                if (invitedUser != null)
                {
                    _cache.Remove($"user_teams_{invitedUser.Id}");
                }
                // Also clear cache for current user
                _cache.Remove($"user_teams_{userId}");
            }
            else if (result.Success)
            {
                // New invitation sent - still clear cache for current user in case UI needs refresh
                _cache.Remove($"user_teams_{userId}");
            }
            
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{teamId}/members/{memberUserId}/role")]
    public async Task<ActionResult> UpdateTeamMemberRole(Guid teamId, string memberUserId, UpdateTeamMemberRoleDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user is team owner or admin
        var team = await _context.Teams
            .Where(t => t.Id == teamId)
            .Include(t => t.Members)
            .FirstOrDefaultAsync();

        if (team == null)
        {
            return NotFound("Team not found");
        }

        var isOwner = team.OwnerId == userId;
        var isAdmin = team.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin);

        if (!isOwner && !isAdmin)
        {
            return Forbid("Only team owner or admin can update member roles");
        }

        var teamMember = await _context.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == memberUserId);

        if (teamMember == null)
        {
            return NotFound("Team member not found");
        }

        teamMember.Role = dto.Role;
        await _context.SaveChangesAsync();

        // Clear cache for all team members
        var allTeamMemberIds = team.Members.Select(m => m.UserId).Append(team.OwnerId).Distinct();
        foreach (var memberId in allTeamMemberIds)
        {
            _cache.Remove($"user_teams_{memberId}");
        }

        return Ok(new { message = "Member role updated successfully" });
    }

    [HttpDelete("{teamId}/members/{memberUserId}")]
    public async Task<ActionResult> RemoveTeamMember(Guid teamId, string memberUserId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user is team owner or admin
        var team = await _context.Teams
            .Where(t => t.Id == teamId)
            .Include(t => t.Members)
            .FirstOrDefaultAsync();

        if (team == null)
        {
            return NotFound("Team not found");
        }

        var isOwner = team.OwnerId == userId;
        var isAdmin = team.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin);

        if (!isOwner && !isAdmin)
        {
            return Forbid("Only team owner or admin can remove members");
        }

        // Don't allow removing yourself unless you're an admin removing the owner
        if (memberUserId == userId && !isAdmin)
        {
            return BadRequest("Cannot remove yourself");
        }

        var teamMember = await _context.TeamMembers
            .FirstOrDefaultAsync(tm => tm.TeamId == teamId && tm.UserId == memberUserId);

        if (teamMember == null)
        {
            return NotFound("Team member not found");
        }

        // If removing the owner and current user is admin, transfer ownership
        if (memberUserId == team.OwnerId && isAdmin)
        {
            team.OwnerId = userId;
            await _context.SaveChangesAsync();
        }

        _context.TeamMembers.Remove(teamMember);
        await _context.SaveChangesAsync();

        // Clear cache for all team members (including the removed member)
        var allTeamMemberIds = team.Members.Select(m => m.UserId).Append(team.OwnerId).Append(memberUserId).Distinct();
        foreach (var memberId in allTeamMemberIds)
        {
            _cache.Remove($"user_teams_{memberId}");
        }

        return Ok(new { message = "Member removed successfully" });
    }

    [HttpDelete("{teamId}")]
    public async Task<ActionResult> DeleteTeam(Guid teamId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user is team owner or admin
        var team = await _context.Teams
            .Where(t => t.Id == teamId)
            .Include(t => t.Members)
            .Include(t => t.Boards)
            .FirstOrDefaultAsync();

        if (team == null)
        {
            return NotFound("Team not found");
        }

        var isOwner = team.OwnerId == userId;
        var isAdmin = team.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin);

        if (!isOwner && !isAdmin)
        {
            return Forbid("Only team owner or admin can delete the team");
        }

        // Delete all related data
        // 1. Delete team invitations
        var invitations = await _context.TeamInvitations
            .Where(ti => ti.TeamId == teamId)
            .ToListAsync();
        _context.TeamInvitations.RemoveRange(invitations);

        // 2. Delete team members
        var members = await _context.TeamMembers
            .Where(tm => tm.TeamId == teamId)
            .ToListAsync();
        _context.TeamMembers.RemoveRange(members);

        // 3. Delete boards and their related data
        foreach (var board in team.Boards)
        {
            // Delete board members
            var boardMembers = await _context.BoardMembers
                .Where(bm => bm.BoardId == board.Id)
                .ToListAsync();
            _context.BoardMembers.RemoveRange(boardMembers);

            // Delete lists and their cards
            var lists = await _context.Lists
                .Where(l => l.BoardId == board.Id)
                .Include(l => l.Cards)
                .ToListAsync();

            foreach (var list in lists)
            {
                // Delete card attachments, comments, and labels
                foreach (var card in list.Cards)
                {
                    var attachments = await _context.CardAttachments
                        .Where(ca => ca.CardId == card.Id)
                        .ToListAsync();
                    _context.CardAttachments.RemoveRange(attachments);

                    var comments = await _context.CardComments
                        .Where(cc => cc.CardId == card.Id)
                        .ToListAsync();
                    _context.CardComments.RemoveRange(comments);

                    var cardLabels = await _context.CardLabels
                        .Where(cl => cl.CardId == card.Id)
                        .ToListAsync();
                    _context.CardLabels.RemoveRange(cardLabels);
                }

                _context.Cards.RemoveRange(lists.SelectMany(l => l.Cards));
            }

            _context.Lists.RemoveRange(lists);

            // Delete labels
            var labels = await _context.Labels
                .Where(l => l.BoardId == board.Id)
                .ToListAsync();
            _context.Labels.RemoveRange(labels);
        }

        // 4. Delete the team itself
        _context.Teams.Remove(team);

        await _context.SaveChangesAsync();

        // Clear cache for all team members
        var allTeamMemberIds = team.Members.Select(m => m.UserId).Append(team.OwnerId).Distinct();
        foreach (var memberId in allTeamMemberIds)
        {
            _cache.Remove($"user_teams_{memberId}");
            // Also clear boards cache since deleting a team affects boards
            _cache.Remove($"user_boards_{memberId}");
        }

        return Ok(new { message = "Team deleted successfully" });
    }

    private static TeamDto MapToTeamDto(Team team)
    {
        return new TeamDto
        {
            Id = team.Id,
            Name = team.Name,
            Description = team.Description,
            CreatedAt = team.CreatedAt,
            UpdatedAt = team.UpdatedAt,
            Owner = new UserDto
            {
                Id = team.Owner.Id,
                FirstName = team.Owner.FirstName,
                LastName = team.Owner.LastName,
                Email = team.Owner.Email!,
                CreatedAt = team.Owner.CreatedAt,
                LastLoginAt = team.Owner.LastLoginAt,
                IsActive = team.Owner.IsActive
            },
            Members = team.Members.Select(m => new TeamMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                TeamId = m.TeamId,
                Role = m.Role,
                JoinedAt = m.JoinedAt,
                IsActive = m.IsActive,
                User = new UserDto
                {
                    Id = m.User.Id,
                    FirstName = m.User.FirstName,
                    LastName = m.User.LastName,
                    Email = m.User.Email!,
                    CreatedAt = m.User.CreatedAt,
                    LastLoginAt = m.User.LastLoginAt,
                    IsActive = m.User.IsActive
                }
            }).ToList(),
            Boards = team.Boards.Select(b => new BoardDto
            {
                Id = b.Id,
                Title = b.Title,
                Description = b.Description,
                Color = b.Color,
                IsArchived = b.IsArchived,
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt,
                Owner = new UserDto
                {
                    Id = b.Owner.Id,
                    FirstName = b.Owner.FirstName,
                    LastName = b.Owner.LastName,
                    Email = b.Owner.Email!,
                    CreatedAt = b.Owner.CreatedAt,
                    LastLoginAt = b.Owner.LastLoginAt,
                    IsActive = b.Owner.IsActive
                },
                Lists = new List<ListDto>(),
                Members = new List<BoardMemberDto>()
            }).ToList()
        };
    }
}
