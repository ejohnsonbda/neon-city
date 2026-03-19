/* ═══════════════════════════════════════════════════════════════════
   SportCal — Auth Module
   ═══════════════════════════════════════════════════════════════════ */

const Auth = {
  _key: 'sportcal_token',
  _user: null,

  getToken() { return localStorage.getItem(this._key); },
  setToken(t) { localStorage.setItem(this._key, t); },
  removeToken() { localStorage.removeItem(this._key); this._user = null; },

  getUser() { return this._user; },
  setUser(u) { this._user = u; },

  isLoggedIn() { return !!this.getToken(); },

  isAdmin() {
    const u = this._user;
    return u && (u.role === 'admin' || u.role === 'super_admin');
  },

  async init() {
    if (!this.getToken()) return;
    try {
      const data = await Api.me();
      // Backend returns { user: { id, name, role, organizationName, ... } }
      this._user = data.user || data;
    } catch {
      this.removeToken();
    }
  },

  async login(accessCode) {
    const data = await Api.login(accessCode);
    this.setToken(data.token);
    this._user = data.user;
    return data;
  },

  logout() {
    this.removeToken();
    Router.navigate('/');
    updateNavbar();
  },
};
