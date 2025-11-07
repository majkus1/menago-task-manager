using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Services;
using System.Security.Claims;

namespace MENAGO_TASK.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IWebHostEnvironment _env;

    public AuthController(IAuthService authService, IWebHostEnvironment env)
    {
        _authService = authService;
        _env = env;
    }

    [HttpPost("register-team")]
    public async Task<ActionResult<AuthResponseDto>> RegisterTeam(RegisterTeamDto dto)
    {
        try
        {
            var result = await _authService.RegisterTeamAsync(dto);
            
            // Set HTTP-only cookie
            SetAuthCookie(result.Token);
            
            // Return user data without token
            return Ok(new AuthResponseDto
            {
                User = result.User,
                Token = null // Don't send token in response
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
    {
        try
        {
            var result = await _authService.LoginAsync(dto);
            
            // Set HTTP-only cookie
            SetAuthCookie(result.Token);
            
            // Return user data without token
            return Ok(new AuthResponseDto
            {
                User = result.User,
                Token = null // Don't send token in response
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("invite-user")]
    [Authorize]
    public async Task<ActionResult> InviteUser(InviteUserDto dto)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            await _authService.InviteUserAsync(dto, userId);
            return Ok(new { message = "Invitation sent successfully" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public ActionResult<UserDto> GetCurrentUser()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        var name = User.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(name))
        {
            return Unauthorized();
        }

        var nameParts = name.Split(' ');
        var userDto = new UserDto
        {
            Id = userId,
            Email = email,
            FirstName = nameParts.Length > 0 ? nameParts[0] : "",
            LastName = nameParts.Length > 1 ? string.Join(" ", nameParts.Skip(1)) : "",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        return Ok(userDto);
    }

    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword(ForgotPasswordDto dto)
    {
        try
        {
            await _authService.ForgotPasswordAsync(dto);
            // Always return success to prevent email enumeration attacks
            return Ok(new { message = "If an account with that email exists, a password reset link has been sent." });
        }
        catch
        {
            // Still return success for security
            return Ok(new { message = "If an account with that email exists, a password reset link has been sent." });
        }
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult> ResetPassword(ResetPasswordDto dto)
    {
        try
        {
            await _authService.ResetPasswordAsync(dto);
            return Ok(new { message = "Password has been reset successfully" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    public ActionResult Logout()
    {
        // Clear the HTTP-only cookie
        Response.Cookies.Delete("access_token");
        return Ok(new { message = "Logged out successfully" });
    }

    private void SetAuthCookie(string token)
    {
        // Static Web Apps proxies /api/* to App Service through SWA origin
        // All requests go through SWA, so cookies are first-party (SameSite=Lax works on mobile)
        // Use direct Set-Cookie header (like Node.js) for full control over formatting
        var isSecure = Request.IsHttps || !_env.IsDevelopment();
        var maxAgeSeconds = 7 * 24 * 60 * 60; // 7 days in seconds (like Node.js maxAge in milliseconds, but Set-Cookie uses seconds)
        
        // Build Set-Cookie header: httpOnly; secure; SameSite=Lax (first-party cookie through SWA proxy)
        var cookieValue = $"access_token={token}; HttpOnly; {(isSecure ? "Secure; " : "")}SameSite=Lax; Max-Age={maxAgeSeconds}; Path=/";
        
        // Set cookie header directly (like Node.js res.cookie())
        Response.Headers.Append("Set-Cookie", cookieValue);
    }
}
