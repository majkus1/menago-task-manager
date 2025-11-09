import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { BoardMemberSelection } from '@/components/BoardMemberSelection';
import type { CreateBoardDto, CreateTeamDto } from '@/types';
import { Plus, Search, LogOut, User, Users, Settings, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function DashboardPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateTeamForm, setShowCreateTeamForm] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [addAllMembers, setAddAllMembers] = useState(false);
  const { user, logout } = useAuth();
  const { currentTeam, teams, canCreateBoards, setCurrentTeam } = useTeam();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ['boards', currentTeam?.id],
    queryFn: async () => {
      try {
        const result = await apiClient.getBoards();
        // Ensure we always return an array
        return Array.isArray(result) ? result : [];
      } catch (err) {
        // Return empty array on error instead of throwing
        console.error('Error fetching boards:', err);
        return [];
      }
    },
    enabled: !!currentTeam,
    refetchOnMount: 'always', // Always refetch when component mounts to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    staleTime: 0, // Data is always considered stale, ensuring fresh data on every mount
  });

  // Filter boards for current team
  const teamBoards = boards.filter(board => board.team?.id === currentTeam?.id);

  const createBoardMutation = useMutation({
    mutationFn: (data: CreateBoardDto) => apiClient.createBoard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      setShowCreateForm(false);
      setNewBoardTitle('');
      setNewBoardDescription('');
      setSelectedMembers([]);
      setAddAllMembers(false);
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: (data: CreateTeamDto) => apiClient.createTeam(data),
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateTeamForm(false);
      setNewTeamName('');
      setNewTeamDescription('');
      // Automatically switch to the newly created team
      setCurrentTeam(newTeam);
    },
  });

  const filteredBoards = teamBoards.filter(board =>
    board.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBoard = () => {
    if (newBoardTitle.trim() && currentTeam) {
      createBoardMutation.mutate({
        title: newBoardTitle.trim(),
        description: newBoardDescription.trim() || undefined,
        color: '#0079bf',
        teamId: currentTeam.id,
        memberUserIds: addAllMembers ? undefined : selectedMembers,
        addAllTeamMembers: addAllMembers,
      });
    }
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;

    createTeamMutation.mutate({
      name: newTeamName,
      description: newTeamDescription,
    });
  };

  const handleMembersChange = (memberIds: string[], addAll: boolean) => {
    setSelectedMembers(memberIds);
    setAddAllMembers(addAll);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (boardsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('dashboard.loadingBoards')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">{t('common.appName')}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.firstName}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title={t('dashboard.logOut')}
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">{t('dashboard.logOut')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Teams Section */}
        {teams.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {t('dashboard.teams.title')}
                </h2>
                <p className="text-gray-600">
                  {t('dashboard.teams.subtitle')}
                </p>
              </div>
              <Button
                onClick={() => setShowCreateTeamForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.teams.newTeam')}
              </Button>
            </div>

            {/* Create Team Form - appears under "Nowy zespół" button */}
            {showCreateTeamForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6"
              >
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-800 flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      {t('dashboard.teams.createNew')}
                    </CardTitle>
                    <CardDescription className="text-blue-700">
                      {t('dashboard.teams.createSubtitle')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('dashboard.teams.teamName')} *
                      </label>
                      <Input
                        placeholder={t('dashboard.teams.teamNamePlaceholder')}
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('dashboard.teams.teamDescription')} ({t('common.optional')})
                      </label>
                      <Input
                        placeholder={t('dashboard.teams.teamDescriptionPlaceholder')}
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateTeam}
                        disabled={!newTeamName.trim() || createTeamMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {createTeamMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t('dashboard.teams.creating')}
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('dashboard.teams.createButton')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreateTeamForm(false);
                          setNewTeamName('');
                          setNewTeamDescription('');
                        }}
                        disabled={createTeamMutation.isPending}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => {
                const isOwner = team.owner.id === user?.id;
                const isAdmin = team.members.find(m => m.user.id === user?.id)?.role === 1; // Admin role
                const canManage = isOwner || isAdmin;
                const isCurrentTeam = currentTeam?.id === team.id;
                
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card 
                      className={`board-card cursor-pointer transition-all ${
                        isCurrentTeam 
                          ? 'border-green-200 bg-green-50 ring-2 ring-green-200' 
                          : 'hover:border-blue-200 hover:bg-blue-50'
                      }`}
                      onClick={() => setCurrentTeam(team)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Users className={`w-5 h-5 ${isCurrentTeam ? 'text-green-600' : 'text-blue-600'}`} />
                            <CardTitle className={`text-lg ${isCurrentTeam ? 'text-green-800' : 'text-gray-900'}`}>
                              {team.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOwner && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                            {isCurrentTeam && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        {team.description && (
                          <CardDescription className={`text-sm ${isCurrentTeam ? 'text-green-700' : 'text-gray-600'}`}>
                            {team.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          <div className={`flex items-center justify-between text-sm ${isCurrentTeam ? 'text-green-700' : 'text-gray-600'}`}>
                            <span>{t('dashboard.teams.members')}</span>
                            <span className="font-medium">{team.members.length}</span>
                          </div>
                          <div className={`flex items-center justify-between text-sm ${isCurrentTeam ? 'text-green-700' : 'text-gray-600'}`}>
                            <span>{t('dashboard.teams.boards')}</span>
                            <span className="font-medium">
                              {isCurrentTeam ? teamBoards.length : team.boards.length}
                            </span>
                          </div>
                          <div className={`flex items-center justify-between text-sm ${isCurrentTeam ? 'text-green-700' : 'text-gray-600'}`}>
                            <span>{t('dashboard.teams.created')}</span>
                            <span className="font-medium">
                              {new Date(team.createdAt).toLocaleDateString(t('dates.format'))}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/team/${team.id}/manage`);
                              }}
                              className={`flex-1 ${
                                isCurrentTeam 
                                  ? 'border-green-300 text-green-700 hover:bg-green-100' 
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              {t('dashboard.teams.manage')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/team/${team.id}`);
                            }}
                            className={`flex-1 ${
                              isCurrentTeam 
                                ? 'border-green-300 text-green-700 hover:bg-green-100' 
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Users className="w-4 h-4 mr-2" />
                            {t('dashboard.teams.details')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Users className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('dashboard.teams.noTeams')}
              </h3>
              <p className="text-gray-600 mb-6">
                {t('dashboard.teams.noTeamsSubtitle')}
              </p>
              {!showCreateTeamForm && (
                <Button
                  onClick={() => setShowCreateTeamForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dashboard.teams.createFirstTeam')}
                </Button>
              )}
            </div>

            {/* Create Team Form - appears when no teams exist */}
            {showCreateTeamForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 max-w-2xl mx-auto"
              >
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-800 flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      {t('dashboard.teams.createNew')}
                    </CardTitle>
                    <CardDescription className="text-blue-700">
                      {t('dashboard.teams.createSubtitle')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('dashboard.teams.teamName')} *
                      </label>
                      <Input
                        placeholder={t('dashboard.teams.teamNamePlaceholder')}
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('dashboard.teams.teamDescription')} ({t('common.optional')})
                      </label>
                      <Input
                        placeholder={t('dashboard.teams.teamDescriptionPlaceholder')}
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateTeam}
                        disabled={!newTeamName.trim() || createTeamMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {createTeamMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t('dashboard.teams.creating')}
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            {t('dashboard.teams.createButton')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreateTeamForm(false);
                          setNewTeamName('');
                          setNewTeamDescription('');
                        }}
                        disabled={createTeamMutation.isPending}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}

        {/* Team Boards Section */}
        {currentTeam && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {t('dashboard.boards.title')} {currentTeam.name}
            </h2>
            <p className="text-gray-600">
              {t('dashboard.boards.subtitle')}
            </p>
          </div>
        )}

        {/* Search and Create - moved here */}
        {currentTeam && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('dashboard.boards.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {canCreateBoards && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dashboard.boards.newBoard')}
                </Button>
              )}
            </div>

            {/* Create Board Form - appears under search/create */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dashboard.boards.createNew')}</CardTitle>
                    <CardDescription>
                      {t('dashboard.boards.createSubtitle')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('dashboard.boards.boardName')} *
                        </label>
                        <Input
                          placeholder={t('dashboard.boards.boardNamePlaceholder')}
                          value={newBoardTitle}
                          onChange={(e) => setNewBoardTitle(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('dashboard.boards.boardDescription')}
                        </label>
                        <Input
                          placeholder={t('dashboard.boards.boardDescriptionPlaceholder')}
                          value={newBoardDescription}
                          onChange={(e) => setNewBoardDescription(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Member Selection - Integrated */}
                    {currentTeam && (
                      <div className="border-t pt-4">
                        <BoardMemberSelection
                          teamId={currentTeam.id}
                          onMembersChange={handleMembersChange}
                          initialMembers={selectedMembers}
                          initialAddAll={addAllMembers}
                          embedded={true}
                        />
                      </div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <Button
                        onClick={handleCreateBoard}
                        disabled={!newBoardTitle.trim() || createBoardMutation.isPending}
                        className="flex-1"
                      >
                        {createBoardMutation.isPending ? t('dashboard.boards.creating') : t('dashboard.boards.createButton')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewBoardTitle('');
                          setNewBoardDescription('');
                          setSelectedMembers([]);
                          setAddAllMembers(false);
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}

        {/* Boards Grid */}
        {!currentTeam ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Users className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('dashboard.boards.selectTeam')}
            </h3>
            <p className="text-gray-600">
              {t('dashboard.boards.selectTeamSubtitle')}
            </p>
          </div>
        ) : boardsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('dashboard.loadingBoards')}</p>
          </div>
        ) : filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Plus className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? t('dashboard.boards.noBoardsFound') : t('dashboard.boards.noBoards')}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? t('dashboard.boards.searchSuggestions')
                : t('dashboard.boards.createFirstSubtitle')}
            </p>
            {!searchTerm && canCreateBoards && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.boards.createFirstBoard')}
              </Button>
            )}
            {!searchTerm && !canCreateBoards && (
              <p className="text-gray-500 text-sm">
                {t('dashboard.boards.onlyAdminsCanCreate')}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBoards.map((board) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className="board-card cursor-pointer"
                  onClick={() => navigate(`/board/${board.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div
                      className="w-full h-20 rounded-md mb-3"
                      style={{ backgroundColor: board.color }}
                    />
                    <CardTitle className="text-lg">{board.title}</CardTitle>
                    {board.description && (
                      <CardDescription className="text-sm">
                        {board.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        {new Date(board.updatedAt).toLocaleDateString(t('dates.format'))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
