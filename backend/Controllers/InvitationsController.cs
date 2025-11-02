using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Services;
using System.Security.Claims;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InvitationsController : ControllerBase
{
    private readonly IInvitationService _invitationService;

    public InvitationsController(IInvitationService invitationService)
    {
        _invitationService = invitationService;
    }

    [HttpPost("invite")]
    [Authorize]
    public async Task<ActionResult<InvitationResult>> InviteUserToTeam(InviteUserToTeamDto dto)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var result = await _invitationService.InviteUserToTeamAsync(dto, userId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("accept")]
    public async Task<ActionResult<AuthResponseDto>> AcceptInvitation(AcceptInvitationDto dto)
    {
        try
        {
            // Decode URL-encoded token
            dto.Token = Uri.UnescapeDataString(dto.Token);
            Console.WriteLine($"Accept invitation - decoded token: {dto.Token}");
            
            var result = await _invitationService.AcceptInvitationAsync(dto);
            Console.WriteLine($"Accept invitation successful for: {result.User.Email}");
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            Console.WriteLine($"Accept invitation failed: {ex.Message}");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Accept invitation unexpected error: {ex.Message}");
            return BadRequest(new { message = "Wystąpił nieoczekiwany błąd podczas akceptacji zaproszenia" });
        }
    }

    [HttpGet("pending/{email}")]
    public async Task<ActionResult<List<TeamInvitationDto>>> GetPendingInvitations(string email)
    {
        try
        {
            var invitations = await _invitationService.GetPendingInvitationsAsync(email);
            return Ok(invitations);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("validate/{token}")]
    public async Task<ActionResult<bool>> ValidateInvitationToken(string token)
    {
        try
        {
            // Decode URL-encoded token
            var decodedToken = Uri.UnescapeDataString(token);
            Console.WriteLine($"Controller received token: {token}");
            Console.WriteLine($"Decoded token: {decodedToken}");
            
            var isValid = await _invitationService.ValidateInvitationTokenAsync(decodedToken);
            return Ok(new { isValid });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
