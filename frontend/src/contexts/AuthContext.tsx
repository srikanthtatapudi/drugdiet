import React, { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

export interface User {
  id: number;
  username: string;
  email: string;
  age: number;
  weight: number;
  height: number;
  gender: string;
  medical_conditions: string;
  allergies: string;
  dietary_preferences: string;
  activity_level: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common.Authorization;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await apiClient.get<User>('/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    void refreshProfile();
  }, [refreshProfile, token]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiClient.post<{ access_token: string }>('/login', { username, password });
    const accessToken = response.data.access_token;
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    await refreshProfile();
  }, [refreshProfile]);

  const register = useCallback(async (userData: Record<string, unknown>) => {
    const response = await apiClient.post<{ access_token: string }>('/register', userData);
    const accessToken = response.data.access_token;
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    await refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [loading, login, logout, refreshProfile, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
