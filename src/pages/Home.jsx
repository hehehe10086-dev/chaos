import { useState } from 'react';
import { Button, ErrorText, Input } from '../components/ui.jsx';
import { createRoom, joinRoom } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { loadName, saveName, saveSession } from '../lib/session.js';

export default function Home() {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function enter(promise) {
    setBusy(true);
    setError(null);
    try {
      const res = await promise;
      saveName(name.trim());
      saveSession(res.code, { token: res.token, playerId: res.playerId });
      navigate(`/room/${res.code}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="text-5xl font-bold tracking-widest">CHAOS</h1>
        <p className="mt-2 text-stone-400">Step into history&apos;s tipping points.</p>
      </header>

      <Input
        placeholder="Your name"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Button disabled={busy || !name.trim()} onClick={() => enter(createRoom(name))}>
        Create room
      </Button>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enter(joinRoom(code, name));
        }}
      >
        <Input
          placeholder="Room code"
          maxLength={4}
          autoCapitalize="characters"
          className="font-mono tracking-widest uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ''))}
        />
        <Button type="submit" disabled={busy || !name.trim() || code.length !== 4}>
          Join
        </Button>
      </form>

      <ErrorText error={error} />
    </main>
  );
}
