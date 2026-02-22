import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  validate: () => api.get('/auth/validate'),
  profile: () => api.get('/auth/profile'),
};

// ─── User Types ───────────────────────────────────────────────────────────────
export const userTypesApi = {
  getAll: (params) => api.get('/user-types', { params }),
  getOne: (id) => api.get(`/user-types/${id}`),
  create: (data) => api.post('/user-types', data),
  update: (id, data) => api.put(`/user-types/${id}`, data),
  updateStatus: (id, data) => api.put(`/user-types/${id}/status`, data),
  getDeleteInfo: (id) => api.get(`/user-types/${id}/delete-info`),
  delete: (id, confirm) => api.delete(`/user-types/${id}`, { data: { confirm } }),
  getFieldsMaster: () => api.get('/user-types/fields-master'),
};

// ─── Fields Master ────────────────────────────────────────────────────────────
export const fieldsMasterApi = {
  getAll: (params) => api.get('/fields-master', { params }),
  getOne: (id) => api.get(`/fields-master/${id}`),
  create: (data) => api.post('/fields-master', data),
  update: (id, data) => api.put(`/fields-master/${id}`, data),
  delete: (id, force = false) => api.delete(`/fields-master/${id}`, { data: { force } }),
};

// ─── Requests ─────────────────────────────────────────────────────────────────
export const requestsApi = {
  // Public
  getActiveUserTypes: () => api.get('/requests/user-types'),
  getUserTypeFields: (id) => api.get(`/requests/user-types/${id}/fields`),
  createRequest: (data) => api.post('/requests', data),
  // Admin
  getAll: (params) => api.get('/requests/admin', { params }),
  getOne: (id) => api.get(`/requests/admin/${id}`),
  updateStatus: (id, data) => api.put(`/requests/admin/${id}/status`, data),
};

// ─── Database ─────────────────────────────────────────────────────────────────
export const databaseApi = {
  health: () => api.get('/database/health'),
  stats: () => api.get('/database/stats'),
  getBackups: () => api.get('/database/backups'),
  createBackup: () => api.post('/database/backup'),
  restore: (filename) => api.post(`/database/restore/${filename}`),
  deleteBackup: (filename) => api.delete(`/database/backup/${filename}`),
};

export default api;
