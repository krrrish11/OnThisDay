const USERNAME = /^[a-z0-9_]{3,20}$/;

/** Usernames are stored lowercase, so "Krrish" and "krrish" are the same person. */
export function validateCredentials(body, { forRegister }) {
  const src = body && typeof body === 'object' ? body : {};
  const username = String(src.username ?? '').trim().toLowerCase();
  const password = typeof src.password === 'string' ? src.password : '';
  const errors = {};
  if (!USERNAME.test(username)) errors.username = 'Use 3 to 20 letters, numbers or underscores.';
  if (forRegister) {
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (Buffer.byteLength(password) > 72) errors.password = 'Use at most 72 characters (bcrypt limit).';
    else if (password.toLowerCase() === username) errors.password = 'Password cannot be the same as your username.';
  } else if (!password || Buffer.byteLength(password) > 72) {
    errors.password = 'Enter your password.';
  }
  return Object.keys(errors).length ? { errors } : { value: { username, password } };
}
