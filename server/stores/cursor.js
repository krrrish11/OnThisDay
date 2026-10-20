// A cursor is "<createdAt in ms>_<id>" — stable even when two posts share a timestamp.
export const encodeCursor = (item) => `${new Date(item.createdAt).getTime()}_${item.id}`;

export function decodeCursor(raw) {
  if (!raw) return null;
  const m = /^(\d{10,16})_([0-9a-f]{24})$/.exec(String(raw));
  return m ? { ms: Number(m[1]), id: m[2] } : undefined; // undefined = malformed
}

export const toPublic = (v) => ({
  id: String(v._id ?? v.id),
  name: v.name,
  place: v.place || '',
  message: v.message,
  favDate: v.favDate || null,
  createdAt: new Date(v.createdAt).toISOString(),
});
