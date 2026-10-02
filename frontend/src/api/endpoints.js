import api from './client';

/**
 * Authentication Endpoints
 */
export const authApi = {
  /**
   * Exchange credentials for a JWT access + refresh token pair.
   * Returns: { access, refresh, user, message }
   */
  login: async (credentials) => {
    const response = await api.post('auth/login/', credentials);
    return response.data;
  },

  /**
   * Blacklist the given refresh token, invalidating the session server-side.
   * @param {string} refreshToken - The refresh token to blacklist
   */
  logout: async (refreshToken) => {
    const response = await api.post('auth/logout/', { refresh: refreshToken });
    return response.data;
  },

  /**
   * Exchange a refresh token for a new access token (and rotated refresh token).
   * Returns: { access, refresh }
   */
  refreshToken: async (refreshToken) => {
    const response = await api.post('auth/token/refresh/', { refresh: refreshToken });
    return response.data;
  },

  /**
   * Verify that a token (access or refresh) is still valid.
   * Returns 200 if valid, 401 if expired or blacklisted.
   */
  verifyToken: async (token) => {
    const response = await api.post('auth/token/verify/', { token });
    return response.data;
  },

  /**
   * Fetch the current authenticated user's details.
   * Returns: { id, username, email, first_name, last_name, role, employee_id }
   */
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
 * Holiday Endpoints
 */
export const holidayApi = {
  getAll: async (params = {}) => {
    const response = await api.get('holidays/', { params });
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('holidays/', data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`holidays/${id}/`);
    return response.data;
  },
  getUpcoming: async (limit = 5) => {
    const response = await api.get('holidays/upcoming/', { params: { limit } });
    return response.data;
  },
};

/**
 * Employment History Endpoints
 */
export const historyApi = {
  // Supports query params: { employee, event_type, ordering }
  getAll: async (params = {}) => {
    const response = await api.get('employment-events/', { params });
    return response.data;
  },
};

/**
 * Employee Document Endpoints (multipart upload)
 */
export const documentApi = {
  // Supports query params: { employee, document_type, ordering }
  getAll: async (params = {}) => {
    const response = await api.get('documents/', { params });
    return response.data;
  },
  upload: async (formData) => {
    const response = await api.post('documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`documents/${id}/`);
    return response.data;
  },
};

/**
 * Notification Endpoints
 */
export const notificationApi = {
  getAll: async (params = {}) => {
    const response = await api.get('notifications/', { params });
    return response.data;
  },
  getUnreadCount: async () => {
    const response = await api.get('notifications/unread_count/');
    return response.data;
  },
  markRead: async (id) => {
    const response = await api.post(`notifications/${id}/mark_read/`);
    return response.data;
  },
  markAllRead: async () => {
    const response = await api.post('notifications/mark_all_read/');
    return response.data;
  },
};

/**
 * Employee Self-Service Endpoints
 */
export const selfServiceApi = {
  // Returns profile, leave balance, leave history, payslips, reviews,
  // documents, manager, and employment history for the logged-in employee
  getMe: async () => {
    const response = await api.get('auth/me/');
    return response.data;
  },
};

/**
 * Payroll Export
 */

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
  // Downloads the filtered payslip set as a CSV file
  exportCsv: async (params = {}) => {
    const response = await api.get('payslips/export/', {
      params,
      responseType: 'blob',
    });
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
