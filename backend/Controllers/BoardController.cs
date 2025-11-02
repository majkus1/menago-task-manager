using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Claims;
using Microsoft.Extensions.Caching.Memory;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/boards")]
[Authorize]
public class BoardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMemoryCache _cache;

    public BoardController(ApplicationDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<List<BoardDto>>> GetBoards()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Try to get from cache first
        var cacheKey = $"user_boards_{userId}";
        if (_cache.TryGetValue(cacheKey, out List<BoardDto>? cachedBoards))
        {
            return Ok(cachedBoards);
        }

        // Get user's team memberships
        var userTeamIds = await _context.TeamMembers
            .Where(tm => tm.UserId == userId && tm.IsActive)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        // Get boards where user is a member (either through BoardMembers or as team admin/owner)
        // For list view, we don't need lists and cards - only basic board info
        var boards = await _context.Boards
            .Where(b => b.Members.Any(m => m.UserId == userId) &&
                       (b.TeamId == null || userTeamIds.Contains(b.TeamId.Value)))
            .Include(b => b.Owner)
            .Include(b => b.Team)
                .ThenInclude(t => t.Owner)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .AsNoTracking() // Read-only query, much faster!
            .AsSplitQuery() // Split queries for better performance
            .OrderByDescending(b => b.UpdatedAt)
            .ToListAsync();

        // Use lightweight mapping for board list (no lists/cards) - MUCH FASTER!
        var boardDtos = boards.Select(MapToBoardListDto).ToList();
        
        // Cache for 5 minutes
        _cache.Set(cacheKey, boardDtos, TimeSpan.FromMinutes(5));
        
        return Ok(boardDtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BoardDto>> GetBoard(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Get user's team memberships first (lightweight query)
        var userTeamIds = await _context.TeamMembers
            .Where(tm => tm.UserId == userId && tm.IsActive)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        // Get board with all related data in one query
        // Use AsNoTracking() since we're only reading data (faster)
        var board = await _context.Boards
            .Where(b => b.Id == id && 
                       b.Members.Any(m => m.UserId == userId) &&
                       (b.TeamId == null || userTeamIds.Contains(b.TeamId.Value)))
            .Include(b => b.Owner)
            .Include(b => b.Team)
                .ThenInclude(t => t.Owner)
            .Include(b => b.Team)
                .ThenInclude(t => t.Members)
                    .ThenInclude(m => m.User)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .Include(b => b.Lists)
                .ThenInclude(l => l.Cards)
                    .ThenInclude(c => c.CreatedBy)
            .Include(b => b.Lists)
                .ThenInclude(l => l.Cards)
                    .ThenInclude(c => c.AssignedTo)
            .Include(b => b.Lists)
                .ThenInclude(l => l.Cards)
                    .ThenInclude(c => c.CardLabels)
                        .ThenInclude(cl => cl.Label)
            .Include(b => b.Lists)
                .ThenInclude(l => l.Cards)
                    .ThenInclude(c => c.Comments)
                        .ThenInclude(cc => cc.User)
            .Include(b => b.Lists)
                .ThenInclude(l => l.Cards)
                    .ThenInclude(c => c.Attachments)
                        .ThenInclude(ca => ca.UploadedBy)
            .AsNoTracking() // Read-only query - much faster!
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        return Ok(MapToBoardDto(board));
    }

    [HttpGet("{id}/cards/{cardId}")]
    public async Task<ActionResult<CardDto>> GetCardDetails(Guid id, Guid cardId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var card = await _context.Cards
            .Include(c => c.List)
                .ThenInclude(l => l.Board)
            .Include(c => c.CreatedBy)
            .Include(c => c.AssignedTo)
            .Include(c => c.CardLabels)
                .ThenInclude(cl => cl.Label)
            .Include(c => c.Comments)
                .ThenInclude(cc => cc.User)
            .Include(c => c.Attachments)
            .Where(c => c.Id == cardId && 
                       c.List.BoardId == id &&
                       c.List.Board.Members.Any(m => m.UserId == userId))
            .FirstOrDefaultAsync();

        if (card == null)
        {
            return NotFound();
        }

        return Ok(MapToCardDto(card));
    }

    [HttpPost]
    public async Task<ActionResult<BoardDto>> CreateBoard(CreateBoardDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var board = new Board
        {
            Title = dto.Title,
            Description = dto.Description,
            Color = dto.Color,
            OwnerId = userId,
            TeamId = dto.TeamId
        };

        _context.Boards.Add(board);
        await _context.SaveChangesAsync();

        // Add board members
        var membersToAdd = new List<BoardMember>();

        // Always add the board owner as a member with Owner role
        membersToAdd.Add(new BoardMember
        {
            BoardId = board.Id,
            UserId = userId,
            Role = BoardRole.Owner,
            JoinedAt = DateTime.UtcNow
        });

        if (dto.AddAllTeamMembers && dto.TeamId.HasValue)
        {
            // Add all team members to the board
            var teamMembers = await _context.TeamMembers
                .Where(tm => tm.TeamId == dto.TeamId.Value && tm.IsActive)
                .Include(tm => tm.User)
                .ToListAsync();

            foreach (var teamMember in teamMembers)
            {
                if (teamMember.UserId != userId) // Don't add owner twice
                {
                    membersToAdd.Add(new BoardMember
                    {
                        BoardId = board.Id,
                        UserId = teamMember.UserId,
                        Role = BoardRole.Member,
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }
        }
        else if (dto.MemberUserIds != null && dto.MemberUserIds.Any())
        {
            // Add specific members
            foreach (var memberUserId in dto.MemberUserIds)
            {
                if (memberUserId != userId) // Don't add owner twice
                {
                    membersToAdd.Add(new BoardMember
                    {
                        BoardId = board.Id,
                        UserId = memberUserId,
                        Role = BoardRole.Member,
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }
        }

        // Always add members (at least the owner)
        _context.BoardMembers.AddRange(membersToAdd);
        await _context.SaveChangesAsync();

        var createdBoard = await _context.Boards
            .Include(b => b.Owner)
            .Include(b => b.Team)
            .Include(b => b.Lists)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstAsync(b => b.Id == board.Id);

        // Invalidate cache for all affected users
        var userIdsToInvalidate = new HashSet<string>();
        // Add the board owner (current user)
        if (!string.IsNullOrEmpty(userId))
        {
            userIdsToInvalidate.Add(userId);
        }
        
        // If board has a team, invalidate cache for all team members
        if (board.TeamId.HasValue)
        {
            var teamMemberIds = await _context.TeamMembers
                .Where(tm => tm.TeamId == board.TeamId.Value && tm.IsActive)
                .Select(tm => tm.UserId)
                .ToListAsync();
            foreach (var memberId in teamMemberIds)
            {
                userIdsToInvalidate.Add(memberId);
            }
        }
        
        // Also invalidate for all board members
        foreach (var member in membersToAdd)
        {
            userIdsToInvalidate.Add(member.UserId);
        }
        
        foreach (var userIdToInvalidate in userIdsToInvalidate)
        {
            _cache.Remove($"user_boards_{userIdToInvalidate}");
        }

        return Ok(MapToBoardDto(createdBoard));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<BoardDto>> UpdateBoard(Guid id, UpdateBoardDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var board = await _context.Boards
            .Where(b => b.Id == id && b.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.Title))
            board.Title = dto.Title;
        
        if (dto.Description != null)
            board.Description = dto.Description;
        
        if (!string.IsNullOrEmpty(dto.Color))
            board.Color = dto.Color;
        
        if (dto.IsArchived.HasValue)
            board.IsArchived = dto.IsArchived.Value;

        board.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedBoard = await _context.Boards
            .Include(b => b.Owner)
            .Include(b => b.Team)
            .Include(b => b.Lists)
            .Include(b => b.Members)
                .ThenInclude(m => m.User)
            .FirstAsync(b => b.Id == board.Id);

        return Ok(MapToBoardDto(updatedBoard));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBoard(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var board = await _context.Boards
            .Include(b => b.Team)
                .ThenInclude(t => t.Members)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (board == null)
        {
            return NotFound();
        }

        // Check if user is board owner or team admin/owner
        var isBoardOwner = board.OwnerId == userId;
        var isTeamOwner = board.Team?.OwnerId == userId;
        var isTeamAdmin = board.Team?.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin) == true;

        if (!isBoardOwner && !isTeamOwner && !isTeamAdmin)
        {
            return Forbid("Only board owner or team admin/owner can delete the board");
        }

        // Get all users who might have this board cached
        // (board members, team members if board has a team, and board owner)
        var userIdsToInvalidate = new HashSet<string> { board.OwnerId };
        
        // Add all board members
        var boardMemberIds = await _context.BoardMembers
            .Where(bm => bm.BoardId == id)
            .Select(bm => bm.UserId)
            .ToListAsync();
        foreach (var memberId in boardMemberIds)
        {
            userIdsToInvalidate.Add(memberId);
        }
        
        // If board has a team, add all team members
        if (board.TeamId.HasValue)
        {
            var teamMemberIds = await _context.TeamMembers
                .Where(tm => tm.TeamId == board.TeamId.Value && tm.IsActive)
                .Select(tm => tm.UserId)
                .ToListAsync();
            foreach (var memberId in teamMemberIds)
            {
                userIdsToInvalidate.Add(memberId);
            }
        }

        _context.Boards.Remove(board);
        await _context.SaveChangesAsync();

        // Clear cache for all affected users
        foreach (var userIdToInvalidate in userIdsToInvalidate)
        {
            var cacheKey = $"user_boards_{userIdToInvalidate}";
            _cache.Remove(cacheKey);
        }

        return NoContent();
    }

    [HttpPost("{boardId}/members")]
    public async Task<ActionResult> AddBoardMember(Guid boardId, [FromBody] AddBoardMemberRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has permission to add members (board owner or team admin/owner)
        var board = await _context.Boards
            .Include(b => b.Team)
                .ThenInclude(t => t.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId);

        if (board == null)
        {
            return NotFound("Board not found");
        }

        var isBoardOwner = board.OwnerId == userId;
        var isTeamOwner = board.Team?.OwnerId == userId;
        var isTeamAdmin = board.Team?.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin) == true;

        if (!isBoardOwner && !isTeamOwner && !isTeamAdmin)
        {
            return Forbid("Only board owner or team admin/owner can add members");
        }

        // Check if user is already a member
        var existingMember = await _context.BoardMembers
            .FirstOrDefaultAsync(bm => bm.BoardId == boardId && bm.UserId == request.UserId);

        if (existingMember != null)
        {
            return BadRequest("User is already a member of this board");
        }

        var boardMember = new BoardMember
        {
            BoardId = boardId,
            UserId = request.UserId,
            Role = BoardRole.Member,
            JoinedAt = DateTime.UtcNow
        };

        _context.BoardMembers.Add(boardMember);
        await _context.SaveChangesAsync();

        // Invalidate cache for the added member so they see the board in their list
        _cache.Remove($"user_boards_{request.UserId}");
        
        // Also invalidate cache for the current user and board
        _cache.Remove($"user_boards_{userId}");
        _cache.Remove($"board_{boardId}");

        return Ok(new { message = "Member added successfully" });
    }

    [HttpDelete("{boardId}/members/{memberUserId}")]
    public async Task<ActionResult> RemoveBoardMember(Guid boardId, string memberUserId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has permission to remove members (board owner or team admin/owner)
        var board = await _context.Boards
            .Include(b => b.Team)
                .ThenInclude(t => t.Members)
            .FirstOrDefaultAsync(b => b.Id == boardId);

        if (board == null)
        {
            return NotFound("Board not found");
        }

        var isBoardOwner = board.OwnerId == userId;
        var isTeamOwner = board.Team?.OwnerId == userId;
        var isTeamAdmin = board.Team?.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin) == true;

        if (!isBoardOwner && !isTeamOwner && !isTeamAdmin)
        {
            return Forbid("Only board owner or team admin/owner can remove members");
        }

        // Don't allow removing yourself unless you're a team admin
        if (memberUserId == userId && !isTeamAdmin)
        {
            return BadRequest("Cannot remove yourself");
        }

        // Allow team admin to remove board owner from members (but board still exists)
        var boardMember = await _context.BoardMembers
            .FirstOrDefaultAsync(bm => bm.BoardId == boardId && bm.UserId == memberUserId);

        if (boardMember == null)
        {
            return NotFound("Member not found");
        }

        _context.BoardMembers.Remove(boardMember);
        await _context.SaveChangesAsync();

        // Invalidate cache for the removed member so they don't see the board anymore
        _cache.Remove($"user_boards_{memberUserId}");
        
        // Also invalidate cache for the current user and board
        _cache.Remove($"user_boards_{userId}");
        _cache.Remove($"board_{boardId}");

        return Ok(new { message = "Member removed successfully" });
    }

    [HttpGet("{boardId}/members")]
    public async Task<ActionResult<List<BoardMemberDto>>> GetBoardMembers(Guid boardId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the board
        var board = await _context.Boards
            .Where(b => b.Id == boardId && (b.OwnerId == userId || b.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound("Board not found or access denied");
        }

        var boardMembers = await _context.BoardMembers
            .Where(bm => bm.BoardId == boardId)
            .Include(bm => bm.User)
            .Select(bm => new BoardMemberDto
            {
                Id = bm.Id,
                UserId = bm.UserId,
                BoardId = bm.BoardId,
                Role = bm.Role,
                JoinedAt = bm.JoinedAt,
                IsActive = true,
                User = new UserDto
                {
                    Id = bm.User.Id,
                    FirstName = bm.User.FirstName,
                    LastName = bm.User.LastName,
                    Email = bm.User.Email!,
                    CreatedAt = bm.User.CreatedAt,
                    LastLoginAt = bm.User.LastLoginAt,
                    IsActive = bm.User.IsActive
                }
            })
            .ToListAsync();

        return Ok(boardMembers);
    }

    [HttpPost("fix-existing-boards")]
    public async Task<ActionResult> FixExistingBoards()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Get all boards that don't have their owner as a member
        var boardsWithoutOwnerAsMember = await _context.Boards
            .Where(b => !_context.BoardMembers.Any(bm => bm.BoardId == b.Id && bm.UserId == b.OwnerId))
            .ToListAsync();

        var fixedCount = 0;
        foreach (var board in boardsWithoutOwnerAsMember)
        {
            // Add owner as a member with Owner role
            var boardMember = new BoardMember
            {
                BoardId = board.Id,
                UserId = board.OwnerId,
                Role = BoardRole.Owner,
                JoinedAt = board.CreatedAt
            };

            _context.BoardMembers.Add(boardMember);
            fixedCount++;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Fixed {fixedCount} boards", fixedCount });
    }

    [HttpGet("{boardId}/team-members")]
    public async Task<ActionResult<List<TeamMemberDto>>> GetTeamMembersForBoard(Guid boardId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the board
        var board = await _context.Boards
            .Where(b => b.Id == boardId && (b.OwnerId == userId || b.Members.Any(m => m.UserId == userId)))
            .Include(b => b.Team)
            .FirstOrDefaultAsync();

        if (board == null || board.Team == null)
        {
            return NotFound("Board not found or no team associated");
        }

        var teamMembers = await _context.TeamMembers
            .Where(tm => tm.TeamId == board.Team.Id && tm.IsActive)
            .Include(tm => tm.User)
            .ToListAsync();

        var teamMemberDtos = teamMembers.Select(tm => new TeamMemberDto
        {
            Id = tm.Id,
            UserId = tm.UserId,
            TeamId = tm.TeamId,
            Role = tm.Role,
            JoinedAt = tm.JoinedAt,
            IsActive = tm.IsActive,
            User = new UserDto
            {
                Id = tm.User.Id,
                FirstName = tm.User.FirstName,
                LastName = tm.User.LastName,
                Email = tm.User.Email!,
                CreatedAt = tm.User.CreatedAt,
                LastLoginAt = tm.User.LastLoginAt,
                IsActive = tm.User.IsActive
            }
        }).ToList();

        return Ok(teamMemberDtos);
    }

    // Lightweight mapping for board list - no lists/cards (MUCH FASTER!)
    private static BoardDto MapToBoardListDto(Board board)
    {
        return new BoardDto
        {
            Id = board.Id,
            Title = board.Title,
            Description = board.Description,
            Color = board.Color,
            IsArchived = board.IsArchived,
            CreatedAt = board.CreatedAt,
            UpdatedAt = board.UpdatedAt,
            Owner = new UserDto
            {
                Id = board.Owner.Id,
                FirstName = board.Owner.FirstName,
                LastName = board.Owner.LastName,
                Email = board.Owner.Email!,
                CreatedAt = board.Owner.CreatedAt,
                LastLoginAt = board.Owner.LastLoginAt,
                IsActive = board.Owner.IsActive
            },
            Team = board.Team != null && board.Team.Owner != null ? new TeamDto
            {
                Id = board.Team.Id,
                Name = board.Team.Name,
                Description = board.Team.Description,
                CreatedAt = board.Team.CreatedAt,
                UpdatedAt = board.Team.UpdatedAt,
                Owner = new UserDto
                {
                    Id = board.Team.Owner.Id,
                    FirstName = board.Team.Owner.FirstName,
                    LastName = board.Team.Owner.LastName,
                    Email = board.Team.Owner.Email!,
                    CreatedAt = board.Team.Owner.CreatedAt,
                    LastLoginAt = board.Team.Owner.LastLoginAt,
                    IsActive = board.Team.Owner.IsActive
                }
            } : null,
            Members = board.Members.Select(m => new BoardMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                BoardId = m.BoardId,
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
            Lists = new List<ListDto>() // Empty lists for list view
        };
    }

    private static BoardDto MapToBoardDto(Board board)
    {
        return new BoardDto
        {
            Id = board.Id,
            Title = board.Title,
            Description = board.Description,
            Color = board.Color,
            IsArchived = board.IsArchived,
            CreatedAt = board.CreatedAt,
            UpdatedAt = board.UpdatedAt,
            Owner = new UserDto
            {
                Id = board.Owner.Id,
                FirstName = board.Owner.FirstName,
                LastName = board.Owner.LastName,
                Email = board.Owner.Email!,
                CreatedAt = board.Owner.CreatedAt,
                LastLoginAt = board.Owner.LastLoginAt,
                IsActive = board.Owner.IsActive
            },
            Team = board.Team != null && board.Team.Owner != null ? new TeamDto
            {
                Id = board.Team.Id,
                Name = board.Team.Name,
                Description = board.Team.Description,
                CreatedAt = board.Team.CreatedAt,
                UpdatedAt = board.Team.UpdatedAt,
                Owner = new UserDto
                {
                    Id = board.Team.Owner.Id,
                    FirstName = board.Team.Owner.FirstName,
                    LastName = board.Team.Owner.LastName,
                    Email = board.Team.Owner.Email!,
                    CreatedAt = board.Team.Owner.CreatedAt,
                    LastLoginAt = board.Team.Owner.LastLoginAt,
                    IsActive = board.Team.Owner.IsActive
                },
                Members = board.Team.Members.Select(m => new TeamMemberDto
                {
                    Id = m.Id,
                    UserId = m.UserId,
                    TeamId = m.TeamId,
                    Role = m.Role,
                    JoinedAt = m.JoinedAt,
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
                }).ToList()
            } : null,
            Lists = (board.Lists ?? new List<Models.List>()).OrderBy(l => l.Position).Select(l => new ListDto
            {
                Id = l.Id,
                Title = l.Title,
                Position = l.Position,
                IsArchived = l.IsArchived,
                CreatedAt = l.CreatedAt,
                UpdatedAt = l.UpdatedAt,
                BoardId = l.BoardId,
                Cards = (l.Cards ?? new List<Card>()).OrderBy(c => c.Position).Select(c => new CardDto
                {
                    Id = c.Id,
                    Title = c.Title,
                    Description = c.Description,
                    Position = c.Position,
                    Priority = c.Priority,
                    DueDate = c.DueDate,
                    IsArchived = c.IsArchived,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    ListId = c.ListId,
                    CreatedBy = new UserDto
                    {
                        Id = c.CreatedBy.Id,
                        FirstName = c.CreatedBy.FirstName,
                        LastName = c.CreatedBy.LastName,
                        Email = c.CreatedBy.Email!,
                        CreatedAt = c.CreatedBy.CreatedAt,
                        LastLoginAt = c.CreatedBy.LastLoginAt,
                        IsActive = c.CreatedBy.IsActive
                    },
                    AssignedTo = c.AssignedTo != null ? new UserDto
                    {
                        Id = c.AssignedTo.Id,
                        FirstName = c.AssignedTo.FirstName,
                        LastName = c.AssignedTo.LastName,
                        Email = c.AssignedTo.Email!,
                        CreatedAt = c.AssignedTo.CreatedAt,
                        LastLoginAt = c.AssignedTo.LastLoginAt,
                        IsActive = c.AssignedTo.IsActive
                    } : null,
                    Labels = (c.CardLabels ?? new List<CardLabel>())
                        .Where(cl => cl.Label != null)
                        .Select(cl => new LabelDto
                        {
                            Id = cl.Label!.Id,
                            Name = cl.Label!.Name,
                            Color = cl.Label!.Color,
                            CreatedAt = cl.Label!.CreatedAt,
                            BoardId = cl.Label!.BoardId
                        }).ToList(),
                    Comments = (c.Comments ?? new List<CardComment>()).OrderByDescending(cc => cc.CreatedAt).Select(cc => new CardCommentDto
                    {
                        Id = cc.Id,
                        Content = cc.Content,
                        CreatedAt = cc.CreatedAt,
                        UpdatedAt = cc.UpdatedAt,
                        CardId = cc.CardId,
                        User = new UserDto
                        {
                            Id = cc.User.Id,
                            FirstName = cc.User.FirstName,
                            LastName = cc.User.LastName,
                            Email = cc.User.Email!,
                            CreatedAt = cc.User.CreatedAt,
                            LastLoginAt = cc.User.LastLoginAt,
                            IsActive = cc.User.IsActive
                        }
                    }).ToList(),
                    Attachments = (c.Attachments ?? new List<CardAttachment>()).Select(ca => new CardAttachmentDto
                    {
                        Id = ca.Id,
                        FileName = ca.FileName,
                        FilePath = ca.FilePath,
                        ContentType = ca.ContentType,
                        FileSize = ca.FileSize,
                        UploadedAt = ca.UploadedAt,
                        CardId = ca.CardId,
                        UploadedBy = new UserDto
                        {
                            Id = ca.UploadedBy.Id,
                            FirstName = ca.UploadedBy.FirstName,
                            LastName = ca.UploadedBy.LastName,
                            Email = ca.UploadedBy.Email!,
                            CreatedAt = ca.UploadedBy.CreatedAt,
                            LastLoginAt = ca.UploadedBy.LastLoginAt,
                            IsActive = ca.UploadedBy.IsActive
                        }
                    }).ToList()
                }).ToList()
            }).ToList(),
            Members = board.Members.Select(m => new BoardMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                BoardId = m.BoardId,
                Role = m.Role,
                JoinedAt = m.JoinedAt,
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
            }).ToList()
        };
    }

    private static CardDto MapToCardDto(Card card)
    {
        return new CardDto
        {
            Id = card.Id,
            Title = card.Title,
            Description = card.Description,
            Position = card.Position,
            Priority = card.Priority,
            DueDate = card.DueDate,
            IsArchived = card.IsArchived,
            CreatedAt = card.CreatedAt,
            UpdatedAt = card.UpdatedAt,
            ListId = card.ListId,
            CreatedBy = new UserDto
            {
                Id = card.CreatedBy.Id,
                FirstName = card.CreatedBy.FirstName,
                LastName = card.CreatedBy.LastName,
                Email = card.CreatedBy.Email!,
                CreatedAt = card.CreatedBy.CreatedAt,
                LastLoginAt = card.CreatedBy.LastLoginAt,
                IsActive = card.CreatedBy.IsActive
            },
            AssignedTo = card.AssignedTo != null ? new UserDto
            {
                Id = card.AssignedTo.Id,
                FirstName = card.AssignedTo.FirstName,
                LastName = card.AssignedTo.LastName,
                Email = card.AssignedTo.Email!,
                CreatedAt = card.AssignedTo.CreatedAt,
                LastLoginAt = card.AssignedTo.LastLoginAt,
                IsActive = card.AssignedTo.IsActive
            } : null,
            Labels = card.CardLabels.Select(cl => new LabelDto
            {
                Id = cl.Label.Id,
                Name = cl.Label.Name,
                Color = cl.Label.Color,
                BoardId = cl.Label.BoardId,
                CreatedAt = cl.Label.CreatedAt
            }).ToList(),
            Comments = card.Comments.Select(cc => new CardCommentDto
            {
                Id = cc.Id,
                Content = cc.Content,
                CreatedAt = cc.CreatedAt,
                UpdatedAt = cc.UpdatedAt,
                User = new UserDto
                {
                    Id = cc.User.Id,
                    FirstName = cc.User.FirstName,
                    LastName = cc.User.LastName,
                    Email = cc.User.Email!,
                    CreatedAt = cc.User.CreatedAt,
                    LastLoginAt = cc.User.LastLoginAt,
                    IsActive = cc.User.IsActive
                }
            }).ToList(),
            Attachments = card.Attachments.Select(ca => new CardAttachmentDto
            {
                Id = ca.Id,
                FileName = ca.FileName,
                FileSize = ca.FileSize,
                ContentType = ca.ContentType,
                UploadedAt = ca.UploadedAt
            }).ToList()
        };
    }
}

public class AddBoardMemberRequest
{
    public string UserId { get; set; } = string.Empty;
}
