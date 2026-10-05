import { useState } from 'react';
import { Button, ErrorText, Input } from '../components/ui.jsx';
import { useRoomState } from '../hooks/useRoomState.js';
import { joinRoom, sendAction } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { clearSession, loadName, loadSession, saveName, saveSession } from '../lib/session.js';

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
      <h1 className="text-center text-2xl">
        Join room <span className="font-mono font-bold tracking-widest text-amber-400">{code}</span>
      </h1>
      <form onSubmit={join} className="flex flex-col gap-4">
        <Input
          placeholder="Your name"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          Join
        </Button>
      </form>
      <ErrorText error={error} />
      <button className="text-sm text-stone-400 underline" onClick={() => navigate('/')}>
        Back to start
      </button>
    </main>
  );
}

function RoomView({ code, session, onLostSession }) {
  const { view, setView, error } = useRoomState(code, session.token);
  const [text, setText] = useState('');
  const [actionError, setActionError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function act(action) {
    setActionError(null);
    try {
      const res = await sendAction(code, session.token, action);
      setView(res.view);
      return true;
    } catch (err) {
      setActionError(err);
      return false;
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this invite link:', link); // clipboard needs https; fallback for LAN
    }
  }

  if (error?.status === 404 || error?.status === 401) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
        <p>
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

  if (!view) return <p className="p-6 text-center text-stone-400">Connecting…</p>;

  const nameOf = (id) => view.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-stone-400 uppercase">Room code</p>
          <p className="font-mono text-3xl font-bold tracking-widest text-amber-400">{code}</p>
        </div>
        <Button className="bg-stone-700 text-stone-100 active:bg-stone-600" onClick={copyInvite}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </Button>
      </header>

      <section className="rounded-lg bg-stone-800 p-4">
        <p className="text-sm text-stone-400">Players ({view.players.length})</p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className={`rounded px-2 py-1 ${p.id === view.you?.id ? 'bg-amber-500 text-stone-900' : 'bg-stone-700'}`}
            >
              {p.name}
              {p.id === view.you?.id && ' (you)'}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-stone-400">
          Only you can see this — your secret number:{' '}
          <span className="font-mono text-lg text-amber-300">{view.you?.secret}</span>
        </p>
      </section>

      <section className="flex items-center justify-between rounded-lg bg-stone-800 p-4">
        <div>
          <p className="text-sm text-stone-400">Shared counter</p>
          <p className="font-mono text-4xl">{view.counter}</p>
        </div>
        <Button onClick={() => act({ type: 'increment' })}>+1</Button>
      </section>

      <section className="flex flex-1 flex-col gap-3 rounded-lg bg-stone-800 p-4">
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {view.messages.length === 0 && <li className="text-stone-500">No messages yet.</li>}
          {view.messages.map((m) => (
            <li key={m.id}>
              <span className="font-semibold text-amber-300">{nameOf(m.playerId)}:</span> {m.text}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ type: 'say', text })) setText('');
          }}
        >
          <Input
            placeholder="Say something"
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={!text.trim()}>
            Send
          </Button>
        </form>
      </section>

      <ErrorText
        error={actionError ?? (error && { message: `Connection problem: ${error.message}` })}
      />
      <p className="text-center text-xs text-stone-500">version {view.version}</p>
    </main>
  );
}
