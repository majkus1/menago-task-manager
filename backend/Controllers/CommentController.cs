using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Claims;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/comments")]
[Authorize]
public class CommentController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CommentController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<ActionResult<CardCommentDto>> CreateComment(CreateCommentDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the card
        var card = await _context.Cards
            .Include(c => c.List)
                .ThenInclude(l => l.Board)
            .Where(c => c.Id == dto.CardId && (c.List.Board.OwnerId == userId || c.List.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (card == null)
        {
            return NotFound("Card not found or access denied");
        }

        var comment = new CardComment
        {
            Content = dto.Content,
            CardId = dto.CardId,
            UserId = userId
        };

        _context.CardComments.Add(comment);
        await _context.SaveChangesAsync();

        var createdComment = await _context.CardComments
            .Include(cc => cc.User)
            .FirstAsync(cc => cc.Id == comment.Id);

        return Ok(MapToCommentDto(createdComment));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CardCommentDto>> UpdateComment(Guid id, UpdateCommentDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var comment = await _context.CardComments
            .Include(cc => cc.Card)
                .ThenInclude(c => c.List)
                    .ThenInclude(l => l.Board)
            .Where(cc => cc.Id == id && cc.UserId == userId)
            .FirstOrDefaultAsync();

        if (comment == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.Content))
            comment.Content = dto.Content;

        comment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedComment = await _context.CardComments
            .Include(cc => cc.User)
            .FirstAsync(cc => cc.Id == comment.Id);

        return Ok(MapToCommentDto(updatedComment));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteComment(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var comment = await _context.CardComments
            .Where(cc => cc.Id == id && cc.UserId == userId)
            .FirstOrDefaultAsync();

        if (comment == null)
        {
            return NotFound();
        }

        _context.CardComments.Remove(comment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static CardCommentDto MapToCommentDto(CardComment comment)
    {
        return new CardCommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt,
            CardId = comment.CardId,
            User = new UserDto
            {
                Id = comment.User.Id,
                FirstName = comment.User.FirstName,
                LastName = comment.User.LastName,
                Email = comment.User.Email!,
                CreatedAt = comment.User.CreatedAt,
                LastLoginAt = comment.User.LastLoginAt,
                IsActive = comment.User.IsActive
            }
        };
    }
}
