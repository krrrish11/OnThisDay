const pad = (n, w = 2) => String(n).padStart(w, '0');

// A cursor is "<createdAt ms>_<24-hex _id>", the same format the visitor wall uses.
export const noteCursor = (row) => `${new Date(row.createdAt).getTime()}_${row._id}`;

/** Public view of a note row. Never includes the owner, the delete-key hash or the photo bytes. */
export const toPublicNote = (r, viewerId = null) => ({
  id: r.id,
  text: r.text,
  name: r.name || '',
  date: `${pad(r.year, 4)}-${pad(r.month)}-${pad(r.day)}`,
  year: r.year,
  month: r.month,
  day: r.day,
  isPrivate: Boolean(r.isPrivate),
  hasPhoto: Boolean(r.hasPhoto),
  mine: Boolean(viewerId && r.ownerId && r.ownerId === viewerId),
  createdAt: new Date(r.createdAt).toISOString(),
});
