using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Claims;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/labels")]
[Authorize]
public class LabelController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public LabelController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<ActionResult<LabelDto>> CreateLabel(CreateLabelDto dto)
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

        var label = new Label
        {
            Name = dto.Name,
            Color = dto.Color,
            BoardId = dto.BoardId
        };

        _context.Labels.Add(label);
        await _context.SaveChangesAsync();

        var createdLabel = await _context.Labels
            .FirstAsync(l => l.Id == label.Id);

        return Ok(MapToLabelDto(createdLabel));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<LabelDto>> UpdateLabel(Guid id, UpdateLabelDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var label = await _context.Labels
            .Include(l => l.Board)
            .Where(l => l.Id == id && (l.Board.OwnerId == userId || l.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (label == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.Name))
            label.Name = dto.Name;
        
        if (!string.IsNullOrEmpty(dto.Color))
            label.Color = dto.Color;

        await _context.SaveChangesAsync();

        var updatedLabel = await _context.Labels
            .FirstAsync(l => l.Id == label.Id);

        return Ok(MapToLabelDto(updatedLabel));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLabel(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var label = await _context.Labels
            .Include(l => l.Board)
            .Where(l => l.Id == id && (l.Board.OwnerId == userId || l.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (label == null)
        {
            return NotFound();
        }

        _context.Labels.Remove(label);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static LabelDto MapToLabelDto(Label label)
    {
        return new LabelDto
        {
            Id = label.Id,
            Name = label.Name,
            Color = label.Color,
            CreatedAt = label.CreatedAt,
            BoardId = label.BoardId
        };
    }
}
