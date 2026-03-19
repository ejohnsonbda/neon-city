/* ═══════════════════════════════════════════════════════════════════
   SportCal — Calendar Page (Pure JS, no external dependency)
   ═══════════════════════════════════════════════════════════════════ */

const SPORT_COLORS = {
  'Football (Soccer)':         '#1a6b3c',
  'Cricket':                   '#b85c00',
  'Rugby':                     '#7c3db5',
  'Basketball':                '#e06020',
  'Netball':                   '#b84a7c',
  'Tennis':                    '#2db57c',
  'Swimming':                  '#2d7cb5',
  'Athletics (Track & Field)': '#b59a2d',
  'Cycling':                   '#2d8ab5',
  'Triathlon':                 '#e84393',
  'Squash':                    '#7cb52d',
  'Bowling':                   '#6a4ab5',
  'Golf':                      '#2db53a',
  'Hockey':                    '#2d7cb5',
  'Boxing':                    '#b52d2d',
  'Sailing':                   '#1e3799',
  'Volleyball':                '#d97706',
  'default':                   '#475569',
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CalendarPage = {
  _events: [],
  _year:   new Date().getFullYear(),
  _month:  new Date().getMonth(),
  _view:   'month', // 'month' | 'list'

  async render() {
    console.log('[CalendarPage] render() called');
    const app = document.getElementById('app');
    if (!app) { console.error('[CalendarPage] #app not found!'); return; }
    app.innerHTML = `
      <section class="calendar-page">
        <div class="container">
          <div class="page-header flex items-center justify-between" style="flex-wrap:wrap;gap:1rem;">
            <div>
              <h1 class="page-title">Sports Calendar</h1>
              <p class="page-sub">All Bermuda sports events at a glance</p>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm active-view" id="calMonth">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Month
              </button>
              <button class="btn btn-ghost btn-sm" id="calList">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>
                List
              </button>
            </div>
          </div>

          <div class="calendar-legend" id="calLegend"></div>
          <div id="calendarContainer" style="min-height:400px;"></div>
        </div>
      </section>`;

    // Load events
    try {
      const data = await Api.getEvents({ limit: 500 });
      this._events = data.events || [];
    } catch(e) {
      this._events = [];
    }

    this._renderLegend();
    this._renderView();

    document.getElementById('calMonth').addEventListener('click', () => {
      this._view = 'month';
      document.getElementById('calMonth').classList.add('active-view');
      document.getElementById('calList').classList.remove('active-view');
      this._renderView();
    });
    document.getElementById('calList').addEventListener('click', () => {
      this._view = 'list';
      document.getElementById('calList').classList.add('active-view');
      document.getElementById('calMonth').classList.remove('active-view');
      this._renderView();
    });
  },

  _renderLegend() {
    const top = Object.entries(SPORT_COLORS).slice(0, 10);
    document.getElementById('calLegend').innerHTML = top.map(([sport, color]) =>
      `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div><span>${sport}</span></div>`
    ).join('');
  },

  _renderView() {
    if (this._view === 'month') this._renderMonth();
    else this._renderList();
  },

  _eventsForDate(y, m, d) {
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return this._events.filter(e => e.date === iso);
  },

  _renderMonth() {
    const y = this._year, m = this._month;
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const today = new Date();

    let cells = '';
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell cal-cell--empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
      const evs = this._eventsForDate(y, m, d);
      const evHTML = evs.slice(0, 3).map(e => {
        const color = SPORT_COLORS[e.sport] || SPORT_COLORS.default;
        return `<div class="cal-event" style="background:${color}" data-id="${e.id}" title="${escHtml(e.title)}">${escHtml(e.title)}</div>`;
      }).join('') + (evs.length > 3 ? `<div class="cal-more">+${evs.length-3} more</div>` : '');

      cells += `<div class="cal-cell${isToday ? ' cal-cell--today' : ''}">
        <span class="cal-day-num${isToday ? ' cal-today-num' : ''}">${d}</span>
        <div class="cal-events-list">${evHTML}</div>
      </div>`;
    }

    document.getElementById('calendarContainer').innerHTML = `
      <div class="cal-nav">
        <button class="btn btn-ghost btn-sm" id="calPrev">&#8249; Prev</button>
        <h2 class="cal-month-title">${MONTHS[m]} ${y}</h2>
        <button class="btn btn-ghost btn-sm" id="calNext">Next &#8250;</button>
      </div>
      <div class="cal-grid">
        ${DAYS.map(d => `<div class="cal-header-cell">${d}</div>`).join('')}
        ${cells}
      </div>`;

    document.getElementById('calPrev').addEventListener('click', () => {
      if (this._month === 0) { this._month = 11; this._year--; }
      else this._month--;
      this._renderMonth();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      if (this._month === 11) { this._month = 0; this._year++; }
      else this._month++;
      this._renderMonth();
    });

    // Event click navigation
    document.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        Router.navigate(`/events/${el.dataset.id}`);
      });
    });
  },

  _renderList() {
    const upcoming = this._events
      .filter(e => e.date >= new Date().toISOString().slice(0,10))
      .sort((a,b) => a.date.localeCompare(b.date));

    if (!upcoming.length) {
      document.getElementById('calendarContainer').innerHTML =
        `<div class="empty-state"><p>No upcoming events found.</p></div>`;
      return;
    }

    // Group by month
    const groups = {};
    upcoming.forEach(e => {
      const d = new Date(e.date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups[key]) groups[key] = { label, events: [] };
      groups[key].events.push(e);
    });

    const html = Object.values(groups).map(g => `
      <div class="list-month-group">
        <h3 class="list-month-label">${g.label}</h3>
        ${g.events.map(e => {
          const color = SPORT_COLORS[e.sport] || SPORT_COLORS.default;
          const d = new Date(e.date + 'T12:00:00');
          const orgName = e.organizationName || e.organization?.name || '';
          return `
          <div class="list-event-row" data-id="${e.id}" style="cursor:pointer" onclick="Router.navigate('/events/${e.id}')">
            <div class="list-event-dot" style="background:${color}"></div>
            <div class="list-event-date">
              <span class="list-day">${d.getDate()}</span>
              <span class="list-weekday">${DAYS[d.getDay()]}</span>
            </div>
            <div class="list-event-info">
              <strong>${escHtml(e.title)}</strong>
              <span class="list-event-meta">
                ${e.time ? `<span>&#128336; ${e.time}</span>` : ''}
                ${e.location ? `<span>&#128205; ${escHtml(e.location)}</span>` : ''}
                ${orgName ? `<span>&#127942; ${escHtml(orgName)}</span>` : ''}
              </span>
            </div>
            <span class="badge badge-sport" style="background:${color}20;color:${color};border:1px solid ${color}40">${escHtml(e.sport||'')}</span>
          </div>`;
        }).join('')}
      </div>`).join('');

    document.getElementById('calendarContainer').innerHTML = `<div class="list-view">${html}</div>`;
  },
};
