using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Claims;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/lists")]
[Authorize]
public class ListController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ListController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<ActionResult<ListDto>> CreateList(CreateListDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the board
        var board = await _context.Boards
            .Where(b => b.Id == dto.BoardId && (b.OwnerId == userId || b.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (board == null)
        {
            return NotFound("Board not found or access denied");
        }

        var list = new List
        {
            Title = dto.Title,
            BoardId = dto.BoardId,
            Position = dto.Position
        };

        _context.Lists.Add(list);
        await _context.SaveChangesAsync();

        var createdList = await _context.Lists
            .Include(l => l.Cards)
                .ThenInclude(c => c.CreatedBy)
            .Include(l => l.Cards)
                .ThenInclude(c => c.AssignedTo)
            .Include(l => l.Cards)
                .ThenInclude(c => c.CardLabels)
                    .ThenInclude(cl => cl.Label)
            .Include(l => l.Cards)
                .ThenInclude(c => c.Comments)
                    .ThenInclude(cc => cc.User)
            .FirstAsync(l => l.Id == list.Id);

        return Ok(MapToListDto(createdList));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ListDto>> UpdateList(Guid id, UpdateListDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var list = await _context.Lists
            .Include(l => l.Board)
            .Where(l => l.Id == id && (l.Board.OwnerId == userId || l.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (list == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.Title))
            list.Title = dto.Title;
        
        if (dto.Position.HasValue)
            list.Position = dto.Position.Value;
        
        if (dto.IsArchived.HasValue)
            list.IsArchived = dto.IsArchived.Value;

        list.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedList = await _context.Lists
            .Include(l => l.Cards)
                .ThenInclude(c => c.CreatedBy)
            .Include(l => l.Cards)
                .ThenInclude(c => c.AssignedTo)
            .Include(l => l.Cards)
                .ThenInclude(c => c.CardLabels)
                    .ThenInclude(cl => cl.Label)
            .Include(l => l.Cards)
                .ThenInclude(c => c.Comments)
                    .ThenInclude(cc => cc.User)
            .FirstAsync(l => l.Id == list.Id);

        return Ok(MapToListDto(updatedList));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteList(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var list = await _context.Lists
            .Include(l => l.Board)
                .ThenInclude(b => b.Team)
                    .ThenInclude(t => t.Members)
            .Where(l => l.Id == id)
            .FirstOrDefaultAsync();

        if (list == null)
        {
            return NotFound();
        }

        // Check if user has access to the board OR is team admin/owner
        var hasAccess = list.Board.OwnerId == userId || list.Board.Members.Any(m => m.UserId == userId);
        var isTeamOwner = list.Board.Team?.OwnerId == userId;
        var isTeamAdmin = list.Board.Team?.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin) == true;
        
        Console.WriteLine($"DeleteList: User {userId}, List {id}, Board {list.Board.Id}");
        Console.WriteLine($"DeleteList: BoardOwner {list.Board.OwnerId}, HasAccess {hasAccess}");
        Console.WriteLine($"DeleteList: BoardMembers count: {list.Board.Members?.Count ?? 0}");
        Console.WriteLine($"DeleteList: IsTeamOwner {isTeamOwner}, IsTeamAdmin {isTeamAdmin}");
        
        if (!hasAccess && !isTeamOwner && !isTeamAdmin)
        {
            Console.WriteLine($"DeleteList: User {userId} has no access to board {list.Board.Id}");
            return Forbid();
        }

        // Check if user is team admin/owner (required for deletion)
        
        if (!isTeamOwner && !isTeamAdmin)
        {
            Console.WriteLine($"DeleteList: User {userId} is not team owner or admin");
            return Forbid("Only team admins and owners can delete lists");
        }

        _context.Lists.Remove(list);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static ListDto MapToListDto(Models.List list)
    {
        return new ListDto
        {
            Id = list.Id,
            Title = list.Title,
            Position = list.Position,
            IsArchived = list.IsArchived,
            CreatedAt = list.CreatedAt,
            UpdatedAt = list.UpdatedAt,
            BoardId = list.BoardId,
            Cards = list.Cards.OrderBy(c => c.Position).Select(c => new CardDto
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
                Labels = c.CardLabels.Select(cl => new LabelDto
                {
                    Id = cl.Label.Id,
                    Name = cl.Label.Name,
                    Color = cl.Label.Color,
                    CreatedAt = cl.Label.CreatedAt,
                    BoardId = cl.Label.BoardId
                }).ToList(),
                Comments = c.Comments.OrderByDescending(cc => cc.CreatedAt).Select(cc => new CardCommentDto
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
                Attachments = c.Attachments.Select(ca => new CardAttachmentDto
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
        };
    }
}
