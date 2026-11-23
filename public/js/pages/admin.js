import { $ } from '../core/dom.js';
import { adminDelete, adminList, adminPing } from '../api/notes.js';
import { noteCard } from '../components/noteCard.js';
import { createNoteBrowser } from '../components/noteBrowser.js';
import { createFilterBar } from '../components/filterBar.js';
import { panel } from '../components/results.js';

let key = ''; // held in memory only: reloading the page locks it again

$('keyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('keyErr');
  err.textContent = '';
  const attempt = $('adminKey').value;
  if (!attempt) {
    err.textContent = 'Enter the admin key.';
    return;
  }
  try {
    await adminPing(attempt);
  } catch (ex) {
    err.textContent = ex.status === 404 ? 'Moderation is not switched on for this site (no admin key is set).' : ex.status === 401 ? 'That key is not right.' : ex.message;
    return;
  }
  key = attempt;
  $('adminKey').value = '';
  $('keyForm').hidden = true;
  $('panel').hidden = false;

  const browser = createNoteBrowser({
    list: $('list'),
    meta: $('meta'),
    fetchPage: (params) => adminList(key, params),
    renderCard: (note) => noteCard(note, { onDelete: (n) => adminDelete(key, n.id) }),
    empty: ({ filtered }) => panel({ iconName: 'inbox', title: filtered ? 'No notes match' : 'Nothing to moderate', message: filtered ? 'Try different words or an ID.' : 'There are no public notes yet.' }),
  });
  const filters = createFilterBar({ onChange: (f) => browser.show(f), withDate: false });
  browser.show(filters.read());
});
