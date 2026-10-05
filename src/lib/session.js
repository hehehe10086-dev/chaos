// Remembers who you are in each room, so a refresh keeps your identity.
// localStorage is per-browser: a normal window and an incognito window are different players.

const sessionKey = (code) => `chaos:session:${code}`;
const NAME_KEY = 'chaos:name';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked (some private modes)
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore — the game still works for this tab, it just won't survive a refresh
  }
}

/** @returns {{token: string, playerId: string} | null} */
export function loadSession(code) {
  try {
    return JSON.parse(read(sessionKey(code)));
  } catch {
    return null;
  }
}

export function saveSession(code, session) {
  write(sessionKey(code), JSON.stringify(session));
}

export function clearSession(code) {
  write(sessionKey(code), null);
}

export const loadName = () => read(NAME_KEY) ?? '';
export const saveName = (name) => write(NAME_KEY, name);
