/* ═══════════════════════════════════════════════════════════════════
   SportCal — API Client
   All calls go to /api/* (proxied to backend on port 3001 in dev,
   served directly by the Express server in production)
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = '/api';

const Api = {
  /* ── Internal fetch helper ──────────────────────────────────── */
  async _fetch(path, options = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /* ── Auth ───────────────────────────────────────────────────── */
  login(accessCode) {
    return this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    });
  },
  me() { return this._fetch('/auth/me'); },

  /* ── Events ─────────────────────────────────────────────────── */
  async getEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await this._fetch(`/events${qs ? '?' + qs : ''}`);
    // Normalise: backend returns { data: [...], pagination: {...} }
    return { events: res.data || res.events || res };
  },
  async getEvent(id) {
    const res = await this._fetch(`/events/${id}`);
    return { event: res.data || res.event || res };
  },
  createEvent(data) {
    return this._fetch('/events', { method: 'POST', body: JSON.stringify(data) });
  },
  updateEvent(id, data) {
    return this._fetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteEvent(id) {
    return this._fetch(`/events/${id}`, { method: 'DELETE' });
  },

  /* ── Organizations ──────────────────────────────────────────── */
  getOrganizations() { return this._fetch('/organizations'); },

  /* ── Admin ──────────────────────────────────────────────────── */
  async getStats() {
    const res = await this._fetch('/admin/stats');
    const d = res.data || res;
    // Normalise to the shape the dashboard expects
    return {
      stats: {
        totalEvents:         d.events?.total         ?? 0,
        upcomingEvents:      d.events?.upcoming      ?? 0,
        thisMonthEvents:     d.events?.thisMonth     ?? 0,
        totalOrganizations:  d.organizations?.total  ?? 0,
        eventsBySport:       (d.sportBreakdown || []).map(s => ({ sport: s.sport, _count: { id: s.count } })),
        eventsByOrg:         (d.orgBreakdown   || []).map(o => ({ organization: { name: o.organization }, _count: { id: o.count } })),
        recentEvents:        d.recentEvents || [],
      },
    };
  },
  getAuditLog() { return this._fetch('/admin/audit'); },
};
