import { loadSession } from './session.js';

// Shared by every page: the nav's account link shows "My notes" once you are signed in.
loadSession().then(({ user }) => {
  const slot = document.getElementById('navAccount');
  if (!slot || !user) return;
  const here = location.pathname === '/my-notes';
  const a = document.createElement('a');
  a.href = '/my-notes';
  a.textContent = 'My notes';
  a.title = `Signed in as ${user.username}`;
  if (here) a.setAttribute('aria-current', 'page');
  slot.replaceChildren(a);
});
