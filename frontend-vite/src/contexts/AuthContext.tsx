import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserDto, AuthResponseDto, LoginDto, RegisterTeamDto } from '@/types';
import { apiClient } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: UserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginDto) => Promise<void>;
  register: (data: RegisterTeamDto) => Promise<void>;
  logout: () => void;
  setUser: (user: UserDto | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const isAuthenticated = !!user;

  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      // Skip auth check on password reset pages to prevent unnecessary API calls
      const currentPath = window.location.pathname;
      const isPasswordResetPage = currentPath === '/forgot-password' || 
                                  currentPath === '/reset-password';
      
      if (isPasswordResetPage && isMounted) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      try {
        // Try to get current user (cookie will be sent automatically)
        const userData = await apiClient.getCurrentUser();
        if (isMounted) {
          setUser(userData);
          setIsLoading(false);
        }
      } catch (error: any) {
        // No valid cookie or user not authenticated
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    // Add small delay to prevent rapid requests
    const timeoutId = setTimeout(initAuth, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const login = async (data: LoginDto) => {
    try {
      const response: AuthResponseDto = await apiClient.login(data);
      
      // Cookie is set automatically by backend, just store user data
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (data: RegisterTeamDto) => {
    try {
      const response: AuthResponseDto = await apiClient.registerTeam(data);
      
      // Cookie is set automatically by backend, just store user data
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call backend logout to clear cookie
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear local state
    setUser(null);
    
    // Clear all React Query cache
    queryClient.clear();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
