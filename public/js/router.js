/* ═══════════════════════════════════════════════════════════════════
   SportCal — Hash Router
   Routes: / | /calendar | /events/:id | /events/new | /events/:id/edit | /login | /dashboard
   ═══════════════════════════════════════════════════════════════════ */

const Router = {
  routes: [],

  add(pattern, handler) {
    this.routes.push({ pattern, handler });
  },

  navigate(path) {
    window.location.hash = '#' + path;
  },

  _match(pattern, path) {
    const patParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    if (patParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patParts.length; i++) {
      if (patParts[i].startsWith(':')) {
        params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  },

  async resolve() {
    const hash = window.location.hash || '#/';
    const path = hash.replace(/^#/, '') || '/';

    for (const route of this.routes) {
      const params = this._match(route.pattern, path);
      if (params !== null) {
        updateNavActive(path);
        await route.handler(params);
        window.scrollTo(0, 0);
        return;
      }
    }

    // 404 fallback
    document.getElementById('app').innerHTML = `
      <div class="container" style="padding:6rem 1.5rem;text-align:center;">
        <h1 style="font-size:4rem;font-weight:900;color:var(--gray-200);">404</h1>
        <p style="color:var(--gray-500);margin:.5rem 0 1.5rem;">Page not found.</p>
        <a href="#/" class="btn btn-gradient" data-link>Back to Events</a>
      </div>`;
  },

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    // Intercept data-link clicks
    document.addEventListener('click', e => {
      const link = e.target.closest('[data-link]');
      if (link) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          window.location.hash = href;
        }
      }
    });
    this.resolve();
  },
};

function updateNavActive(path) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('active');
    const page = el.dataset.page;
    if (page === 'home' && (path === '/' || path === '')) el.classList.add('active');
    else if (page === 'calendar' && path.startsWith('/calendar')) el.classList.add('active');
    else if (page === 'dashboard' && path.startsWith('/dashboard')) el.classList.add('active');
  });
}
