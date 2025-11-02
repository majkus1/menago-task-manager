import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { TeamDto, TeamMemberDto, InviteUserToTeamDto, UpdateTeamMemberRoleDto } from '@/types';
import { Users, Mail, Crown, Shield, User, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface TeamManagementProps {
  team: TeamDto;
  currentUserId: string;
}

export function TeamManagement({ team, currentUserId }: TeamManagementProps) {
  const { t, i18n } = useTranslation();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const queryClient = useQueryClient();

  const isOwner = team.owner.id === currentUserId;
  const isAdmin = team.members.find(m => m.user.id === currentUserId)?.role === 1; // Admin role
  const canManageMembers = isOwner || isAdmin;
  
  // Owner has same permissions as admin
  const canManageTeam = isOwner || isAdmin;

  const inviteUserMutation = useMutation({
    mutationFn: (data: InviteUserToTeamDto) => apiClient.inviteUserToTeam(data),
    onSuccess: (result) => {
      // Invalidate both teams list and current team data
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team', team.id] });
      
      // If user was added directly (existing user), refetch team immediately
      if (!result.requiresRegistration) {
        queryClient.refetchQueries({ queryKey: ['team', team.id] });
      }
      
      setInviteEmail('');
      setShowInviteForm(false);
      
      // Show appropriate message based on result
      if (result.requiresRegistration) {
        alert(t('team.inviteSent'));
      } else {
        alert(t('team.inviteSuccess'));
      }
    },
    onError: (error) => {
      console.error('Error inviting user:', error);
      const errorMessage = error.response?.data?.message || t('team.inviteError');
      alert(errorMessage);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ teamId, memberUserId, data }: { teamId: string; memberUserId: string; data: UpdateTeamMemberRoleDto }) =>
      apiClient.updateTeamMemberRole(teamId, memberUserId, data),
    onMutate: async ({ teamId, memberUserId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      await queryClient.cancelQueries({ queryKey: ['team', teamId] });

      // Snapshot the previous values
      const previousTeams = queryClient.getQueryData(['teams']);
      const previousTeam = queryClient.getQueryData(['team', teamId]);

      // Optimistically update the teams cache
      queryClient.setQueryData(['teams'], (old: TeamDto[] | undefined) => {
        if (!old) return old;
        return old.map(team => {
          if (team.id === teamId) {
            return {
              ...team,
              members: team.members.map(member => {
                if (member.user.id === memberUserId) {
                  return { ...member, role: data.role };
                }
                return member;
              })
            };
          }
          return team;
        });
      });

      // Optimistically update the single team cache
      queryClient.setQueryData(['team', teamId], (old: TeamDto | undefined) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map(member => {
            if (member.user.id === memberUserId) {
              return { ...member, role: data.role };
            }
            return member;
          })
        };
      });

      // Return a context object with the snapshotted values
      return { previousTeams, previousTeam };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      if (context?.previousTeam) {
        queryClient.setQueryData(['team', variables.teamId], context.previousTeam);
      }
      console.error('Error updating role:', err);
      alert(t('team.updateRoleError'));
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, memberUserId }: { teamId: string; memberUserId: string }) =>
      apiClient.removeTeamMember(teamId, memberUserId),
    onMutate: async ({ teamId, memberUserId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      await queryClient.cancelQueries({ queryKey: ['team', teamId] });

      // Snapshot the previous values
      const previousTeams = queryClient.getQueryData(['teams']);
      const previousTeam = queryClient.getQueryData(['team', teamId]);

      // Optimistically update the teams cache
      queryClient.setQueryData(['teams'], (old: TeamDto[] | undefined) => {
        if (!old) return old;
        return old.map(team => {
          if (team.id === teamId) {
            const isRemovingOwner = memberUserId === team.owner.id;
            const isCurrentUserAdmin = team.members.find(m => m.user.id === currentUserId)?.role === 1;
            
            return {
              ...team,
              // If removing owner and current user is admin, transfer ownership
              owner: isRemovingOwner && isCurrentUserAdmin 
                ? team.members.find(m => m.user.id === currentUserId)!.user 
                : team.owner,
              members: team.members.filter(member => member.user.id !== memberUserId)
            };
          }
          return team;
        });
      });

      // Optimistically update the single team cache
      queryClient.setQueryData(['team', teamId], (old: TeamDto | undefined) => {
        if (!old) return old;
        const isRemovingOwner = memberUserId === old.owner.id;
        const isCurrentUserAdmin = old.members.find(m => m.user.id === currentUserId)?.role === 1;
        
        return {
          ...old,
          // If removing owner and current user is admin, transfer ownership
          owner: isRemovingOwner && isCurrentUserAdmin 
            ? old.members.find(m => m.user.id === currentUserId)!.user 
            : old.owner,
          members: old.members.filter(member => member.user.id !== memberUserId)
        };
      });

      // Return a context object with the snapshotted values
      return { previousTeams, previousTeam };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      if (context?.previousTeam) {
        queryClient.setQueryData(['team', variables.teamId], context.previousTeam);
      }
      console.error('Error removing member:', err);
      alert(t('team.removeMemberError'));
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => apiClient.deleteTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      alert(t('team.teamDeleted'));
      // Redirect to dashboard
      window.location.href = '/dashboard';
    },
    onError: (error) => {
      console.error('Error deleting team:', error);
      const errorMessage = error.response?.data?.message || t('team.deleteTeamError');
      alert(errorMessage);
    },
  });

  const handleInviteUser = () => {
    if (inviteEmail.trim()) {
      inviteUserMutation.mutate({
        email: inviteEmail.trim(),
        teamId: team.id,
        language: i18n.language,
      });
    }
  };

  const handleRoleChange = (memberUserId: string, newRole: number) => {
    updateRoleMutation.mutate({
      teamId: team.id,
      memberUserId,
      data: {
        teamMemberId: team.members.find(m => m.user.id === memberUserId)?.id || '',
        role: newRole,
      },
    });
  };

  const handleRemoveMember = (memberUserId: string) => {
    const isRemovingOwner = memberUserId === team.owner.id;
    const isCurrentUserAdmin = isAdmin;
    
    let confirmMessage = t('team.removeMemberConfirm');
    
    if (isRemovingOwner && isCurrentUserAdmin) {
      confirmMessage = t('team.removeOwnerConfirm');
    }
    
    if (confirm(confirmMessage)) {
      removeMemberMutation.mutate({
        teamId: team.id,
        memberUserId,
      });
    }
  };

  const handleDeleteTeam = () => {
    const confirmMessage = t('team.deleteConfirm', { name: team.name });
    
    if (confirm(confirmMessage)) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  const getRoleIcon = (role: number) => {
    switch (role) {
      case 2: return <Crown className="w-4 h-4 text-yellow-500" />;
      case 1: return <Shield className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleName = (role: number) => {
    switch (role) {
      case 2: return t('team.owner');
      case 1: return t('team.admin');
      default: return t('team.member');
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {team.name}
          </CardTitle>
          {team.description && (
            <CardDescription>{team.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            <p>{t('team.created')} {new Date(team.createdAt).toLocaleDateString(t('dates.format'))}</p>
            <p>{t('team.members')} {team.members.length}</p>
          </div>
          
          {canManageTeam && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button
                variant="destructive"
                onClick={handleDeleteTeam}
                disabled={deleteTeamMutation.isPending}
                className="w-full"
              >
                {deleteTeamMutation.isPending ? t('team.deleting') : t('team.deleteTeam')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite User */}
      {canManageTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('team.inviteNewMember')}
            </CardTitle>
            <CardDescription>
              {t('team.inviteSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showInviteForm ? (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder={t('team.emailPlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInviteUser()}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail.trim() || inviteUserMutation.isPending}
                  >
                    {inviteUserMutation.isPending ? t('team.sending') : t('team.sendInvitation')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInviteForm(false);
                      setInviteEmail('');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowInviteForm(true)}>
                <Mail className="w-4 h-4 mr-2" />
                {t('team.inviteMember')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>{t('team.teamMembers')}</CardTitle>
          <CardDescription>
            {t('team.manageMembersSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Owner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 gap-3">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium">{team.owner.firstName} {team.owner.lastName}</p>
                  <p className="text-sm text-gray-600">{team.owner.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  {t('team.owner')}
                </span>
                {canManageTeam && team.owner.id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMember(team.owner.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto"
                    title={isAdmin ? t('team.removeOwnerConfirm') : t('team.ownerCannotBeRemoved')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Members */}
            {team.members.filter(member => member.user.id !== team.owner.id).map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg border gap-3"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(member.role)}
                  <div>
                    <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                    <p className="text-sm text-gray-600">{member.user.email}</p>
                    <p className="text-xs text-gray-500">
                      {t('team.joined') || 'Dołączył'}: {new Date(member.joinedAt).toLocaleDateString(t('dates.format'))}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    {canManageTeam && member.user.id !== currentUserId && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user.id, parseInt(e.target.value))}
                        className="px-2 py-1 text-sm border rounded"
                        disabled={updateRoleMutation.isPending}
                      >
                        <option value={0}>{t('team.member')}</option>
                        <option value={1}>{t('team.admin')}</option>
                      </select>
                    )}
                    
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      member.role === 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getRoleName(member.role)}
                    </span>
                  </div>

                  {canManageTeam && member.user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.user.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
