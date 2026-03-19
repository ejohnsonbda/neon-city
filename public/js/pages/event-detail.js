/* ═══════════════════════════════════════════════════════════════════
   SportCal — Event Detail Page
   ═══════════════════════════════════════════════════════════════════ */

const EventDetailPage = {
  async render({ id }) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="event-detail-page">
        <div class="container">
          <div class="spinner-wrap"><div class="spinner"></div></div>
        </div>
      </section>`;

    let event;
    try {
      const data = await Api.getEvent(id);
      event = data.event || data;
    } catch (err) {
      app.innerHTML = `
        <section class="event-detail-page">
          <div class="container">
            <a href="#/" class="back-link" data-link>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Events
            </a>
            <div class="card"><div class="card-body text-center" style="padding:3rem">
              <p style="color:var(--danger)">${err.message}</p>
              <a href="#/" class="btn btn-gradient mt-2" data-link>Back to Events</a>
            </div></div>
          </div>
        </section>`;
      return;
    }

    const sportClass = 'sport-' + (event.sport || 'default').replace(/[\s()\/&]/g, '-').replace(/-+/g, '-');
    const initial = (event.sport || event.title || '?')[0].toUpperCase();
    const orgName = event.organizationName || event.organization?.name || event.orgName || '';
    const orgEmail = event.organization?.email || event.orgEmail || '';
    const status = getEventStatus(event.date);
    const statusClass = `badge-status-${status}`;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    const adminActions = Auth.isLoggedIn() ? `
      <div class="flex gap-1" style="margin-top:1rem">
        <a href="#/events/${event.id}/edit" class="btn btn-ghost btn-sm" data-link>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Event
        </a>
        <button class="btn btn-danger btn-sm" id="detailDeleteBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
      </div>` : '';

    app.innerHTML = `
      <section class="event-detail-page">
        <div class="container">
          <a href="#/" class="back-link" data-link>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Events
          </a>

          <div class="event-detail-grid">
            <!-- Main card -->
            <div class="card event-detail-main">
              <div class="event-thumb ${sportClass}">${initial}</div>
              <div class="event-detail-body">
                <div class="flex items-center gap-1 mb-2">
                  <span class="badge badge-sport">${escHtml(event.sport || 'Sport')}</span>
                  <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <h1 class="event-detail-title">${escHtml(event.title)}</h1>
                ${event.description ? `<p class="event-detail-desc">${escHtml(event.description)}</p>` : ''}

                <div class="event-info-list">
                  <div class="event-info-item">
                    <div class="event-info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <span class="event-info-label">Date &amp; Time</span>
                      <span class="event-info-value">${formatDate(event.date)}${event.time ? ' at ' + event.time : ''}</span>
                    </div>
                  </div>
                  ${event.location ? `
                  <div class="event-info-item">
                    <div class="event-info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div>
                      <span class="event-info-label">Location</span>
                      <span class="event-info-value">${escHtml(event.location)}</span>
                    </div>
                  </div>` : ''}
                  ${orgName ? `
                  <div class="event-info-item">
                    <div class="event-info-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                      <span class="event-info-label">Organizer</span>
                      <span class="event-info-value">${escHtml(orgName)}</span>
                    </div>
                  </div>` : ''}
                </div>
                ${adminActions}
              </div>
            </div>

            <!-- Sidebar -->
            <div class="event-sidebar">
              <div class="card">
                <div class="card-body">
                  <p class="event-sidebar-title">Share This Event</p>
                  <button class="btn btn-outline btn-sm" id="shareBtn" style="width:100%">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Copy Link
                  </button>
                  ${orgEmail ? `
                  <p class="event-sidebar-title" style="margin-top:1rem">Contact</p>
                  <a href="mailto:${escHtml(orgEmail)}" class="btn btn-ghost btn-sm" style="width:100%">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    ${escHtml(orgEmail)}
                  </a>` : ''}
                </div>
              </div>

              <div class="card mt-2">
                <div class="card-body">
                  <p class="event-sidebar-title">Add to Calendar</p>
                  <a href="${this._icsLink(event)}" download="${escHtml(event.title)}.ics" class="btn btn-ghost btn-sm" style="width:100%">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Download .ics
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;

    // Share button
    document.getElementById('shareBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Link copied to clipboard!', 'success');
      });
    });

    // Delete button
    document.getElementById('detailDeleteBtn')?.addEventListener('click', () => {
      confirmDelete(event.id, event.title, async () => {
        try {
          await Api.deleteEvent(event.id);
          showToast('Event deleted.', 'success');
          Router.navigate('/');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  },

  _icsLink(event) {
    const dt = (event.date || '').replace(/-/g, '') + (event.time ? 'T' + event.time.replace(':', '') + '00' : '');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SportCal//Bermuda//EN',
      'BEGIN:VEVENT',
      `DTSTART:${dt}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location || ''}`,
      `DESCRIPTION:${event.description || ''}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  },
};
