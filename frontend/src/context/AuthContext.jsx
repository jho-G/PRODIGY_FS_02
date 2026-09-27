import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Validate existing token on initial application load
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err) {
          console.warn('Stored token is invalid or expired:', err);
          // Only clear if 401 or network failure isn't temporary
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  /**
   * Log in user with credentials, save token and user profile
   */
  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    const authToken = data.token;
    const authUser = data.user;

    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));

    setToken(authToken);
    setUser(authUser);
    return data;
  };

  /**
   * Log out user: notify backend, clear localStorage, and reset state
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Backend logout notification error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token),
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
