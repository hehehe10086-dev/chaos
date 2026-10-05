// All calls to the server go through here.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — check your connection', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export const createRoom = (name) =>
  request('/api/room', { method: 'POST', body: { op: 'create', name } });

export const joinRoom = (code, name) =>
  request('/api/room', { method: 'POST', body: { op: 'join', code, name } });

export const fetchState = (code, token, since) =>
  request(`/api/state?code=${code}&since=${since ?? ''}`, { token });

export const sendAction = (code, token, action) =>
  request('/api/action', { method: 'POST', body: { code, action }, token });
