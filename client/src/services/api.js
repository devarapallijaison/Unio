/**
 * The single HTTP layer for the app. Every request carries the session cookie and
 * every failure becomes an ApiError with the server's code/message/details.
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function request(method, path, { body, params } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response (e.g. proxy error page)
  }

  if (!res.ok || !payload?.success) {
    const err = payload?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Something went wrong. Please try again.', err?.details ?? []);
  }
  return payload.data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  delete: (path) => request('DELETE', path),
};

/* ---------- Typed endpoint helpers (mirror server/src/routes/index.js) ---------- */
export const endpoints = {
  auth: {
    me: () => api.get('/auth/me'),
    login: (body) => api.post('/auth/login', body),
    register: (body) => api.post('/auth/register', body),
    logout: () => api.post('/auth/logout'),
  },
  creators: {
    list: (params) => api.get('/creators', params),
    get: (id) => api.get(`/creators/${id}`),
  },
  campaigns: {
    list: (params) => api.get('/campaigns', params),
    categories: () => api.get('/campaigns/categories'),
    get: (id) => api.get(`/campaigns/${id}`),
    apply: (id, body) => api.post(`/campaigns/${id}/applications`, body),
  },
  creator: {
    profile: () => api.get('/creator/profile'),
    updateProfile: (body) => api.put('/creator/profile', body),
    portfolio: () => api.get('/creator/portfolio'),
    addPortfolio: (body) => api.post('/creator/portfolio', body),
    updatePortfolio: (id, body) => api.put(`/creator/portfolio/${id}`, body),
    deletePortfolio: (id) => api.delete(`/creator/portfolio/${id}`),
    applications: (params) => api.get('/creator/applications', params),
    withdraw: (id) => api.patch(`/creator/applications/${id}/withdraw`),
    invitations: (params) => api.get('/creator/invitations', params),
    respond: (id, status) => api.patch(`/creator/invitations/${id}/respond`, { status }),
    projects: (params) => api.get('/creator/projects', params),
  },
  brand: {
    profile: () => api.get('/brand/profile'),
    updateProfile: (body) => api.put('/brand/profile', body),
    campaigns: (params) => api.get('/brand/campaigns', params),
    campaign: (id) => api.get(`/brand/campaigns/${id}`),
    createCampaign: (body) => api.post('/brand/campaigns', body),
    updateCampaign: (id, body) => api.put(`/brand/campaigns/${id}`, body),
    setCampaignStatus: (id, status) => api.patch(`/brand/campaigns/${id}/status`, { status }),
    campaignApplications: (id, params) => api.get(`/brand/campaigns/${id}/applications`, params),
    recommendations: (id) => api.get(`/brand/campaigns/${id}/recommendations`),
    applications: (params) => api.get('/brand/applications', params),
    reviewApplication: (id, status) => api.patch(`/brand/applications/${id}/status`, { status }),
    invite: (campaignId, body) => api.post(`/brand/campaigns/${campaignId}/invitations`, body),
    invitations: (params) => api.get('/brand/invitations', params),
    cancelInvitation: (id) => api.patch(`/brand/invitations/${id}/cancel`),
    projects: (params) => api.get('/brand/projects', params),
  },
  projects: {
    get: (id) => api.get(`/projects/${id}`),
    setStatus: (id, status) => api.patch(`/projects/${id}/status`, { status }),
    updateDeliverable: (id, deliverableId, body) => api.patch(`/projects/${id}/deliverables/${deliverableId}`, body),
  },
};
