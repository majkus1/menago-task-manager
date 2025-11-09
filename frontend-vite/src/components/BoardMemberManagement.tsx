import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { BoardMemberDto } from '@/types';
import { BoardRole } from '@/types';
import { Users, UserPlus, UserX, Settings, Crown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BoardMemberManagementProps {
  boardId: string;
  teamId?: string;
  currentUserRole: BoardRole;
  onClose: () => void;
}

export function BoardMemberManagement({ 
  boardId, 
  teamId, 
  currentUserRole,
  onClose 
}: BoardMemberManagementProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Get current board members
  const { data: boardMembers = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['board-members', boardId],
    queryFn: () => apiClient.getBoardMembers(boardId),
  });

  // Get team members for adding new members
  const { data: teamMembers = [], isLoading: isLoadingTeamMembers } = useQuery({
    queryKey: ['team-members-for-board', teamId],
    queryFn: () => apiClient.getTeamMembersForBoard(boardId),
    enabled: !!teamId,
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => apiClient.addBoardMember(boardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-members', boardId] });
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      // Invalidate boards list so the added member sees the board when they log in
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiClient.removeBoardMember(boardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-members', boardId] });
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const handleRemoveMember = (userId: string, memberRole: BoardRole) => {
    const isOwner = memberRole === BoardRole.Owner;
    const confirmMessage = isOwner 
      ? t('boardMembers.removeOwnerConfirm')
      : t('boardMembers.removeMemberConfirm');
    
    if (confirm(confirmMessage)) {
      removeMemberMutation.mutate(userId);
    }
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) return;
    
    try {
      // Add all selected members sequentially
      for (const userId of selectedMembers) {
        await addMemberMutation.mutateAsync(userId);
      }
      
      // Clear selection and close add members section
      setSelectedMembers([]);
      setShowAddMembers(false);
    } catch (error) {
      console.error('Error adding members:', error);
      // Error is handled by mutation, but we can keep selection visible so user can retry
    }
  };

  const canManageMembers = currentUserRole === BoardRole.Owner || currentUserRole === BoardRole.Admin;
  const availableTeamMembers = teamMembers.filter(
    teamMember => !boardMembers.some(boardMember => boardMember.userId === teamMember.user.id)
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-400 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <CardTitle>{t('boardMembers.title')}</CardTitle>
              </div>
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </div>
            <CardDescription>
              {t('boardMembers.subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            {/* Current Members */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('boardMembers.currentMembers')} ({boardMembers.length})
              </h3>
              
              {isLoadingMembers ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-200 rounded"></div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ) : boardMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {t('boardMembers.noMembers')}
                </p>
              ) : (
                <div className="space-y-3">
                  {boardMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{member.user.email}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                              member.role === BoardRole.Owner ? 'bg-yellow-100 text-yellow-800' :
                              member.role === BoardRole.Admin ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role === BoardRole.Owner && <Crown className="w-3 h-3" />}
                              {member.role === BoardRole.Admin && <Shield className="w-3 h-3" />}
                              {t(`boardMembers.roles.${member.role === BoardRole.Owner ? 'owner' : member.role === BoardRole.Admin ? 'admin' : 'member'}`)}
                            </span>

                            {canManageMembers && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveMember(member.userId, member.role)}
                                disabled={removeMemberMutation.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title={member.role === BoardRole.Owner ? t('boardMembers.removeOwnerConfirm') : t('boardMembers.removeMember')}
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Members Section */}
            {canManageMembers && teamId && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    {t('boardMembers.addMembers')}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddMembers(!showAddMembers)}
                    disabled={availableTeamMembers.length === 0}
                  >
                    {showAddMembers ? t('common.cancel') : t('boardMembers.addMembers')}
                  </Button>
                </div>

                <AnimatePresence>
                  {showAddMembers && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      {isLoadingTeamMembers ? (
                        <div className="animate-pulse space-y-3">
                          <div className="h-16 bg-gray-200 rounded"></div>
                          <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                      ) : availableTeamMembers.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          {t('boardMembers.allTeamMembersAdded')}
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {availableTeamMembers.map((teamMember) => (
                              <div
                                key={teamMember.id}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedMembers.includes(teamMember.user.id)
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                                onClick={() => handleMemberToggle(teamMember.user.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedMembers.includes(teamMember.user.id)
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedMembers.includes(teamMember.user.id) && (
                                      <span className="text-white text-xs">✓</span>
                                    )}
                                  </div>
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 font-medium text-sm">
                                      {teamMember.user.firstName[0]}{teamMember.user.lastName[0]}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {teamMember.user.firstName} {teamMember.user.lastName}
                                    </p>
                                    <p className="text-sm text-gray-600">{teamMember.user.email}</p>
                                  </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  teamMember.role === 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {teamMember.role === 1 ? t('team.admin') : t('team.member')}
                                </span>
                              </div>
                            ))}
                          </div>

                          {selectedMembers.length > 0 && (
                            <div className="flex gap-3 pt-4 border-t">
                              <Button
                                onClick={handleAddMembers}
                                disabled={addMemberMutation.isPending}
                                className="flex-1"
                              >
                                {addMemberMutation.isPending 
                                  ? t('boardMembers.adding') 
                                  : t('boardMembers.confirmAdding', { count: selectedMembers.length })
                                }
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedMembers([]);
                                  setShowAddMembers(false);
                                }}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {!canManageMembers && (
              <div className="text-center py-8 text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>{t('boardMembers.noPermissions')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
