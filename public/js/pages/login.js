/* ═══════════════════════════════════════════════════════════════════
   SportCal — Login Page
   ═══════════════════════════════════════════════════════════════════ */

const LoginPage = {
  render() {
    if (Auth.isLoggedIn()) {
      Router.navigate('/');
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
          <h1 class="login-title">Organization Login</h1>
          <p class="login-sub">Enter your access code to manage events</p>

          <form class="login-form" id="loginForm">
            <div class="form-group">
              <label class="form-label" for="accessCode">Access Code</label>
              <div class="input-wrap">
                <input class="form-input" id="accessCode" type="password" placeholder="Enter your organization access code" autocomplete="current-password" />
                <button type="button" class="input-toggle" id="togglePw" aria-label="Show/hide password">
                  <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>

            <div id="loginError" class="login-error"></div>

            <button type="submit" class="btn btn-gradient btn-lg" id="loginBtn" style="width:100%">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Sign In
            </button>
          </form>

          <p class="login-hint">
            Don't have an access code?<br>
            Contact the <a href="https://www.gov.bm/department-youth-sport-recreation" target="_blank" rel="noopener">Department of Sports &amp; Recreation</a> to register your organization.
          </p>
        </div>
      </div>`;

    // Toggle password visibility
    document.getElementById('togglePw').addEventListener('click', () => {
      const input = document.getElementById('accessCode');
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      document.getElementById('eyeIcon').innerHTML = isText
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    });

    // Form submit
    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      const btn   = document.getElementById('loginBtn');
      const code  = document.getElementById('accessCode').value.trim();
      errEl.classList.remove('show');

      if (!code) {
        errEl.textContent = 'Please enter your access code.';
        errEl.classList.add('show');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Signing in…';

      try {
        await Auth.login(code);
        updateNavbar();
        showToast('Welcome back!', 'success');
        Router.navigate('/');
      } catch (err) {
        errEl.textContent = err.status === 401
          ? 'Invalid access code. Please check and try again.'
          : (err.message || 'Login failed. Please try again.');
        errEl.classList.add('show');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In`;
      }
    });
  },
};
