/* ═══════════════════════════════════════════════════════════════════
   SportCal — Home Page
   ═══════════════════════════════════════════════════════════════════ */

const HomePage = {
  _events: [],
  _filtered: [],
  _sport: 'all',
  _sort: 'date_asc',
  _search: '',

  SPORTS: [
    'Football (Soccer)', 'Cricket', 'Rugby', 'Basketball', 'Netball',
    'Tennis', 'Swimming', 'Athletics (Track & Field)', 'Cycling',
    'Triathlon', 'Squash', 'Bowling', 'Golf', 'Hockey', 'Boxing',
    'Karate', 'Equestrian', 'Sailing', 'Volleyball', 'Boccia',
    'Gymnastics', 'Archery', 'Pickleball', 'Karting', 'Rowing', 'Motocross',
  ],

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <!-- Hero -->
      <section class="hero">
        <div class="hero-bg-pattern"></div>
        <div class="hero-content">
          <div class="hero-eyebrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Bermuda Sports Events Calendar
          </div>
          <h1 class="hero-title">
            Discover <span class="gradient-text">Bermuda's</span><br>Sports Events
          </h1>
          <p class="hero-sub">Find upcoming competitions, tournaments, and sporting events from all of Bermuda's national sports associations.</p>
          <div class="hero-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="heroSearch" placeholder="Search events, sports, locations…" autocomplete="off" />
          </div>
        </div>
      </section>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="container">
          <div class="filter-inner" id="filterChips">
            <button class="chip active" data-sport="all">All Sports</button>
            ${this.SPORTS.slice(0, 8).map(s =>
              `<button class="chip" data-sport="${s}">${s}</button>`
            ).join('')}
            <button class="chip" id="moreChip">More ▾</button>
            <div class="filter-sort">
              <select id="sortSelect">
                <option value="date_asc">Date (Soonest First)</option>
                <option value="date_desc">Date (Latest First)</option>
                <option value="created">Newest Added</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Section -->
      <section class="events-section">
        <div class="container">
          <div class="events-header">
            <p class="events-count" id="eventsCount">Loading…</p>
            ${Auth.isLoggedIn() ? `<a href="#/events/new" class="btn btn-gradient btn-sm" data-link>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Event
            </a>` : ''}
          </div>
          <div class="events-grid" id="eventsGrid">
            <div class="spinner-wrap"><div class="spinner"></div></div>
          </div>
        </div>
      </section>`;

    // Bind events
    document.getElementById('heroSearch').addEventListener('input', e => {
      this._search = e.target.value.toLowerCase();
      this._applyFilters();
    });

    document.getElementById('sortSelect').addEventListener('change', e => {
      this._sort = e.target.value;
      this._applyFilters();
    });

    document.getElementById('filterChips').addEventListener('click', e => {
      const chip = e.target.closest('[data-sport]');
      if (!chip) return;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this._sport = chip.dataset.sport;
      this._applyFilters();
    });

    // More chips dropdown
    document.getElementById('moreChip').addEventListener('click', () => {
      const bar = document.getElementById('filterChips');
      const existing = bar.querySelectorAll('[data-sport]');
      const shown = new Set([...existing].map(c => c.dataset.sport));
      this.SPORTS.slice(8).forEach(s => {
        if (!shown.has(s)) {
          const btn = document.createElement('button');
          btn.className = 'chip';
          btn.dataset.sport = s;
          btn.textContent = s;
          bar.insertBefore(btn, document.getElementById('moreChip'));
        }
      });
      document.getElementById('moreChip').remove();
    });

    await this._loadEvents();
  },

  async _loadEvents() {
    try {
      const data = await Api.getEvents({ limit: 100 });
      this._events = data.events || data;
      this._applyFilters();
    } catch (err) {
      document.getElementById('eventsGrid').innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>Could not load events</h3>
          <p>${err.message}</p>
        </div>`;
    }
  },

  _applyFilters() {
    let list = [...this._events];

    if (this._sport !== 'all') {
      list = list.filter(e => e.sport === this._sport);
    }
    if (this._search) {
      list = list.filter(e =>
        e.title.toLowerCase().includes(this._search) ||
        (e.sport || '').toLowerCase().includes(this._search) ||
        (e.location || '').toLowerCase().includes(this._search) ||
        (e.organization?.name || e.orgName || '').toLowerCase().includes(this._search)
      );
    }

    switch (this._sort) {
      case 'date_asc':  list.sort((a,b) => new Date(a.date) - new Date(b.date)); break;
      case 'date_desc': list.sort((a,b) => new Date(b.date) - new Date(a.date)); break;
      case 'created':   list.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)); break;
      case 'title':     list.sort((a,b) => a.title.localeCompare(b.title)); break;
    }

    this._filtered = list;
    this._renderGrid();
  },

  _renderGrid() {
    const grid = document.getElementById('eventsGrid');
    const count = document.getElementById('eventsCount');
    if (!grid) return;

    count.innerHTML = `Showing <strong>${this._filtered.length}</strong> of <strong>${this._events.length}</strong> events`;

    if (!this._filtered.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <h3>No events found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>`;
      return;
    }

    grid.innerHTML = this._filtered.map(e => this._cardHTML(e)).join('');

    // Bind card clicks
    grid.querySelectorAll('.event-card[data-id]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.event-card-actions')) return;
        Router.navigate(`/events/${card.dataset.id}`);
      });
    });

    // Admin action buttons
    if (Auth.isLoggedIn()) {
      grid.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          Router.navigate(`/events/${btn.dataset.id}/edit`);
        });
      });
      grid.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          confirmDelete(btn.dataset.id, btn.dataset.title, () => this._deleteEvent(btn.dataset.id));
        });
      });
    }
  },

  async _deleteEvent(id) {
    try {
      await Api.deleteEvent(id);
      this._events = this._events.filter(e => e.id !== id);
      this._applyFilters();
      showToast('Event deleted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  _cardHTML(e) {
    const sportClass = 'sport-' + (e.sport || 'default').replace(/[\s()\/&]/g, '-').replace(/-+/g, '-');
    const initial = (e.sport || e.title || '?')[0].toUpperCase();
    const orgName = e.organizationName || e.organization?.name || e.orgName || '';
    const status = getEventStatus(e.date);
    const statusClass = `badge-status-${status}`;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const dateStr = formatDate(e.date);
    const timeStr = e.time ? ` · ${e.time}` : '';

    const actions = Auth.isLoggedIn() ? `
      <div class="event-card-actions">
        <button class="btn btn-ghost btn-sm btn-edit" data-id="${e.id}" data-title="${escHtml(e.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger btn-sm btn-del" data-id="${e.id}" data-title="${escHtml(e.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
      </div>` : '';

    return `
      <article class="event-card" data-id="${e.id}" role="button" tabindex="0">
        <div class="event-card-thumb ${sportClass}">
          ${initial}
          <div class="event-card-badges">
            <span class="badge badge-sport">${escHtml(e.sport || 'Sport')}</span>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <div class="event-card-body">
          <div class="event-card-title">${escHtml(e.title)}</div>
          <div class="event-card-meta">
            <div class="event-meta-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${dateStr}${timeStr}
            </div>
            ${e.location ? `<div class="event-meta-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(e.location)}
            </div>` : ''}
          </div>
          ${orgName ? `<div class="event-card-org">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;display:inline;vertical-align:middle;margin-right:3px;"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            ${escHtml(orgName)}
          </div>` : ''}
        </div>
        ${actions}
      </article>`;
  },
};
