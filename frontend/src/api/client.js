import axios from 'axios';

// Base API URL - fallback to local Django server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/';

/**
 * Pre-configured Axios instance for Employee Management System API.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Request Interceptor:
 * Automatically attaches DRF Token authentication header to outgoing requests.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * Handles global error responses (e.g. 401 Unauthorized token expiry).
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;

      // When unauthorized or token is expired/invalid, clear session and redirect to login
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
