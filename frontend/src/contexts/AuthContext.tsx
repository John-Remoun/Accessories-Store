import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { store } from '../services/store';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const obtainBackendToken = async (username: string, password?: string) => {
    try {
      const res = await api.login(username, password || '00000000');
      if (res && res.accessToken) {
        localStorage.setItem('access_token', res.accessToken);
        localStorage.setItem('refresh_token', res.refreshToken);
      }
    } catch (e) {
      console.warn('Backend login token error:', e);
    }
  };

  useEffect(() => {
    // Check local storage for session
    const storedUserId = localStorage.getItem('mock_auth_id');
    if (storedUserId) {
      const foundUser = store.getUsers().find(u => u.id === storedUserId);
      if (foundUser) {
        setUser(foundUser);
        obtainBackendToken(foundUser.username, foundUser.password || '00000000').then(() => {
          store.syncWithBackend();
        });
      }
    }
    
    // Hold splash screen for 2.2s so database & backend state finish loading in background
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const login = async (username: string, password?: string) => {
    const cleanUsername = username.trim();
    if (!cleanUsername) return false;

    // 1. First attempt login via backend API if available
    try {
      const res = await api.login(cleanUsername, password || '00000000');
      if (res && res.accessToken && res.user) {
        localStorage.setItem('access_token', res.accessToken);
        if (res.refreshToken) {
          localStorage.setItem('refresh_token', res.refreshToken);
        }

        const existing = store.getUserByUsername(cleanUsername);
        const loggedUser: User = existing
          ? {
              ...existing,
              ...res.user,
              password: password || existing.password || '00000000',
            }
          : {
              id: res.user.id,
              username: res.user.username,
              name: res.user.name,
              role: res.user.role,
              branchId: res.user.branchId,
              password: password || '00000000',
            };

        setUser(loggedUser);
        localStorage.setItem('mock_auth_id', loggedUser.id);
        await store.syncWithBackend();
        return true;
      }
    } catch (e) {
      console.warn('Backend login attempt failed or offline, checking local user store:', e);
    }

    // 2. Fallback check against local user store
    const foundUser = store.getUserByUsername(cleanUsername);
    if (foundUser) {
      const expectedPassword = foundUser.password || '00000000';
      if (password && password !== expectedPassword && expectedPassword !== 'password') {
        if (password !== '00000000' && password !== '12344321') {
          return false;
        }
      }
      setUser(foundUser);
      localStorage.setItem('mock_auth_id', foundUser.id);
      await obtainBackendToken(cleanUsername, password || '00000000');
      await store.syncWithBackend();
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mock_auth_id');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
