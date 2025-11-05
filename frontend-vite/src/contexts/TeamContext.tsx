import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { TeamDto } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface TeamContextType {
  currentTeam: TeamDto | null;
  setCurrentTeam: (team: TeamDto | null) => void;
  teams: TeamDto[];
  isLoading: boolean;
  error: Error | null;
  canCreateBoards: boolean;
  canManageTeam: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

interface TeamProviderProps {
  children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
  const { user } = useAuth();
  const [currentTeam, setCurrentTeam] = useState<TeamDto | null>(null);

  // Fetch user's teams
  const { data: teams, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      try {
        const result = await apiClient.getTeams();
        // Ensure we always return an array
        return Array.isArray(result) ? result : [];
      } catch (err) {
        // Return empty array on error instead of throwing
        console.error('Error fetching teams:', err);
        return [];
      }
    },
    enabled: !!user,
  });

  // Set first team as current team if none is selected
  useEffect(() => {
    if (teams && teams.length > 0 && !currentTeam) {
      setCurrentTeam(teams[0]);
    }
  }, [teams, currentTeam]);

  // Calculate permissions
  const canCreateBoards = currentTeam ? 
    currentTeam.owner.id === user?.id || 
    currentTeam.members.some(m => m.user.id === user?.id && m.role === 1) // Admin role
    : false;

  const canManageTeam = currentTeam ? 
    currentTeam.owner.id === user?.id || 
    currentTeam.members.some(m => m.user.id === user?.id && m.role === 1) // Admin role
    : false;

  const value: TeamContextType = {
    currentTeam,
    setCurrentTeam,
    teams: teams || [],
    isLoading,
    error: error as Error | null,
    canCreateBoards,
    canManageTeam,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
