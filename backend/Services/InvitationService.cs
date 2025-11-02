using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Data;
using MENAGO_TASK.API.DTOs;
using MENAGO_TASK.API.Models;
using System.Security.Cryptography;
using System.Text;

namespace MENAGO_TASK.API.Services;

public interface IInvitationService
{
    Task<InvitationResult> InviteUserToTeamAsync(InviteUserToTeamDto dto, string inviterId);
    Task<AuthResponseDto> AcceptInvitationAsync(AcceptInvitationDto dto);
    Task<List<TeamInvitationDto>> GetPendingInvitationsAsync(string email);
    Task<bool> ValidateInvitationTokenAsync(string token);
}

public class InvitationService : IInvitationService
{
    private readonly UserManager<User> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;

    public InvitationService(
        UserManager<User> userManager,
        ApplicationDbContext context,
        IEmailService emailService,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _context = context;
        _emailService = emailService;
        _configuration = configuration;
    }

    public async Task<InvitationResult> InviteUserToTeamAsync(InviteUserToTeamDto dto, string inviterId)
    {
        // Check if user already exists
        var existingUser = await _userManager.FindByEmailAsync(dto.Email);
        
        if (existingUser != null)
        {
            // User exists - check if already a member
            var isAlreadyMember = await _context.TeamMembers
                .AnyAsync(tm => tm.TeamId == dto.TeamId && tm.UserId == existingUser.Id);

            if (isAlreadyMember)
            {
                return new InvitationResult
                {
                    Success = false,
                    Message = "Użytkownik jest już członkiem tego zespołu",
                    RequiresRegistration = false
                };
            }

            // Add user to team directly
            var teamMember = new TeamMember
            {
                UserId = existingUser.Id,
                TeamId = dto.TeamId,
                Role = TeamRole.Member,
                JoinedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.TeamMembers.Add(teamMember);
            await _context.SaveChangesAsync();

            // Send notification email to existing user
            await SendExistingUserNotificationAsync(dto.Email, dto.TeamId, inviterId, dto.Language);

            return new InvitationResult
            {
                Success = true,
                Message = "Użytkownik został dodany do zespołu",
                RequiresRegistration = false
            };
        }
        else
        {
            // User doesn't exist - create invitation
            var invitation = new TeamInvitation
            {
                Email = dto.Email,
                TeamId = dto.TeamId,
                InvitedByUserId = inviterId,
                Token = GenerateSecureToken(),
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(7)
            };

            _context.TeamInvitations.Add(invitation);
            await _context.SaveChangesAsync();

            // Load related entities for email
            var invitationWithRelations = await _context.TeamInvitations
                .Include(ti => ti.Team)
                .Include(ti => ti.InvitedBy)
                .FirstOrDefaultAsync(ti => ti.Id == invitation.Id);

            if (invitationWithRelations != null)
            {
                // Send invitation email with registration link
                try
                {
                    await SendInvitationEmailAsync(invitationWithRelations, dto.Language);
                }
                catch (Exception ex)
                {
                    // Log the error but don't fail the invitation creation
                    Console.WriteLine($"Error sending invitation email: {ex.Message}");
                    // You could also use a logger here if available
                }
            }

            return new InvitationResult
            {
                Success = true,
                Message = "Zaproszenie zostało wysłane na email",
                RequiresRegistration = true
            };
        }
    }

    public async Task<AuthResponseDto> AcceptInvitationAsync(AcceptInvitationDto dto)
    {
        Console.WriteLine($"Accepting invitation with token: {dto.Token}");
        
        var invitation = await _context.TeamInvitations
            .Include(ti => ti.Team)
            .Include(ti => ti.InvitedBy)
            .FirstOrDefaultAsync(ti => ti.Token == dto.Token);

        Console.WriteLine($"Found invitation: {invitation != null}");
        if (invitation != null)
        {
            Console.WriteLine($"IsExpired: {invitation.IsExpired}, IsAccepted: {invitation.IsAccepted}, IsValid: {invitation.IsValid}");
        }

        if (invitation == null || !invitation.IsValid)
        {
            throw new InvalidOperationException("Nieprawidłowe lub wygasłe zaproszenie");
        }

        // Create user
        var user = new User
        {
            UserName = invitation.Email,
            Email = invitation.Email,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Rejestracja nie powiodła się: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        // Add user to team
        var teamMember = new TeamMember
        {
            UserId = user.Id,
            TeamId = invitation.TeamId,
            Role = TeamRole.Member,
            JoinedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.TeamMembers.Add(teamMember);

        // Mark invitation as accepted
        invitation.IsAccepted = true;
        invitation.AcceptedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Generate JWT token
        Console.WriteLine("Generating JWT token...");
        var token = GenerateJwtToken(user);
        Console.WriteLine("JWT token generated successfully");

        var response = new AuthResponseDto
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
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

        Console.WriteLine($"Returning response for user: {user.Email}");
        return response;
    }

    public async Task<List<TeamInvitationDto>> GetPendingInvitationsAsync(string email)
    {
        var invitations = await _context.TeamInvitations
            .Include(ti => ti.Team)
            .Include(ti => ti.InvitedBy)
            .Where(ti => ti.Email == email && !ti.IsAccepted && !ti.IsExpired)
            .Select(ti => new TeamInvitationDto
            {
                Id = ti.Id,
                Email = ti.Email,
                TeamId = ti.TeamId,
                TeamName = ti.Team.Name,
                InvitedByUserName = $"{ti.InvitedBy.FirstName} {ti.InvitedBy.LastName}",
                CreatedAt = ti.CreatedAt,
                ExpiresAt = ti.ExpiresAt,
                IsAccepted = ti.IsAccepted,
                IsExpired = ti.IsExpired
            })
            .ToListAsync();

        return invitations;
    }

    public async Task<bool> ValidateInvitationTokenAsync(string token)
    {
        Console.WriteLine($"Validating token: {token}");
        
        var invitation = await _context.TeamInvitations
            .FirstOrDefaultAsync(ti => ti.Token == token);

        Console.WriteLine($"Found invitation: {invitation != null}");
        if (invitation != null)
        {
            Console.WriteLine($"IsExpired: {invitation.IsExpired}, IsAccepted: {invitation.IsAccepted}, IsValid: {invitation.IsValid}");
        }

        return invitation != null && invitation.IsValid;
    }

    private string GenerateSecureToken()
    {
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[32];
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");

        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(jwtKey);

        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(new[]
            {
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, user.Id),
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Email, user.Email!),
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, $"{user.FirstName} {user.LastName}")
            }),
            Expires = DateTime.UtcNow.AddDays(7),
            Issuer = jwtIssuer,
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private async Task SendInvitationEmailAsync(TeamInvitation invitation, string? language = null)
    {
        try
        {
            if (invitation.Team == null || invitation.InvitedBy == null)
            {
                Console.WriteLine("Error: Team or InvitedBy is null in invitation");
                return;
            }

            var frontendUrl = _configuration["Frontend:Url"] ?? "http://localhost:3000";
            var registrationUrl = $"{frontendUrl}/accept-invitation?token={invitation.Token}";

            // Use EmailService methods which support localization
            await _emailService.SendTeamInvitationWithRegistrationAsync(
                invitation.Email, 
                invitation.Team.Name, 
                $"{invitation.InvitedBy.FirstName} {invitation.InvitedBy.LastName}", 
                invitation.Token,
                language);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in SendInvitationEmailAsync: {ex.Message}");
            throw; // Re-throw to be caught by the calling method
        }
    }

    private async Task SendExistingUserNotificationAsync(string email, Guid teamId, string inviterId, string? language = null)
    {
        var team = await _context.Teams.FindAsync(teamId);
        var inviter = await _userManager.FindByIdAsync(inviterId);

        if (team == null || inviter == null) return;

        // Use EmailService method which supports localization
        await _emailService.SendTeamInvitationAsync(
            email, 
            team.Name, 
            $"{inviter.FirstName} {inviter.LastName}",
            language);
    }
}

public class InvitationResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool RequiresRegistration { get; set; }
}
