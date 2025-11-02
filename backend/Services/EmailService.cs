using Microsoft.Extensions.Localization;

namespace MENAGO_TASK.API.Services;

public interface IEmailService
{
    Task SendEmailAsync(string email, string subject, string body);
    Task SendTeamInvitationAsync(string email, string teamName, string inviterName, string? language = null);
    Task SendTeamInvitationWithRegistrationAsync(string email, string teamName, string inviterName, string token, string? language = null);
    Task SendPasswordResetAsync(string email, string resetToken, string? language = null);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;
    private readonly IStringLocalizer _localizer;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger, IStringLocalizerFactory localizerFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _localizer = localizerFactory.Create("Emails", System.Reflection.Assembly.GetExecutingAssembly().GetName().Name!);
    }

    public async Task SendEmailAsync(string email, string subject, string body)
    {
        _logger.LogInformation("Sending email to {Email} with subject: {Subject}", email, subject);
        
        try
        {
            var smtpHost = _configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            var smtpPort = int.Parse(_configuration["Email:SmtpPort"] ?? "587");
            var username = _configuration["Email:Username"];
            var password = _configuration["Email:Password"];
            var fromEmail = _configuration["Email:FromEmail"] ?? "michalipka1@gmail.com";
            var fromName = _configuration["Email:FromName"] ?? "MENAGO TASK";
            
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                _logger.LogWarning("Gmail SMTP credentials not configured. Email not sent.");
                return;
            }

            using var smtpClient = new System.Net.Mail.SmtpClient(smtpHost)
            {
                Port = smtpPort,
                Credentials = new System.Net.NetworkCredential(username, password),
                EnableSsl = true,
            };

            var mailMessage = new System.Net.Mail.MailMessage
            {
                From = new System.Net.Mail.MailAddress(fromEmail, fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };

            mailMessage.To.Add(email);

            _logger.LogInformation("Sending email via Gmail SMTP: From={FromEmail}, To={ToEmail}, Subject={Subject}", 
                fromEmail, email, subject);

            await smtpClient.SendMailAsync(mailMessage);
            _logger.LogInformation("Email sent successfully to {Email} via Gmail SMTP", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", email);
            throw;
        }
    }

    public async Task SendTeamInvitationAsync(string email, string teamName, string inviterName, string? language = null)
    {
        _logger.LogInformation("Sending team invitation email to {Email} for team {TeamName} from {InviterName}", 
            email, teamName, inviterName);
        
        // Set culture if language is provided
        if (!string.IsNullOrEmpty(language))
        {
            var culture = new System.Globalization.CultureInfo(language);
            System.Threading.Thread.CurrentThread.CurrentCulture = culture;
            System.Threading.Thread.CurrentThread.CurrentUICulture = culture;
        }
        
        var frontendUrl = _configuration["Frontend:Url"] ?? "http://localhost:3000";
        var loginLink = $"{frontendUrl}/login";
        
        var subject = string.Format(_localizer["TeamInvitation_Subject"].Value, teamName);
        var body = string.Format(_localizer["TeamInvitation_Body"].Value, inviterName, teamName, loginLink);
        
        await SendEmailAsync(email, subject, body);
        _logger.LogInformation("Team invitation email sent successfully to {Email}", email);
    }

    public async Task SendTeamInvitationWithRegistrationAsync(string email, string teamName, string inviterName, string token, string? language = null)
    {
        _logger.LogInformation("Sending team invitation with registration email to {Email} for team {TeamName} from {InviterName}", 
            email, teamName, inviterName);
        
        // Set culture if language is provided
        if (!string.IsNullOrEmpty(language))
        {
            var culture = new System.Globalization.CultureInfo(language);
            System.Threading.Thread.CurrentThread.CurrentCulture = culture;
            System.Threading.Thread.CurrentThread.CurrentUICulture = culture;
        }
        
        var frontendUrl = _configuration["Frontend:Url"] ?? "http://localhost:3000";
        var registerLink = $"{frontendUrl}/register?token={token}&team={teamName}";
        
        var subject = string.Format(_localizer["TeamInvitationWithRegistration_Subject"].Value, teamName);
        var body = string.Format(_localizer["TeamInvitationWithRegistration_Body"].Value, inviterName, teamName, registerLink);
        
        await SendEmailAsync(email, subject, body);
        _logger.LogInformation("Team invitation with registration email sent successfully to {Email}", email);
    }

    public async Task SendPasswordResetAsync(string email, string resetToken, string? language = null)
    {
        _logger.LogInformation("Sending password reset email to {Email}", email);
        
        // Set culture if language is provided
        if (!string.IsNullOrEmpty(language))
        {
            var culture = new System.Globalization.CultureInfo(language);
            System.Threading.Thread.CurrentThread.CurrentCulture = culture;
            System.Threading.Thread.CurrentThread.CurrentUICulture = culture;
        }
        
        var frontendUrl = _configuration["Frontend:Url"] ?? "http://localhost:3000";
        var resetLink = $"{frontendUrl}/reset-password?token={resetToken}";
        
        var subject = _localizer["PasswordReset_Subject"].Value;
        var body = string.Format(_localizer["PasswordReset_Body"].Value, resetLink);
        
        await SendEmailAsync(email, subject, body);
        _logger.LogInformation("Password reset email sent successfully to {Email}", email);
    }
}
