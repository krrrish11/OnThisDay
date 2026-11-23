import bcrypt from 'bcryptjs';

const COST = 10;
export const hashPassword = (plain) => bcrypt.hash(plain, COST);

// Compared against when the username does not exist, so "no such user" and "wrong password"
// take the same time and cannot be told apart from outside.
const DUMMY = bcrypt.hashSync('not-a-real-password', COST);
export async function verifyPassword(plain, hash) {
  const ok = await bcrypt.compare(plain, hash || DUMMY);
  return Boolean(hash) && ok;
}
