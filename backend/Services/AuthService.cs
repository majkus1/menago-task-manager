using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace MENAGO_TASK.API.Services;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterTeamAsync(RegisterTeamDto dto);
    Task<AuthResponseDto> LoginAsync(LoginDto dto);
    Task<bool> InviteUserAsync(InviteUserDto dto, string inviterId);
    Task<bool> AcceptInvitationAsync(string token);
    Task<bool> ForgotPasswordAsync(ForgotPasswordDto dto);
    Task<bool> ResetPasswordAsync(ResetPasswordDto dto);
    string GenerateJwtToken(User user);
    string GeneratePasswordResetToken(User user);
}

public class AuthService : IAuthService
{
    private readonly UserManager<User> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        UserManager<User> userManager,
        ApplicationDbContext context,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _context = context;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponseDto> RegisterTeamAsync(RegisterTeamDto dto)
    {
        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser != null)
        {
            throw new InvalidOperationException("User with this email already exists");
        }

        var user = new User
        {
            UserName = dto.Email,
            Email = dto.Email,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"User creation failed: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        var team = new Team
        {
            Name = dto.TeamName,
            Description = dto.TeamDescription,
            OwnerId = user.Id
        };

        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        var teamMember = new TeamMember
        {
            UserId = user.Id,
            TeamId = team.Id,
            Role = Models.TeamRole.Owner
        };

        _context.TeamMembers.Add(teamMember);
        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        var expiresAt = DateTime.UtcNow.AddDays(7);

        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email!,
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt,
                IsActive = user.IsActive
            }
        };
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        var isValidPassword = await _userManager.CheckPasswordAsync(user, dto.Password);
        if (!isValidPassword)
        {
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        var token = GenerateJwtToken(user);
        var expiresAt = DateTime.UtcNow.AddDays(7);

        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email!,
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt,
                IsActive = user.IsActive
            }
        };
    }

    public async Task<bool> InviteUserAsync(InviteUserDto dto, string inviterId)
    {
        var team = await _context.Teams.FindAsync(dto.TeamId);
        if (team == null)
        {
            throw new InvalidOperationException("Team not found");
        }

        var inviter = await _userManager.FindByIdAsync(inviterId);
        if (inviter == null)
        {
            throw new InvalidOperationException("Inviter not found");
        }

        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        if (existingUser != null)
        {
            var existingMembership = await _context.TeamMembers
                .FirstOrDefaultAsync(tm => tm.UserId == existingUser.Id && tm.TeamId == dto.TeamId);
            
            if (existingMembership != null)
            {
                throw new InvalidOperationException("User is already a member of this team");
            }

            var teamMember = new TeamMember
            {
                UserId = existingUser.Id,
                TeamId = dto.TeamId,
                Role = Models.TeamRole.Member
            };

            _context.TeamMembers.Add(teamMember);
            await _context.SaveChangesAsync();

            await _emailService.SendTeamInvitationAsync(dto.Email, team.Name, inviter.FirstName + " " + inviter.LastName, dto.Language);
            return true;
        }

        var invitationToken = Guid.NewGuid().ToString();
        await _emailService.SendTeamInvitationWithRegistrationAsync(dto.Email, team.Name, inviter.FirstName + " " + inviter.LastName, invitationToken, dto.Language);

        return true;
    }

    public async Task<bool> AcceptInvitationAsync(string token)
    {
        // TODO: Implement invitation acceptance logic
        await Task.CompletedTask;
        return true;
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        
        // Security best practice: Don't reveal if email exists or not
        // Always return success to prevent email enumeration attacks
        if (user == null)
        {
            // Log but don't throw - security through obscurity
            return true;
        }

        try
        {
            // Generate password reset token (valid for 24 hours)
            var resetToken = GeneratePasswordResetToken(user);
            
            // Send password reset email
            await _emailService.SendPasswordResetAsync(dto.Email, resetToken, dto.Language);
            
            return true;
        }
        catch (Exception ex)
        {
            // Log error but still return success to prevent email enumeration
            _logger.LogError(ex, "Failed to send password reset email to {Email}", dto.Email);
            return true;
        }
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordDto dto)
    {
        // Validate and decode the JWT token
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null)
        {
            throw new UnauthorizedAccessException("Invalid reset link");
        }

        // Verify the token
        if (!ValidatePasswordResetToken(dto.Token, user))
        {
            throw new UnauthorizedAccessException("Invalid or expired reset link");
        }

        // Reset the password using Identity's token provider
        var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, resetToken, dto.NewPassword);
        
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Password reset failed: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        return true;
    }

    public string GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");

        var key = Encoding.ASCII.GetBytes(jwtKey);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email!),
                new Claim(ClaimTypes.Name, $"{user.FirstName} {user.LastName}")
            }),
            Expires = DateTime.UtcNow.AddDays(7),
            Issuer = jwtIssuer,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public string GeneratePasswordResetToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");

        var key = Encoding.ASCII.GetBytes(jwtKey);
        
        // Create a token specifically for password reset with 24 hour expiry
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email!),
                new Claim("purpose", "password_reset") // Custom claim to identify purpose
            }),
            Expires = DateTime.UtcNow.AddHours(24), // 24 hour expiry for reset
            Issuer = jwtIssuer,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private bool ValidatePasswordResetToken(string token, User user)
    {
        try
        {
            var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");

            var key = Encoding.ASCII.GetBytes(jwtKey);
            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken validatedToken);
            
            // Verify the token is for this user
            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != user.Id)
            {
                return false;
            }

            // Verify it's a password reset token
            var purposeClaim = principal.FindFirst("purpose")?.Value;
            if (purposeClaim != "password_reset")
            {
                return false;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }
}
