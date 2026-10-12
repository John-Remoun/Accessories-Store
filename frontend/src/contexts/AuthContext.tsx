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
        const isSuper = ['bola', 'mina', 'test'].includes(foundUser.username.toLowerCase()) ||
                        (foundUser.id.startsWith('admin_') && !foundUser.branchId) ||
                        (foundUser.role === 'admin' && !foundUser.branchId);
        const fixedUser: User = {
          ...foundUser,
          role: isSuper ? 'admin' : 'employee',
          branchId: isSuper ? undefined : (foundUser.branchId || 'b4'),
        };
        setUser(fixedUser);
        if (fixedUser.branchId) {
          localStorage.setItem('last_active_branch', fixedUser.branchId);
        }
        obtainBackendToken(fixedUser.username, fixedUser.password || '00000000').then(() => {
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
        
        // Strict Role Determination:
        // A user is ONLY admin if:
        // 1) Username is default super admin ('bola', 'mina', 'test')
        // 2) Or id starts with 'admin_' AND has no branchId
        // 3) Or existing user in store has role === 'admin' and NO branchId
        const isSuperAdmin = (
          ['bola', 'mina', 'test'].includes(cleanUsername.toLowerCase()) ||
          (existing?.id?.startsWith('admin_') && !existing?.branchId) ||
          (existing?.role === 'admin' && !existing?.branchId)
        );

        const assignedRole: 'admin' | 'employee' = isSuperAdmin ? 'admin' : 'employee';
        const assignedBranchId = isSuperAdmin ? undefined : (existing?.branchId || res.user.branchId || 'b4');

        const loggedUser: User = existing
          ? {
              ...existing,
              role: assignedRole,
              branchId: assignedBranchId,
              password: password || existing.password || '00000000',
            }
          : {
              id: res.user.id,
              username: res.user.username,
              name: res.user.name,
              role: assignedRole,
              branchId: assignedBranchId,
              password: password || '00000000',
            };

        setUser(loggedUser);
        localStorage.setItem('mock_auth_id', loggedUser.id);
        if (loggedUser.branchId) {
          localStorage.setItem('last_active_branch', loggedUser.branchId);
        }
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
      if (password && password !== expectedPassword) {
        return false;
      }
      const isSuper = ['bola', 'mina', 'test'].includes(foundUser.username.toLowerCase()) ||
                      (foundUser.id.startsWith('admin_') && !foundUser.branchId) ||
                      (foundUser.role === 'admin' && !foundUser.branchId);
      const safeUser: User = {
        ...foundUser,
        role: isSuper ? 'admin' : 'employee',
        branchId: isSuper ? undefined : (foundUser.branchId || 'b4'),
      };
      setUser(safeUser);
      localStorage.setItem('mock_auth_id', safeUser.id);
      if (safeUser.branchId) {
        localStorage.setItem('last_active_branch', safeUser.branchId);
      }
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
