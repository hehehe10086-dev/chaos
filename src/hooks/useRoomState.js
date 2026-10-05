// Keeps a room's view up to date by polling the server.
// - polls every POLL_MS while the tab is visible, pauses when hidden (saves Redis commands)
// - sends the version it has, so the server can answer "no change" cheaply
// - setView lets an action response update the screen immediately, without waiting for a poll

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchState } from '../lib/api.js';

const POLL_MS = 1500;

export function useRoomState(code, token) {
  const [view, setViewState] = useState(null);
  const [error, setError] = useState(null);
  const versionRef = useRef(null);

  // Never go backwards: a slow poll response must not overwrite a newer action response.
  const setView = useCallback((next) => {
    if (versionRef.current != null && next.version < versionRef.current) return;
    versionRef.current = next.version;
    setViewState(next);
  }, []);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let first = true;
    let timer;

    async function poll() {
      clearTimeout(timer);
      // Always fetch once on load; after that, only poll while the tab is visible.
      if (stopped || (document.hidden && !first)) return;
      first = false;
      try {
        const data = await fetchState(code, token, versionRef.current);
        if (stopped) return;
        if (data.changed) setView(data.view);
        setError(null);
      } catch (err) {
        if (stopped) return;
        setError(err);
        if (err.status === 401 || err.status === 404) return; // fatal: stop polling
      }
      timer = setTimeout(poll, POLL_MS);
    }

    const onVisibility = () => !document.hidden && poll();
    document.addEventListener('visibilitychange', onVisibility);
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [code, token, setView]);

  return { view, setView, error };
}
