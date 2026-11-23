import { $ } from '../core/dom.js';
import { listMyNotes, deleteNote } from '../api/notes.js';
import { logout } from '../api/auth.js';
import { forgetSession, loadSession } from '../core/session.js';
import { noteCard } from '../components/noteCard.js';
import { createNoteBrowser } from '../components/noteBrowser.js';
import { createFilterBar } from '../components/filterBar.js';
import { panel } from '../components/results.js';

async function main() {
  const { user, accountsEnabled } = await loadSession();

  if (!user) {
    const gate = $('gate');
    gate.hidden = false;
    gate.replaceChildren(
      accountsEnabled
        ? panel({ iconName: 'lock', title: 'Log in to see your notes', message: 'Your private notes are only visible to you, once you are logged in.', action: { label: 'Log in', href: '/login?next=/my-notes' } })
        : panel({ iconName: 'lock', title: 'Accounts are not available yet', message: 'You can still post public notes without an account.', action: { label: 'Add a note', href: '/add' } }),
    );
    return;
  }

  $('who').textContent = `Signed in as ${user.username}. Public and private notes, newest first.`;
  const out = $('logout');
  out.hidden = false;
  out.addEventListener('click', async () => {
    out.disabled = true;
    try {
      await logout();
    } finally {
      forgetSession();
      location.href = '/';
    }
  });

  $('mine').hidden = false;
  const browser = createNoteBrowser({
    list: $('list'),
    meta: $('meta'),
    fetchPage: listMyNotes,
    renderCard: (note) => noteCard(note, { showVisibility: true, onDelete: (n) => deleteNote(n.id) }),
    empty: ({ filtered }) =>
      filtered
        ? panel({ iconName: 'inbox', title: 'No notes match', message: 'Try fewer words, a different date, or clear the filters.' })
        : panel({ iconName: 'pin', title: 'You have not pinned anything yet', message: 'Notes you write while logged in show up here, public or private.', action: { label: 'Add your first note', href: '/add' } }),
  });
  const filters = createFilterBar({ onChange: (f) => browser.show(f) });
  browser.show(filters.read());
}

main();
