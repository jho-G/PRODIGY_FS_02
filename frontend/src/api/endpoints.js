import api from './client';

/**
 * Authentication Endpoints
 */
export const authApi = {
  login: async (credentials) => {
    const response = await api.post('auth/login/', credentials);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('auth/logout/');
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('auth/user/');
    return response.data;
  },
};

/**
 * Department Endpoints
 */
export const departmentApi = {
  getAll: async () => {
    const response = await api.get('departments/');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`departments/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('departments/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`departments/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`departments/${id}/`);
    return response.data;
  },
};

/**
 * Employee Endpoints
 */
export const employeeApi = {
  // Supports query params: { search, department, employment_status, is_active, all, ordering, page, min_salary, max_salary, min_experience }
  getAll: async (params = {}) => {
    const response = await api.get('employees/', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`employees/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('employees/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`employees/${id}/`, data);
    return response.data;
  },
  // Soft delete by default; set hard = true for permanent deletion
  delete: async (id, hard = false) => {
    const response = await api.delete(`employees/${id}/`, {
      params: hard ? { hard: 'true' } : {},
    });
    return response.data;
  },
  restore: async (id) => {
    const response = await api.post(`employees/${id}/restore/`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('employees/stats/');
    return response.data;
  },
  // Downloads the filtered employee directory as a CSV file
  exportCsv: async (params = {}) => {
    const response = await api.get('employees/export/', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

/**
 * Leave Request Endpoints
 */
export const leaveApi = {
  // Supports query params: { employee, status, leave_type, search, ordering, page }
  getAll: async (params = {}) => {
    const response = await api.get('leaves/', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`leaves/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('leaves/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`leaves/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`leaves/${id}/`);
    return response.data;
  },
  approve: async (id) => {
    const response = await api.post(`leaves/${id}/approve/`);
    return response.data;
  },
  reject: async (id) => {
    const response = await api.post(`leaves/${id}/reject/`);
    return response.data;
  },
  cancel: async (id) => {
    const response = await api.post(`leaves/${id}/cancel/`);
    return response.data;
  },
};
