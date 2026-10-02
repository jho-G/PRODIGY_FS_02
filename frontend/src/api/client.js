import axios from 'axios';

// Base API URL — fallback to local Django server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/';

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

export default api;
