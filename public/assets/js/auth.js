// auth.js - simple authentication client

/**
 * Perform admin login against /api/auth
 * @param {string} username
 * @param {string} password
 */
export async function login(username, password) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  // parse response body for better error messages
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json && json.error) ? json.error : 'Unauthorized';
    throw new Error(msg);
  }
  return json;
}
