import axios from 'axios';
import ky from 'ky';

// axios instance with baseURL — detector must compose this prefix with
// relative paths that use the exported instance.
export const api = axios.create({ baseURL: '/api/v1' });

// ky instance with prefixUrl — equivalent pattern from a different lib.
export const kyApi = ky.create({ prefixUrl: '/api/v1' });

// Wrapped client (1-hop resolvable). userApi.getById(id) should resolve
// to GET /api/v1/users/:id.
export const userApi = {
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, payload: unknown) => api.patch(`/users/${id}`, payload),
  list: () => api.get('/users'),
};

// Dead endpoint — defined but never used anywhere downstream.
export const legacyApi = {
  refreshToken: () => api.post('/auth/legacy/refresh'),
};
