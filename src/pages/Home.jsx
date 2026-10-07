import { useState } from 'react';
import { Medallion } from '../components/Medallion.jsx';
import { RulesList } from '../components/RulesDialog.jsx';
import { Button, ErrorText, Input } from '../components/ui.jsx';
import { createRoom, joinRoom } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { loadName, saveName, saveSession } from '../lib/session.js';

// The landing page shows the first story's cast (portrait keys match the scenario file).
const CAST = [
  ['caesar', 'Julius Caesar', 'Caesar'],
  ['brutus', 'Marcus Brutus', 'Brutus'],
  ['cassius', 'Gaius Cassius', 'Cassius'],
  ['calpurnia', 'Calpurnia', 'Calpurnia'],
  ['antony', 'Mark Antony', 'Antony'],
];

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

  const named = name.trim().length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-4 py-10 sm:py-16">
      <header className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-[0.3em] sm:text-6xl">CHAOS</h1>
        <p className="mt-3 text-lg text-marble-dim italic">
          Step into history&apos;s tipping points.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel overflow-hidden" aria-labelledby="story-title">
          <div className="marble px-6 py-8 text-center sm:px-10">
            <p className="engraved font-display text-xs tracking-[0.4em]">
              ROME · 15 MARCH · 44 BC
            </p>
            <h2 id="story-title" className="engraved mt-3 font-display text-4xl font-bold">
              The Ides of March
            </h2>
            <p className="engraved mt-3 text-xl italic">You know how it ends. Change it.</p>
          </div>
          <div className="space-y-5 p-6 sm:p-8">
            <p className="text-marble-dim">
              Julius Caesar will attend the Senate today. Some of the men he trusts most have hidden
              knives under their togas. Play Caesar, Brutus, Cassius, Calpurnia or Mark Antony — the
              AI plays everyone else.
            </p>
            <p className="label">1–5 players · about 10 minutes · no sign-up</p>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (named) enter(createRoom(name));
              }}
            >
              <label className="sr-only" htmlFor="name">
                Your name
              </label>
              <Input
                id="name"
                placeholder="Your name"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" disabled={busy || !named} className="sm:w-56">
                Create a room
              </Button>
            </form>
            <ul
              className="flex flex-wrap justify-center gap-4 border-t border-ink-3 pt-6"
              aria-label="The cast"
            >
              {CAST.map(([key, name, shortName]) => (
                <li key={key} className="flex w-20 flex-col items-center gap-1 text-center">
                  <Medallion name={name} shortName={shortName} portraitKey={key} size={52} />
                  <span className="font-display text-[0.7rem] tracking-[0.08em] text-marble-dim">
                    {shortName}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="panel p-6" aria-labelledby="join-title">
            <h2 id="join-title" className="font-display text-lg">
              Join friends
            </h2>
            <p className="mt-1 text-marble-dim">
              Enter your name above, then the 4-letter room code.
            </p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                enter(joinRoom(code, name));
              }}
            >
              <label className="sr-only" htmlFor="code">
                Room code
              </label>
              <Input
                id="code"
                placeholder="CODE"
                maxLength={4}
                autoCapitalize="characters"
                className="font-display tracking-[0.3em] uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ''))}
              />
              <Button type="submit" variant="quiet" disabled={busy || !named || code.length !== 4}>
                Join
              </Button>
            </form>
          </section>
          <section className="panel p-6" aria-labelledby="how-title">
            <h2 id="how-title" className="mb-5 font-display text-lg">
              How to play
            </h2>
            <RulesList />
          </section>
        </div>
      </div>

      <ErrorText error={error} className="text-center" />
    </main>
  );
}
