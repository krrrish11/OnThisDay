import { $ } from '../core/dom.js';
import { login, register } from '../api/auth.js';
import { forgetSession, loadSession, safeNext } from '../core/session.js';
import { setError, showStatus } from '../core/forms.js';

const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'), '/my-notes');
const status = $('authStatus');
const tabs = { login: $('tabLogin'), register: $('tabRegister') };
const panels = { login: $('panelLogin'), register: $('panelRegister') };

function select(which, focus = false) {
  for (const k of Object.keys(tabs)) {
    const on = k === which;
    tabs[k].setAttribute('aria-selected', String(on));
    tabs[k].tabIndex = on ? 0 : -1;
    panels[k].hidden = !on;
  }
  $('loginTitle').textContent = which === 'login' ? 'Welcome back' : 'Create an account';
  $('loginSub').textContent =
    which === 'login'
      ? 'Log in to see your notes and keep private ones. You can always post public notes without an account.'
      : 'Pick a username and password. No email needed. An account lets you keep notes private and delete them from any device.';
  showStatus(status, '', '');
  if (focus) tabs[which].focus();
}
tabs.login.addEventListener('click', () => select('login'));
tabs.register.addEventListener('click', () => select('register'));
for (const [name, tab] of Object.entries(tabs)) {
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    select(name === 'login' ? 'register' : 'login', true);
  });
}
select(params.get('tab') === 'register' ? 'register' : 'login');

function handle(form, prefix, action) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = $(`${prefix}User`).value.trim().toLowerCase();
    const pass = $(`${prefix}Pass`).value;
    setError(`${prefix}User`, '', `${prefix}User-err`);
    setError(`${prefix}Pass`, '', `${prefix}Pass-err`);
    showStatus(status, '', '');
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await action(user, pass);
      forgetSession();
      location.href = next;
    } catch (err) {
      if (err.errors) {
        setError(`${prefix}User`, err.errors.username, `${prefix}User-err`);
        setError(`${prefix}Pass`, err.errors.password, `${prefix}Pass-err`);
      }
      showStatus(status, 'bad', err.errors ? 'Please fix the highlighted fields.' : err.message);
      button.disabled = false;
    }
  });
}
handle(panels.login, 'li', login);
handle(panels.register, 're', register);

loadSession().then(({ user, accountsEnabled }) => {
  if (user) location.replace(next);
  else if (!accountsEnabled) {
    showStatus(status, 'bad', 'Accounts are not set up on this server yet. You can still post public notes.');
    document.querySelectorAll('.login-card form button, .login-card form input').forEach((n) => (n.disabled = true));
  }
});
