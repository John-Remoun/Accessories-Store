import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { store } from '../services/store';

interface AuthContextType {
  user: User | null;
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const storedUserId = localStorage.getItem('mock_auth_id');
    if (storedUserId) {
      const foundUser = store.getUsers().find(u => u.id === storedUserId);
      if (foundUser) setUser(foundUser);
    }
    
    // Hold splash screen for 2.2s so database & backend state finish loading in background
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const login = (username: string, password?: string) => {
    const foundUser = store.getUserByUsername(username.trim());
    if (foundUser) {
      const expectedPassword = foundUser.password || 'password';
      if (password && password !== expectedPassword) {
        return false;
      }
      setUser(foundUser);
      localStorage.setItem('mock_auth_id', foundUser.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mock_auth_id');
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
