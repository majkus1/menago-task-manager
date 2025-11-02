import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Settings, Crown, Shield, User, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { TeamRole } from '@/types';

export function TeamDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: team, isLoading, error } = useQuery({
    queryKey: ['team', id],
    queryFn: () => apiClient.getTeam(id!),
    enabled: !!id,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ['boards', id],
    queryFn: () => apiClient.getBoards(),
    enabled: !!id,
  });

  // Filter boards for this team
  const teamBoards = boards.filter(board => board.team?.id === id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('team.loadingTeam')}</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('team.notFound')}</h1>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('team.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = team.owner.id === user?.id;
  const userMember = team.members.find(m => m.user.id === user?.id);
  const isAdmin = userMember?.role === TeamRole.Admin;
  const canManage = isOwner || isAdmin;

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case TeamRole.Owner:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case TeamRole.Admin:
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleName = (role: TeamRole) => {
    switch (role) {
      case TeamRole.Owner:
        return t('team.owner');
      case TeamRole.Admin:
        return t('team.admin');
      default:
        return t('team.member');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('team.back')}
              </Button>
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                  {team.description && (
                    <p className="text-gray-600 text-sm">{team.description}</p>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {canManage && (
              <Button
                onClick={() => navigate(`/team/${team.id}/manage`)}
                className="bg-blue-600 hover:bg-blue-700 text-white mb-4"
              >
                <Settings className="w-4 h-4 mr-2" />
                {t('team.teamMembers')}
              </Button>
            )}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Team Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t('team.teamMembers')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('dashboard.teams.teamName')}</label>
                    <p className="text-gray-900">{team.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('team.owner')}</label>
                    <p className="text-gray-900">{team.owner.firstName} {team.owner.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('dashboard.teams.members')}</label>
                    <p className="text-gray-900">{team.members.length}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('dashboard.teams.boards')}</label>
                    <p className="text-gray-900">{teamBoards.length}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('dashboard.teams.created')}</label>
                    <p className="text-gray-900">
                      {new Date(team.createdAt).toLocaleDateString(t('dates.format'))}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('team.updated') || 'Ostatnia aktualizacja'}</label>
                    <p className="text-gray-900">
                      {new Date(team.updatedAt).toLocaleDateString(t('dates.format'))}
                    </p>
                  </div>
                </div>
                {team.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('dashboard.teams.teamDescription')}</label>
                    <p className="text-gray-900 mt-1">{team.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Boards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    {t('dashboard.boards.title')}
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {teamBoards.length} {t('dashboard.boards.boardCount')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamBoards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teamBoards.map((board) => (
                      <motion.div
                        key={board.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/board/${board.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-gray-900">{board.title}</h3>
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: board.color }}
                              ></div>
                            </div>
                            {board.description && (
                              <p className="text-sm text-gray-600 mb-2">{board.description}</p>
                            )}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>
                                {new Date(board.createdAt).toLocaleDateString(t('dates.format'))}
                              </span>
                              <span>{board.lists?.length || 0} {t('list.plural')}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>{t('dashboard.boards.noBoards')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Members */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t('team.teamMembers')}
                  </span>
                  <span className="text-sm font-normal text-gray-500">
                    {team.members.length} {t('team.members')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <span className="text-sm text-gray-600">
                          {getRoleName(member.role)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
