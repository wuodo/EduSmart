import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { API_BASE_URL } from '@/utils/api';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authCookie = Cookies.get('isAuthenticated');
    if (authCookie === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string, role: string) => {
    try {
      console.log('Making login request to backend...');
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (response.ok) {
        setIsAuthenticated(true);
        Cookies.set('isAuthenticated', 'true', { expires: 7 }); // Cookie expires in 7 days
        console.log('Login successful, cookie set');
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    Cookies.remove('isAuthenticated', { path: '/' });
    Cookies.remove('role', { path: '/' });
    Cookies.remove('tenant', { path: '/' });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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