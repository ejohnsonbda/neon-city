/* ═══════════════════════════════════════════════════════════════════
   SportCal — Admin Dashboard Page
   ═══════════════════════════════════════════════════════════════════ */

const DashboardPage = {
  _stats: null,

  async render() {
    if (!Auth.isLoggedIn()) {
      Router.navigate('/login');
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="dashboard-page">
        <div class="container">
          <div class="dash-header">
            <div>
              <h1 class="dash-title">Admin Dashboard</h1>
              <p class="dash-sub">SportCal — Bermuda Sports Events Overview</p>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" id="refreshBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Refresh
              </button>
              <a href="#/events/new" class="btn btn-gradient btn-sm" data-link>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Event
              </a>
            </div>
          </div>

          <div id="dashContent">
            <div class="spinner-wrap"><div class="spinner"></div></div>
          </div>
        </div>
      </section>`;

    document.getElementById('refreshBtn').addEventListener('click', () => this._loadStats());
    await this._loadStats();
  },

  async _loadStats() {
    const content = document.getElementById('dashContent');
    if (!content) return;

    try {
      const data = await Api.getStats();
      this._stats = data;
      this._renderDashboard(data);
    } catch (err) {
      content.innerHTML = `
        <div class="card"><div class="card-body text-center" style="padding:3rem">
          <p style="color:var(--danger)">Could not load stats: ${err.message}</p>
          <button class="btn btn-gradient mt-2" onclick="DashboardPage._loadStats()">Retry</button>
        </div></div>`;
    }
  },

  _renderDashboard(data) {
    const content = document.getElementById('dashContent');
    const stats = data.stats || data;
    const bySport = stats.eventsBySport || [];
    const byOrg   = stats.eventsByOrg   || [];
    const recent  = stats.recentEvents  || [];

    content.innerHTML = `
      <!-- Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="stat-value">${stats.totalEvents ?? '—'}</div>
          <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div class="stat-value">${stats.upcomingEvents ?? '—'}</div>
          <div class="stat-label">Upcoming Events</div>
          <div class="stat-detail">From today onwards</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon pink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <div class="stat-value">${stats.thisMonthEvents ?? '—'}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div class="stat-value">${stats.totalOrganizations ?? '—'}</div>
          <div class="stat-label">Organizations</div>
          <div class="stat-detail">${stats.totalOrganizations ?? '—'} total</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="dash-tabs">
        <button class="dash-tab active" data-tab="overview">Overview</button>
        <button class="dash-tab" data-tab="sports">Sports</button>
        <button class="dash-tab" data-tab="orgs">Organizations</button>
        <button class="dash-tab" data-tab="recent">Recent</button>
      </div>

      <!-- Overview Panel -->
      <div class="dash-panel active" id="tab-overview">
        <div class="dash-grid">
          <div class="card">
            <div class="card-body">
              <h3 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">Events by Sport</h3>
              <div class="bar-chart">
                ${this._renderBars(bySport, 'sport', 'blue')}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <h3 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">Events by Organization</h3>
              <div class="bar-chart">
                ${this._renderBars(byOrg, 'org', 'pink')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sports Panel -->
      <div class="dash-panel" id="tab-sports">
        <div class="card">
          <div class="card-body">
            <h3 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">All Sports Breakdown</h3>
            <div class="bar-chart">
              ${this._renderBars(bySport, 'sport', 'blue', true)}
            </div>
          </div>
        </div>
      </div>

      <!-- Orgs Panel -->
      <div class="dash-panel" id="tab-orgs">
        <div class="card">
          <div class="card-body">
            <h3 style="font-size:.95rem;font-weight:700;margin-bottom:1rem">All Organizations</h3>
            <div class="bar-chart">
              ${this._renderBars(byOrg, 'org', 'pink', true)}
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Panel -->
      <div class="dash-panel" id="tab-recent">
        <div class="card" style="overflow-x:auto">
          <table class="events-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Sport</th>
                <th>Date</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${recent.length ? recent.map(e => `
                <tr>
                  <td><strong>${escHtml(e.title)}</strong></td>
                  <td><span class="badge badge-sport" style="background:var(--gray-100);color:var(--gray-700)">${escHtml(e.sport || '—')}</span></td>
                  <td>${formatDate(e.date)}</td>
                  <td>${escHtml(e.organizationName || e.location || '—')}</td>
                  <td>
                    <div class="td-actions">
                      <a href="#/events/${e.id}" class="btn btn-ghost btn-sm" data-link>View</a>
                      <a href="#/events/${e.id}/edit" class="btn btn-ghost btn-sm" data-link>Edit</a>
                      <button class="btn btn-danger btn-sm dash-del" data-id="${e.id}" data-title="${escHtml(e.title)}">Del</button>
                    </div>
                  </td>
                </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:2rem">No events found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    // Tab switching
    document.querySelectorAll('.dash-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Delete buttons in table
    document.querySelectorAll('.dash-del').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmDelete(btn.dataset.id, btn.dataset.title, async () => {
          try {
            await Api.deleteEvent(btn.dataset.id);
            showToast('Event deleted.', 'success');
            await this._loadStats();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });

    // Animate bars
    requestAnimationFrame(() => {
      document.querySelectorAll('.bar-fill').forEach(bar => {
        const w = bar.dataset.width;
        bar.style.width = w + '%';
      });
    });
  },

  _renderBars(items, type, colorClass, all = false) {
    if (!items.length) return '<p style="color:var(--gray-400);font-size:.8rem">No data available.</p>';
    const max = Math.max(...items.map(i => i._count?.id || i.count || 0));
    const list = all ? items : items.slice(0, 8);
    return list.map(item => {
      const label = type === 'sport' ? (item.sport || '—') : (item.organization?.name || item.name || '—');
      const count = item._count?.id || item.count || 0;
      const pct = max > 0 ? Math.round((count / max) * 100) : 0;
      return `
        <div class="bar-item">
          <div class="bar-label" title="${escHtml(label)}">${escHtml(label)}</div>
          <div class="bar-track">
            <div class="bar-fill ${colorClass}" data-width="${pct}" style="width:0%"></div>
          </div>
          <div class="bar-count">${count}</div>
        </div>`;
    }).join('');
  },
};
