import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

/**
 * Decode a JWT payload without verifying the signature.
 * Used only to read expiry — actual signature verification happens server-side.
 * @param {string} token - JWT string
 * @returns {object|null} Decoded payload or null if malformed
 */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    // Base64url → Base64 → JSON
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Returns true if the given JWT is expired (or will expire within the next
 * 30 seconds — a safety buffer to avoid using a token right as it expires).
 * @param {string} token - JWT access token
 */
function isTokenExpiredOrExpiring(token) {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const nowInSeconds = Date.now() / 1000;
  // 30-second buffer: refresh proactively before actual expiry
  return payload.exp < nowInSeconds + 30;
}

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('access_token') || null
  );
  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem('refresh_token') || null
  );
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Ref to track the proactive refresh timer so we can cancel it on logout
  const refreshTimerRef = useRef(null);

  /**
   * Persist tokens to localStorage and update state.
   */
  const persistTokens = useCallback(({ access, refresh, userData }) => {
    if (access) {
      localStorage.setItem('access_token', access);
      setAccessToken(access);
    }
    if (refresh) {
      localStorage.setItem('refresh_token', refresh);
      setRefreshToken(refresh);
    }
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  }, []);

  /**
   * Clear all auth state from memory and localStorage.
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /**
   * Schedule a proactive access token refresh slightly before it expires.
   * This keeps the user logged in seamlessly without waiting for a 401.
   * @param {string} token - The current access token to schedule around
   */
  const scheduleTokenRefresh = useCallback((token) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const payload = decodeJwt(token);
    if (!payload?.exp) return;

    const nowInSeconds = Date.now() / 1000;
    const secondsUntilExpiry = payload.exp - nowInSeconds;
    // Refresh 60 seconds before expiry (or immediately if already close)
    const refreshInMs = Math.max((secondsUntilExpiry - 60) * 1000, 0);

    refreshTimerRef.current = setTimeout(async () => {
      const storedRefresh = localStorage.getItem('refresh_token');
      if (!storedRefresh) return;
      try {
        const data = await authApi.refreshToken(storedRefresh);
        persistTokens({ access: data.access, refresh: data.refresh });
        scheduleTokenRefresh(data.access);
      } catch {
        // Refresh failed — session is truly expired, force logout
        clearSession();
      }
    }, refreshInMs);
  }, [persistTokens, clearSession]);

  /**
   * On mount: verify the stored access token.
   * If expired, attempt a silent refresh. If both fail, clear session.
   */
  useEffect(() => {
    const initializeSession = async () => {
      const storedAccess = localStorage.getItem('access_token');
      const storedRefresh = localStorage.getItem('refresh_token');

      if (!storedAccess) {
        setLoading(false);
        return;
      }

      if (!isTokenExpiredOrExpiring(storedAccess)) {
        // Token is still valid — load the current user and schedule refresh
        try {
          const userData = await authApi.getCurrentUser();
          persistTokens({ userData });
          scheduleTokenRefresh(storedAccess);
        } catch {
          clearSession();
        }
      } else if (storedRefresh) {
        // Access token expired — try a silent refresh
        try {
          const data = await authApi.refreshToken(storedRefresh);
          const userData = await authApi.getCurrentUser();
          persistTokens({ access: data.access, refresh: data.refresh, userData });
          scheduleTokenRefresh(data.access);
        } catch {
          clearSession();
        }
      } else {
        clearSession();
      }

      setLoading(false);
    };

    initializeSession();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Log in: exchange credentials for a JWT pair, persist, schedule refresh.
   */
  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    persistTokens({
      access: data.access,
      refresh: data.refresh,
      userData: data.user,
    });
    scheduleTokenRefresh(data.access);
    return data;
  }, [persistTokens, scheduleTokenRefresh]);

  /**
   * Log out: blacklist the refresh token on the server, clear session.
   */
  const logout = useCallback(async () => {
    const storedRefresh = localStorage.getItem('refresh_token');
    try {
      if (storedRefresh) {
        await authApi.logout(storedRefresh);
      }
    } catch (err) {
      // Log but don't block the local session clear
      console.warn('Backend logout error (token may already be expired):', err);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = {
    accessToken,
    user,
    isAuthenticated: Boolean(accessToken) && !isTokenExpiredOrExpiring(accessToken || ''),
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
