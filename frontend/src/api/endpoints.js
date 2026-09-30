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

/**
 * Attendance Endpoints
 */
export const attendanceApi = {
  // Supports query params: { employee, date, date_after, date_before, status, ordering, page }
  getAll: async (params = {}) => {
    const response = await api.get('attendance/', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`attendance/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('attendance/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`attendance/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`attendance/${id}/`);
    return response.data;
  },
  checkIn: async (id) => {
    const response = await api.post(`attendance/${id}/check_in/`);
    return response.data;
  },
  checkOut: async (id) => {
    const response = await api.post(`attendance/${id}/check_out/`);
    return response.data;
  },
  // Supports query params: { year, month }
  getSummary: async (params = {}) => {
    const response = await api.get('attendance/summary/', { params });
    return response.data;
  },
};

/**
 * Payroll (Payslip) Endpoints
 */
export const payrollApi = {
  // Supports query params: { employee, department, year, month, ordering, page }
  getAll: async (params = {}) => {
    const response = await api.get('payslips/', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`payslips/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('payslips/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`payslips/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`payslips/${id}/`);
    return response.data;
  },
  // Bulk-generate payslips for all active employees for a period
  generate: async ({ year, month } = {}) => {
    const response = await api.post('payslips/generate/', { year, month });
    return response.data;
  },
  // Supports query params: { year, month }
  getSummary: async (params = {}) => {
    const response = await api.get('payslips/summary/', { params });
    return response.data;
  },
};

/**
 * Performance Review Endpoints
 */
export const performanceApi = {
  // Supports query params: { employee, department, status, review_period, search, ordering, page }
  getAll: async (params = {}) => {
    const response = await api.get('performance-reviews/', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`performance-reviews/${id}/`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('performance-reviews/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`performance-reviews/${id}/`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`performance-reviews/${id}/`);
    return response.data;
  },
  complete: async (id) => {
    const response = await api.post(`performance-reviews/${id}/complete/`);
    return response.data;
  },
  acknowledge: async (id) => {
    const response = await api.post(`performance-reviews/${id}/acknowledge/`);
    return response.data;
  },
  getSummary: async () => {
    const response = await api.get('performance-reviews/summary/');
    return response.data;
  },
};
