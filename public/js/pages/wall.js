import { $ } from '../core/dom.js';
import { listNotes } from '../api/notes.js';
import { noteCard } from '../components/noteCard.js';
import { createNoteBrowser } from '../components/noteBrowser.js';
import { createFilterBar } from '../components/filterBar.js';
import { panel } from '../components/results.js';

const browser = createNoteBrowser({
  list: $('list'),
  meta: $('meta'),
  fetchPage: listNotes,
  renderCard: (note) => noteCard(note),
  empty: ({ filtered }) =>
    filtered
      ? panel({ iconName: 'inbox', title: 'No notes match', message: 'Try fewer words, a different date, or clear the filters.' })
      : panel({ iconName: 'pin', title: 'The wall is empty', message: 'Be the first to pin a memory. It takes less than a minute.', action: { label: 'Add a note', href: '/add' } }),
});

const filters = createFilterBar({ onChange: (f) => browser.show(f) });
browser.show(filters.read());
