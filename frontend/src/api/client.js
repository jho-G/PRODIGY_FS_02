import axios from 'axios';

/**
 * Sanitize API base URL to ensure a guaranteed single trailing slash,
 * preventing silent concatenation bugs when endpoints are appended.
 * @param {string|undefined} url
 * @returns {string} Sanitized base URL ending with exactly one slash
 */
export function sanitizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    // In production environments behind reverse proxy, default to same-origin /api/
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      if (import.meta?.env?.PROD) {
        return `${window.location.origin}/api/`;
      }
    }
    return 'http://127.0.0.1:8000/api/';
  }
  const trimmed = url.trim();
  return trimmed.replace(/\/+$/, '') + '/';
}

export const API_BASE_URL = sanitizeApiBaseUrl(import.meta.env.VITE_API_URL);


/**
 * Pre-configured Axios instance for Employee Management System API.
 * Uses JWT Bearer authentication (access + refresh token pair).
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// ---------------------------------------------------------------------------
// Request Interceptor
// Automatically attaches the short-lived JWT access token to every request.
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response Interceptor
// On a 401 Unauthorized response, automatically attempt a silent token
// refresh using the stored refresh token. If the refresh also fails, the
// user is logged out and redirected to the login page.
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue = [];

/**
 * Process the queue of failed requests once a token refresh completes.
 * @param {Error|null} error - Error if refresh failed, null if successful.
 * @param {string|null} token - New access token if successful.
 */
function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Clear all auth tokens from localStorage and redirect to login.
 * Called when refresh fails or the user explicitly logs out.
 */
function clearSessionAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  // Pass through successful responses unchanged
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Only attempt token refresh on 401 and avoid infinite retry loops
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Never try to refresh the refresh endpoint itself
      !originalRequest.url?.includes('auth/token/refresh') &&
      !originalRequest.url?.includes('auth/login')
    ) {
      // If already refreshing, queue this request to retry after refresh
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Exchange the refresh token for a new access token
        const { data } = await axios.post(
          `${API_BASE_URL}auth/token/refresh/`,
          { refresh: refreshToken }
        );

        const newAccessToken = data.access;

        // Persist the new access token (and rotated refresh if returned)
        localStorage.setItem('access_token', newAccessToken);
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }

        // Update the Authorization header for the original request and all future requests
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearSessionAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extract a user-friendly, sanitized error message from an Axios error,
 * preventing raw backend stack traces or internal errors from leaking.
 * @param {Error|Object} error
 * @returns {string} Safe error message suitable for UI display
 */
export function getSanitizedErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'The server took too long to respond. Please check your connection and try again.';
  }
  if (!error.response) {
    return 'Unable to connect to the server. Please check your network connection.';
  }
  const status = error.response.status;
  if (status >= 500) {
    return 'A server error occurred. Please try again later or contact IT support.';
  }
  const data = error.response.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.error) return data.error;
    const firstKey = Object.keys(data)[0];
    if (firstKey && Array.isArray(data[firstKey])) {
      return `${firstKey}: ${data[firstKey][0]}`;
    }
  }
  return error.message || 'An unexpected error occurred.';
}

export default api;
