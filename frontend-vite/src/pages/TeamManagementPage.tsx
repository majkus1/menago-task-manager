import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { TeamManagement } from '@/components/TeamManagement';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export function TeamManagementPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: team, isLoading, error } = useQuery({
    queryKey: ['team', id],
    queryFn: () => apiClient.getTeam(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('team.loadingTeam')}</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('team.notFound')}</h2>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('team.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  // Check if user has access to team management
  const isOwner = team.owner.id === user?.id;
  const isAdmin = team.members.find(m => m.user.id === user?.id)?.role === 1;

  if (!isOwner && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('team.unauthorized')}</h2>
          <p className="text-gray-600 mb-4">
            {t('team.unauthorized')}
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('team.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('team.back')}
              </Button>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{t('team.teamMembers')}</h1>
                  <p className="text-sm text-gray-600">{team.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <TeamManagement team={team} currentUserId={user?.id || ''} />
        </motion.div>
      </main>
    </div>
  );
}
