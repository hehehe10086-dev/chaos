import { useCallback, useState } from 'react';
import { Button, ErrorText, Input } from '../components/ui.jsx';
import { useRoomState } from '../hooks/useRoomState.js';
import { joinRoom, sendAction } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { clearSession, loadName, loadSession, saveName, saveSession } from '../lib/session.js';
import Ending from './Ending.jsx';
import Game from './Game.jsx';
import Lobby from './Lobby.jsx';

export default function Room({ code }) {
  const [session, setSession] = useState(() => loadSession(code));

  if (!session) return <JoinForm code={code} onJoined={setSession} />;
  return (
    <RoomView
      code={code}
      session={session}
      onLostSession={() => {
        clearSession(code);
        setSession(null);
      }}
    />
  );
}

// Shown when you open an invite link (or your saved session is gone).
function JoinForm({ code, onJoined }) {
  const [name, setName] = useState(loadName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function join(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await joinRoom(code, name);
      const session = { token: res.token, playerId: res.playerId };
      saveName(name.trim());
      saveSession(code, session);
      onJoined(session);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <p className="label text-center">The Ides of March</p>
      <h1 className="text-center font-display text-2xl">
        Join room <span className="tracking-[0.25em] text-bronze-bright">{code}</span>
      </h1>
      <form onSubmit={join} className="flex flex-col gap-4">
        <label className="sr-only" htmlFor="join-name">
          Your name
        </label>
        <Input
          id="join-name"
          placeholder="Your name"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          Join
        </Button>
      </form>
      <ErrorText error={error} className="text-center" />
      <Button variant="ghost" onClick={() => navigate('/')}>
        Back to start
      </Button>
    </main>
  );
}

function RoomView({ code, session, onLostSession }) {
  const { view, receivedAt, setView, error } = useRoomState(code, session.token);

  /** Sends an action; the response updates the screen at once. Never throws. */
  const act = useCallback(
    async (action) => {
      try {
        const res = await sendAction(code, session.token, action);
        setView(res.view);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      }
    },
    [code, session.token, setView],
  );

  if (error?.status === 404 || error?.status === 401) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
        <p className="text-lg">
          {error.status === 404
            ? 'This room does not exist or has expired.'
            : 'You are no longer a player in this room.'}
        </p>
        <Button onClick={error.status === 401 ? onLostSession : () => navigate('/')}>
          {error.status === 401 ? 'Join again' : 'Back to start'}
        </Button>
      </main>
    );
  }

  if (!view) return <p className="p-10 text-center text-marble-dim italic">Opening the doors…</p>;

  const connection = error ? `Connection problem: ${error.message}` : null;
  if (view.phase === 'lobby') return <Lobby view={view} act={act} connection={connection} />;
  if (view.phase === 'ended') return <Ending view={view} act={act} />;
  return <Game view={view} receivedAt={receivedAt} act={act} connection={connection} />;
}
