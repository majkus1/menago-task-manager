using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using MENAGO_TASK.API.Models;

namespace MENAGO_TASK.API.Data;

public class ApplicationDbContext : IdentityDbContext<User>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Team> Teams { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<TeamInvitation> TeamInvitations { get; set; }
    public DbSet<Board> Boards { get; set; }
    public DbSet<BoardMember> BoardMembers { get; set; }
    public DbSet<List> Lists { get; set; }
    public DbSet<Card> Cards { get; set; }
    public DbSet<Label> Labels { get; set; }
    public DbSet<CardLabel> CardLabels { get; set; }
    public DbSet<CardComment> CardComments { get; set; }
    public DbSet<CardAttachment> CardAttachments { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<TeamMember>()
            .HasKey(tm => tm.Id);

        builder.Entity<TeamMember>()
            .HasOne(tm => tm.User)
            .WithMany(u => u.TeamMemberships)
            .HasForeignKey(tm => tm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamMember>()
            .HasOne(tm => tm.Team)
            .WithMany(t => t.Members)
            .HasForeignKey(tm => tm.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamMember>()
            .HasIndex(tm => new { tm.UserId, tm.TeamId })
            .IsUnique();

        builder.Entity<TeamInvitation>()
            .HasKey(ti => ti.Id);

        builder.Entity<TeamInvitation>()
            .HasOne(ti => ti.Team)
            .WithMany()
            .HasForeignKey(ti => ti.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamInvitation>()
            .HasOne(ti => ti.InvitedBy)
            .WithMany()
            .HasForeignKey(ti => ti.InvitedByUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<TeamInvitation>()
            .HasIndex(ti => ti.Token)
            .IsUnique();

        builder.Entity<TeamInvitation>()
            .HasIndex(ti => new { ti.Email, ti.TeamId })
            .IsUnique();

        builder.Entity<BoardMember>()
            .HasKey(bm => bm.Id);

        builder.Entity<BoardMember>()
            .HasOne(bm => bm.User)
            .WithMany()
            .HasForeignKey(bm => bm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<BoardMember>()
            .HasOne(bm => bm.Board)
            .WithMany(b => b.Members)
            .HasForeignKey(bm => bm.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<BoardMember>()
            .HasIndex(bm => new { bm.UserId, bm.BoardId })
            .IsUnique();

        builder.Entity<CardLabel>()
            .HasKey(cl => cl.Id);

        builder.Entity<CardLabel>()
            .HasOne(cl => cl.Card)
            .WithMany(c => c.CardLabels)
            .HasForeignKey(cl => cl.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CardLabel>()
            .HasOne(cl => cl.Label)
            .WithMany(l => l.CardLabels)
            .HasForeignKey(cl => cl.LabelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<CardLabel>()
            .HasIndex(cl => new { cl.CardId, cl.LabelId })
            .IsUnique();

        builder.Entity<Card>()
            .HasOne(c => c.AssignedTo)
            .WithMany(u => u.AssignedCards)
            .HasForeignKey(c => c.AssignedToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Entity<Card>()
            .HasOne(c => c.CreatedBy)
            .WithMany(u => u.CreatedCards)
            .HasForeignKey(c => c.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<List>()
            .HasIndex(l => new { l.BoardId, l.Position });

        builder.Entity<Card>()
            .HasIndex(c => new { c.ListId, c.Position });

        builder.Entity<Label>()
            .HasIndex(l => l.BoardId);

        // Additional performance indexes
        builder.Entity<Board>()
            .HasIndex(b => b.TeamId);

        builder.Entity<BoardMember>()
            .HasIndex(bm => bm.UserId);

        builder.Entity<TeamMember>()
            .HasIndex(tm => tm.UserId);

        builder.Entity<Card>()
            .HasIndex(c => c.CreatedById);

        builder.Entity<CardComment>()
            .HasIndex(cc => cc.CardId);
    }
}
