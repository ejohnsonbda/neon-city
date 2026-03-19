/* ═══════════════════════════════════════════════════════════════════
   SportCal — Create / Edit Event Page
   ═══════════════════════════════════════════════════════════════════ */

const SPORTS_LIST = [
  'Football (Soccer)', 'Cricket', 'Rugby', 'Basketball', 'Netball',
  'Tennis', 'Swimming', 'Athletics (Track & Field)', 'Cycling',
  'Triathlon', 'Squash', 'Bowling', 'Golf', 'Hockey', 'Boxing',
  'Karate', 'Equestrian', 'Sailing', 'Volleyball', 'Boccia',
  'Gymnastics', 'Archery', 'Pickleball', 'Karting', 'Rowing', 'Motocross',
];

const CreateEventPage = {
  async render({ id } = {}) {
    // Redirect if not logged in
    if (!Auth.isLoggedIn()) {
      Router.navigate('/login');
      return;
    }

    const isEdit = !!id;
    let event = null;

    if (isEdit) {
      try {
        const data = await Api.getEvent(id);
        event = data.event || data;
      } catch (err) {
        showToast('Could not load event: ' + err.message, 'error');
        Router.navigate('/');
        return;
      }
    }

    const app = document.getElementById('app');
    const sportsOptions = SPORTS_LIST.map(s =>
      `<option value="${s}" ${event?.sport === s ? 'selected' : ''}>${s}</option>`
    ).join('');

    app.innerHTML = `
      <section class="create-page">
        <div class="container">
          <a href="${isEdit ? '#/events/' + id : '#/'}" class="back-link" data-link>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            ${isEdit ? 'Back to Event' : 'Back to Events'}
          </a>

          <div class="create-card card">
            <div class="card-body">
              <h2>${isEdit ? 'Edit Event' : 'Create New Event'}</h2>
              <p class="sub">${isEdit ? 'Update the event details below.' : 'Fill in the details to add a new sports event to the calendar.'}</p>

              <form id="eventForm" class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="fTitle">Event Title *</label>
                  <input class="form-input" id="fTitle" type="text" placeholder="e.g. Football - Premier Division Opening Day" required value="${escHtml(event?.title || '')}" />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="fSport">Sport *</label>
                    <select class="form-select" id="fSport" required>
                      <option value="">Select a sport…</option>
                      ${sportsOptions}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="fLocation">Location</label>
                    <input class="form-input" id="fLocation" type="text" placeholder="e.g. National Sports Centre" value="${escHtml(event?.location || '')}" />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="fDate">Date *</label>
                    <input class="form-input" id="fDate" type="date" required value="${event?.date ? event.date.split('T')[0] : ''}" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="fTime">Time</label>
                    <input class="form-input" id="fTime" type="time" value="${event?.time || ''}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="fDesc">Description</label>
                  <textarea class="form-textarea" id="fDesc" rows="4" placeholder="Describe the event…">${escHtml(event?.description || '')}</textarea>
                </div>

                <div id="formError" class="login-error"></div>

                <div class="flex gap-1" style="justify-content:flex-end;flex-wrap:wrap">
                  <a href="${isEdit ? '#/events/' + id : '#/'}" class="btn btn-outline" data-link>Cancel</a>
                  <button type="submit" class="btn btn-gradient" id="submitBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    ${isEdit ? 'Save Changes' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>`;

    document.getElementById('eventForm').addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('formError');
      const submitBtn = document.getElementById('submitBtn');
      errEl.classList.remove('show');

      const payload = {
        title:       document.getElementById('fTitle').value.trim(),
        sport:       document.getElementById('fSport').value,
        location:    document.getElementById('fLocation').value.trim(),
        date:        document.getElementById('fDate').value,
        time:        document.getElementById('fTime').value,
        description: document.getElementById('fDesc').value.trim(),
      };

      if (!payload.title || !payload.sport || !payload.date) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.classList.add('show');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Saving…' : 'Creating…';

      try {
        if (isEdit) {
          await Api.updateEvent(id, payload);
          showToast('Event updated successfully!', 'success');
          Router.navigate(`/events/${id}`);
        } else {
          const data = await Api.createEvent(payload);
          const newId = data.event?.id || data.id;
          showToast('Event created successfully!', 'success');
          Router.navigate(newId ? `/events/${newId}` : '/');
        }
      } catch (err) {
        errEl.textContent = err.message || 'Something went wrong. Please try again.';
        errEl.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Event';
      }
    });
  },
};
