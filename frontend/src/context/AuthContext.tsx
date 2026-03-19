import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types';
import api from '../lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('sportcal_token');
    const storedUser = localStorage.getItem('sportcal_user');

    if (storedToken && storedUser) {
      try {
        const user: User = JSON.parse(storedUser);
        setToken(storedToken);
        setCurrentUser(user);
        setIsAuthenticated(true);
        setIsAdmin(user.role === 'admin' || user.role === 'super_admin');
      } catch {
        localStorage.removeItem('sportcal_token');
        localStorage.removeItem('sportcal_user');
      }
    }
  }, []);

  const login = async (accessCode: string): Promise<void> => {
    const { data } = await api.post('/auth/login', { accessCode });
    const { token: newToken, user } = data;

    localStorage.setItem('sportcal_token', newToken);
    localStorage.setItem('sportcal_user', JSON.stringify(user));

    setToken(newToken);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsAdmin(user.role === 'admin' || user.role === 'super_admin');
  };

  const logout = () => {
    // Fire-and-forget logout to backend
    api.post('/auth/logout').catch(() => {});

    localStorage.removeItem('sportcal_token');
    localStorage.removeItem('sportcal_user');

    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
