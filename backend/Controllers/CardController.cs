using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Claims;
using System.Text;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/cards")]
[Authorize]
public class CardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    // Allowed file extensions whitelist
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Office documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".odt", ".ods", ".odp",
        // Text files
        ".txt", ".rtf", ".csv",
        // Images
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg",
        // Archives
        ".zip", ".rar", ".7z", ".tar", ".gz"
    };

    // Dangerous file extensions - explicitly blocked
    private static readonly HashSet<string> DangerousExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Executables
        ".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".jar", ".msi", ".app",
        // Web files
        ".php", ".asp", ".aspx", ".jsp", ".html", ".htm", ".xml", ".jsx", ".tsx",
        // Script files
        ".py", ".rb", ".pl", ".sql",
        // System files
        ".lnk", ".scr", ".com", ".pif"
    };

    // MIME type mapping for extension validation
    private static readonly Dictionary<string, string> ExtensionToMimeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".pdf", "application/pdf" },
        { ".doc", "application/msword" },
        { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        { ".xls", "application/vnd.ms-excel" },
        { ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { ".ppt", "application/vnd.ms-powerpoint" },
        { ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        { ".txt", "text/plain" },
        { ".rtf", "application/rtf" },
        { ".csv", "text/csv" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" },
        { ".bmp", "image/bmp" },
        { ".webp", "image/webp" },
        { ".svg", "image/svg+xml" },
        { ".zip", "application/zip" },
        { ".rar", "application/x-rar-compressed" },
        { ".7z", "application/x-7z-compressed" }
    };

    public CardController(ApplicationDbContext context)
    {
        _context = context;
    }

    private bool IsValidMimeType(string fileExtension, string contentType)
    {
        // Verify MIME type matches extension
        if (ExtensionToMimeMap.TryGetValue(fileExtension, out var expectedMimeType))
        {
            return contentType.Equals(expectedMimeType, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private bool VerifyFileSignature(IFormFile file, string extension)
    {
        try
        {
            using var fileStream = file.OpenReadStream();
            byte[] header = new byte[10];
            int bytesRead = fileStream.Read(header, 0, 10);
            
            if (bytesRead < 4)
                return false;

            fileStream.Position = 0;

            // Verify PNG signature
            if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase))
            {
                return header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            }

            // Verify PDF signature
            if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                string headerStr = Encoding.ASCII.GetString(header, 0, 4);
                return headerStr.Equals("%PDF", StringComparison.Ordinal);
            }

            // Verify JPEG signature
            if (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || 
                extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase))
            {
                return header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            }

            // Verify ZIP signature
            if (extension.Equals(".zip", StringComparison.OrdinalIgnoreCase))
            {
                return header[0] == 0x50 && header[1] == 0x4B && (header[2] == 0x03 || header[2] == 0x05 || header[2] == 0x07);
            }

            // For other file types, if they pass MIME check, we allow them
            return true;
        }
        catch
        {
            return false;
        }
    }

    [HttpPost]
    public async Task<ActionResult<CardDto>> CreateCard(CreateCardDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // Check if user has access to the list/board
        var list = await _context.Lists
            .Include(l => l.Board)
            .Where(l => l.Id == dto.ListId && (l.Board.OwnerId == userId || l.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (list == null)
        {
            return NotFound("List not found or access denied");
        }

        var card = new Card
        {
            Title = dto.Title,
            Description = dto.Description,
            ListId = dto.ListId,
            Position = dto.Position,
            Priority = dto.Priority,
            DueDate = dto.DueDate,
            CreatedById = userId,
            AssignedToId = dto.AssignedToId
        };

        _context.Cards.Add(card);
        await _context.SaveChangesAsync();

        var createdCard = await _context.Cards
            .Include(c => c.CreatedBy)
            .Include(c => c.AssignedTo)
            .Include(c => c.CardLabels)
                .ThenInclude(cl => cl.Label)
            .Include(c => c.Comments)
                .ThenInclude(cc => cc.User)
            .Include(c => c.Attachments)
                .ThenInclude(ca => ca.UploadedBy)
            .FirstAsync(c => c.Id == card.Id);

        return Ok(MapToCardDto(createdCard));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CardDto>> UpdateCard(Guid id, UpdateCardDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var card = await _context.Cards
            .Include(c => c.List)
                .ThenInclude(l => l.Board)
            .Where(c => c.Id == id && (c.List.Board.OwnerId == userId || c.List.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (card == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.Title))
            card.Title = dto.Title;
        
        if (dto.Description != null)
            card.Description = dto.Description;
        
        if (dto.Position.HasValue)
            card.Position = dto.Position.Value;
        
        if (dto.Priority.HasValue)
            card.Priority = dto.Priority.Value;
        
        if (dto.DueDate.HasValue)
            card.DueDate = dto.DueDate;
        
        if (dto.AssignedToId != null)
            card.AssignedToId = dto.AssignedToId;
        
        if (dto.IsArchived.HasValue)
            card.IsArchived = dto.IsArchived.Value;

        card.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedCard = await _context.Cards
            .Include(c => c.CreatedBy)
            .Include(c => c.AssignedTo)
            .Include(c => c.CardLabels)
                .ThenInclude(cl => cl.Label)
            .Include(c => c.Comments)
                .ThenInclude(cc => cc.User)
            .Include(c => c.Attachments)
                .ThenInclude(ca => ca.UploadedBy)
            .FirstAsync(c => c.Id == card.Id);

        return Ok(MapToCardDto(updatedCard));
    }

    [HttpPost("move")]
    public async Task<ActionResult<CardDto>> MoveCard(MoveCardDto dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var card = await _context.Cards
            .Include(c => c.List)
                .ThenInclude(l => l.Board)
            .Where(c => c.Id == dto.CardId && (c.List.Board.OwnerId == userId || c.List.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (card == null)
        {
            return NotFound("Card not found or access denied");
        }

        var targetList = await _context.Lists
            .Include(l => l.Board)
            .Where(l => l.Id == dto.TargetListId && (l.Board.OwnerId == userId || l.Board.Members.Any(m => m.UserId == userId)))
            .FirstOrDefaultAsync();

        if (targetList == null)
        {
            return NotFound("Target list not found or access denied");
        }

        card.ListId = dto.TargetListId;
        card.Position = dto.Position;
        card.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var movedCard = await _context.Cards
            .Include(c => c.CreatedBy)
            .Include(c => c.AssignedTo)
            .Include(c => c.CardLabels)
                .ThenInclude(cl => cl.Label)
            .Include(c => c.Comments)
                .ThenInclude(cc => cc.User)
            .Include(c => c.Attachments)
                .ThenInclude(ca => ca.UploadedBy)
            .FirstAsync(c => c.Id == card.Id);

        return Ok(MapToCardDto(movedCard));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCard(Guid id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var card = await _context.Cards
            .Include(c => c.List)
                .ThenInclude(l => l.Board)
                    .ThenInclude(b => b.Team)
                        .ThenInclude(t => t.Members)
            .Where(c => c.Id == id)
            .FirstOrDefaultAsync();

        if (card == null)
        {
            return NotFound();
        }

        // Check if user has access to the board OR is team admin/owner
        var hasAccess = card.List.Board.OwnerId == userId || card.List.Board.Members.Any(m => m.UserId == userId);
        var isTeamOwner = card.List.Board.Team?.OwnerId == userId;
        var isTeamAdmin = card.List.Board.Team?.Members.Any(m => m.UserId == userId && m.Role == Models.TeamRole.Admin) == true;
        
        Console.WriteLine($"DeleteCard: User {userId}, Card {id}, Board {card.List.Board.Id}");
        Console.WriteLine($"DeleteCard: BoardOwner {card.List.Board.OwnerId}, HasAccess {hasAccess}");
        Console.WriteLine($"DeleteCard: BoardMembers count: {card.List.Board.Members?.Count ?? 0}");
        Console.WriteLine($"DeleteCard: IsTeamOwner {isTeamOwner}, IsTeamAdmin {isTeamAdmin}");
        
        if (!hasAccess && !isTeamOwner && !isTeamAdmin)
        {
            Console.WriteLine($"DeleteCard: User {userId} has no access to board {card.List.Board.Id}");
            return Forbid();
        }

        // Check if user is team admin/owner (required for deletion)
        
        if (!isTeamOwner && !isTeamAdmin)
        {
            Console.WriteLine($"DeleteCard: User {userId} is not team owner or admin");
            return Forbid("Only team admins and owners can delete cards");
        }

        _context.Cards.Remove(card);
        await _context.SaveChangesAsync();

        return NoContent();
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
                CreatedAt = cl.Label.CreatedAt,
                BoardId = cl.Label.BoardId
            }).ToList(),
            Comments = card.Comments.OrderByDescending(cc => cc.CreatedAt).Select(cc => new CardCommentDto
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
            Attachments = card.Attachments.Select(ca => new CardAttachmentDto
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
        };
    }

    [HttpPost("{cardId}/attachments")]
    public async Task<IActionResult> AddAttachment(Guid cardId, IFormFile file)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var card = await _context.Cards
                .Include(c => c.List)
                .ThenInclude(l => l.Board)
                .ThenInclude(b => b.Members)
                .FirstOrDefaultAsync(c => c.Id == cardId);

            if (card == null)
                return NotFound("Card not found");

            // Check if user has access to the card
            var hasAccess = card.List.Board.Members.Any(m => m.UserId == userId);
            if (!hasAccess)
                return Forbid();

            if (file == null || file.Length == 0)
                return BadRequest("No file provided");

            // Validate file size (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest("File size exceeds 10MB limit");

            // Get and validate file extension
            var fileExtension = Path.GetExtension(file.FileName);
            
            if (string.IsNullOrEmpty(fileExtension))
            {
                return BadRequest("File must have an extension");
            }

            // Security: Check for dangerous extensions first
            if (DangerousExtensions.Contains(fileExtension))
            {
                return BadRequest($"File type '{fileExtension}' is not allowed for security reasons");
            }

            // Security: Check if extension is in whitelist
            if (!AllowedExtensions.Contains(fileExtension))
            {
                return BadRequest($"File type '{fileExtension}' is not supported. Please upload: PDF, Office docs, images, or archives");
            }

            // Security: Verify MIME type matches extension
            if (!IsValidMimeType(fileExtension, file.ContentType))
            {
                return BadRequest($"Invalid file type. Expected MIME type for '{fileExtension}' does not match uploaded file");
            }

            // Security: Verify file signature (magic bytes)
            if (!VerifyFileSignature(file, fileExtension))
            {
                return BadRequest($"Invalid file format detected. The file content does not match the extension '{fileExtension}'");
            }

            // Create uploads directory if it doesn't exist
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "attachments");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            // Generate unique filename with validated extension
            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            var filePath = Path.Combine(uploadsDir, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Create attachment record
            var attachment = new CardAttachment
            {
                FileName = file.FileName,
                FilePath = filePath,
                ContentType = file.ContentType,
                FileSize = file.Length,
                CardId = cardId,
                UploadedById = userId
            };

            _context.CardAttachments.Add(attachment);
            await _context.SaveChangesAsync();

            return Ok(new CardAttachmentDto
            {
                Id = attachment.Id,
                FileName = attachment.FileName,
                FilePath = attachment.FilePath,
                ContentType = attachment.ContentType,
                FileSize = attachment.FileSize,
                UploadedAt = attachment.UploadedAt,
                CardId = attachment.CardId,
                UploadedBy = new UserDto
                {
                    Id = userId,
                    FirstName = User.FindFirst(ClaimTypes.GivenName)?.Value ?? "",
                    LastName = User.FindFirst(ClaimTypes.Surname)?.Value ?? "",
                    Email = User.FindFirst(ClaimTypes.Email)?.Value ?? "",
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = DateTime.UtcNow,
                    IsActive = true
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error uploading file: {ex.Message}");
        }
    }

    [HttpGet("{cardId}/attachments/{attachmentId}/download")]
    public async Task<IActionResult> DownloadAttachment(Guid cardId, Guid attachmentId)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var attachment = await _context.CardAttachments
                .Include(ca => ca.Card)
                .ThenInclude(c => c.List)
                .ThenInclude(l => l.Board)
                .ThenInclude(b => b.Members)
                .FirstOrDefaultAsync(ca => ca.Id == attachmentId && ca.CardId == cardId);

            if (attachment == null)
                return NotFound("Attachment not found");

            // Check if user has access to the card
            var hasAccess = attachment.Card.List.Board.Members.Any(m => m.UserId == userId);
            if (!hasAccess)
                return Forbid();

            if (!System.IO.File.Exists(attachment.FilePath))
                return NotFound("File not found on disk");

            var fileBytes = await System.IO.File.ReadAllBytesAsync(attachment.FilePath);
            return File(fileBytes, attachment.ContentType, attachment.FileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error downloading file: {ex.Message}");
        }
    }

    [HttpDelete("{cardId}/attachments/{attachmentId}")]
    public async Task<IActionResult> DeleteAttachment(Guid cardId, Guid attachmentId)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var attachment = await _context.CardAttachments
                .Include(ca => ca.Card)
                .ThenInclude(c => c.List)
                .ThenInclude(l => l.Board)
                .ThenInclude(b => b.Members)
                .FirstOrDefaultAsync(ca => ca.Id == attachmentId && ca.CardId == cardId);

            if (attachment == null)
                return NotFound("Attachment not found");

            // Check if user has access to the card
            var hasAccess = attachment.Card.List.Board.Members.Any(m => m.UserId == userId);
            if (!hasAccess)
                return Forbid();

            // Delete physical file
            if (System.IO.File.Exists(attachment.FilePath))
            {
                System.IO.File.Delete(attachment.FilePath);
            }

            // Delete database record
            _context.CardAttachments.Remove(attachment);
            await _context.SaveChangesAsync();

            return Ok();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error deleting attachment: {ex.Message}");
        }
    }
}
