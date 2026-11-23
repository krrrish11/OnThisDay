// Guests get a secret delete key when they post. It lives in this browser only (the server keeps just a hash).
const KEY = 'otd.deleteKeys';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch {
    return false; // private mode or storage blocked: the person can still copy the key by hand
  }
}

export const getDeleteKey = (id) => read()[id] || null;
export const saveDeleteKey = (id, key) => write({ ...read(), [id]: key });
export function forgetDeleteKey(id) {
  const map = read();
  delete map[id];
  write(map);
}
