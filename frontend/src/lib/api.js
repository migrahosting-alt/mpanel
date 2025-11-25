// Centralized API client with auth handling
import axios from 'axios';

// Production deploys set VITE_MPANEL_API_BASE_URL to https://api.migrahosting.com/api/live.php
const API_BASE_URL =
  (import.meta.env.VITE_MPANEL_API_BASE_URL?.replace(/\/$/, '')) ||
  (import.meta.env.VITE_API_URL?.replace(/\/$/, '')) ||
  '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generic CRUD operations factory
export const createCrudApi = (resource) => ({
  // GET /api/{resource}
  getAll: (params = {}) => 
    api.get(`/${resource}`, { params }).then((res) => res.data),

  // GET /api/{resource}/:id
  getOne: (id) => 
    api.get(`/${resource}/${id}`).then((res) => res.data),

  // POST /api/{resource}
  create: (data) => 
    api.post(`/${resource}`, data).then((res) => res.data),

  // PUT /api/{resource}/:id
  update: (id, data) => 
    api.put(`/${resource}/${id}`, data).then((res) => res.data),

  // DELETE /api/{resource}/:id
  delete: (id) => 
    api.delete(`/${resource}/${id}`).then((res) => res.data),
});

// Specific API modules
export const authApi = {
  login: (credentials) => 
    api.post('/auth/login', credentials).then((res) => res.data),
  
  register: (userData) => 
    api.post('/auth/register', userData).then((res) => res.data),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};

export const usersApi = createCrudApi('auth/users');
export const customersApi = createCrudApi('customers');
export const websitesApi = createCrudApi('websites');
export const domainsApi = createCrudApi('domains');
export const databasesApi = createCrudApi('db-management');
export const productsApi = createCrudApi('products');
export const invoicesApi = createCrudApi('invoices');
export const subscriptionsApi = createCrudApi('subscriptions');
export const serversApi = createCrudApi('servers');
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then((res) => res.data),
  recentInvoices: () => api.get('/invoices?limit=5&sort=-createdAt').then((res) => res.data),
  recentSubscriptions: () => api.get('/subscriptions?limit=5&status=active').then((res) => res.data),
};
export const analyticsApi = {
  overview: (timeRange = '7d') => 
    api.get('/analytics/overview', { params: { timeRange } }).then((res) => res.data),
  metrics: (metricType, timeRange = '7d') =>
    api.get(`/analytics/metrics/${metricType}`, { params: { timeRange } }).then((res) => res.data),
};
export const kubernetesApi = {
  clusters: () => api.get('/kubernetes/clusters').then((res) => res.data),
  cluster: (id) => api.get(`/kubernetes/clusters/${id}`).then((res) => res.data),
  createCluster: (data) => api.post('/kubernetes/clusters', data).then((res) => res.data),
  deleteCluster: (id) => api.delete(`/kubernetes/clusters/${id}`).then((res) => res.data),
  pods: (clusterId) => api.get(`/kubernetes/clusters/${clusterId}/pods`).then((res) => res.data),
};
export const cdnApi = {
  zones: () => api.get('/cdn/zones').then((res) => res.data),
  createZone: (data) => api.post('/cdn/zones', data).then((res) => res.data),
  updateZone: (id, data) => api.put(`/cdn/zones/${id}`, data).then((res) => res.data),
  deleteZone: (id) => api.delete(`/cdn/zones/${id}`).then((res) => res.data),
  purgeCache: (zoneId) => api.post(`/cdn/zones/${zoneId}/purge`).then((res) => res.data),
};
export const emailApi = {
  accounts: createCrudApi('email-management/accounts'),
  forwarders: createCrudApi('email-management/forwarders'),
};
export const dnsApi = {
  zones: createCrudApi('dns-management/zones'),
  records: {
    getByZone: (zoneId) => 
      api.get(`/dns-management/zones/${zoneId}/records`).then((res) => res.data),
    create: (zoneId, data) => 
      api.post(`/dns-management/zones/${zoneId}/records`, data).then((res) => res.data),
    update: (recordId, data) => 
      api.put(`/dns-management/records/${recordId}`, data).then((res) => res.data),
    delete: (recordId) => 
      api.delete(`/dns-management/records/${recordId}`).then((res) => res.data),
  },
};
export const fileManagerApi = {
  list: (path = '/') => 
    api.get('/file-manager', { params: { path } }).then((res) => res.data),
  upload: (path, files) => {
    const formData = new FormData();
    formData.append('path', path);
    files.forEach((file) => formData.append('files', file));
    return api.post('/file-manager/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },
  download: (path) => 
    api.get('/file-manager/download', { 
      params: { path },
      responseType: 'blob',
    }).then((res) => res.data),
  mkdir: (path, name) => 
    api.post('/file-manager/mkdir', { path, name }).then((res) => res.data),
  move: (from, to) => 
    api.post('/file-manager/move', { from, to }).then((res) => res.data),
  delete: (path) => 
    api.delete('/file-manager', { data: { path } }).then((res) => res.data),
};

export default api;
