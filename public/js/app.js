/* ═══════════════════════════════════════════════════════════════════
   SportCal — App Bootstrap
   ═══════════════════════════════════════════════════════════════════ */

/* ── Utility helpers ─────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getEventStatus(dateStr) {
  if (!dateStr) return 'upcoming';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  if (d < today) return 'past';
  if (d.toDateString() === today.toDateString()) return 'today';
  return 'upcoming';
}

let _toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  toast.className = 'toast' + (type ? ' ' + type : '');
  msgEl.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function confirmDelete(id, title, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = 'Delete Event';
  document.getElementById('confirmMsg').textContent = `Are you sure you want to delete "${title}"? This action cannot be undone.`;
  modal.classList.remove('hidden');

  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');

  const close = () => modal.classList.add('hidden');

  const handleOk = () => { close(); onConfirm(); ok.removeEventListener('click', handleOk); cancel.removeEventListener('click', close); };
  const handleCancel = () => { close(); ok.removeEventListener('click', handleOk); cancel.removeEventListener('click', close); };

  ok.addEventListener('click', handleOk);
  cancel.addEventListener('click', handleCancel);
  modal.addEventListener('click', e => { if (e.target === modal) handleCancel(); }, { once: true });
}

/* ── Navbar update ───────────────────────────────────────────────── */
function updateNavbar() {
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn() && user;

  document.getElementById('navLoggedOut').classList.toggle('hidden', !!loggedIn);
  document.getElementById('navLoggedIn').classList.toggle('hidden', !loggedIn);
  document.getElementById('navDashboard').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    const displayName = user.organizationName || user.name || 'Admin';
    document.getElementById('navAvatar').textContent = displayName[0].toUpperCase();
    document.getElementById('navUserName').textContent = displayName;
    document.getElementById('navUserRole').textContent = user.role === 'super_admin' ? 'Master Access' : 'Organization';
  }
}

/* ── Register routes ─────────────────────────────────────────────── */
Router.add('/', () => HomePage.render());
Router.add('/calendar', () => CalendarPage.render());
Router.add('/events/new', () => CreateEventPage.render());
Router.add('/events/:id', ({ id }) => EventDetailPage.render({ id }));
Router.add('/events/:id/edit', ({ id }) => CreateEventPage.render({ id }));
Router.add('/login', () => LoginPage.render());
Router.add('/dashboard', () => DashboardPage.render());

/* ── Hamburger menu ──────────────────────────────────────────────── */
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

/* ── Logout ──────────────────────────────────────────────────────── */
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

/* ── Footer year ─────────────────────────────────────────────────── */
document.getElementById('footerYear').textContent = new Date().getFullYear();

/* ── Init ────────────────────────────────────────────────────────── */
(async () => {
  await Auth.init();
  updateNavbar();
  Router.init();
})();
