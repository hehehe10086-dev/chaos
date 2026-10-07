import { useState } from 'react';
import { MessageList } from '../components/Chat.jsx';
import { Medallion } from '../components/Medallion.jsx';
import { Button, ErrorText } from '../components/ui.jsx';
import { navigate } from '../lib/router.js';

export default function Ending({ view, act }) {
  const ending = view.game.ending;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState(false);
  const roleById = Object.fromEntries(view.roles.map((r) => [r.id, r]));

  async function playAgain() {
    setBusy(true);
    setError(null);
    const result = await act({ type: 'playAgain', gameId: view.game.id });
    if (!result.ok) {
      // Someone else already started the next game: the next poll shows it.
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="animate-rise-in text-center">
        <p className="font-display text-xs tracking-[0.4em] text-blood-bright">THE ENDING</p>
        <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{ending.title}</h1>
        <div className="mx-auto mt-5 h-0.5 w-24 bg-blood" aria-hidden="true" />
      </header>

      <section className="panel p-6 text-[1.15rem] leading-relaxed sm:p-8" aria-label="Epilogue">
        {ending.epilogue ? (
          <p className="animate-fade-in">{ending.epilogue}</p>
        ) : (
          <p className="text-marble-dim italic" role="status">
            The chroniclers are writing…
          </p>
        )}
        {ending.deathPoem && (
          <blockquote className="mt-6 border-t border-ink-3 pt-6 text-center text-xl text-bronze-bright italic">
            {ending.deathPoem[0]}
            <br />
            {ending.deathPoem[1]}
          </blockquote>
        )}
      </section>

      <section aria-labelledby="compare-title">
        <h2 id="compare-title" className="mb-3 font-display text-lg">
          History vs your timeline
        </h2>
        <div className="panel overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-ink-3/60">
              <tr>
                <th scope="col" className="label p-3">
                  Question
                </th>
                <th scope="col" className="label p-3">
                  History
                </th>
                <th scope="col" className="label p-3">
                  Your timeline
                </th>
              </tr>
            </thead>
            <tbody>
              {ending.comparison.map((row) => (
                <tr key={row.question} className="border-t border-ink-3 align-top">
                  <th scope="row" className="p-3 font-normal text-marble-dim">
                    {row.question}
                  </th>
                  <td className="p-3">{row.history}</td>
                  <td className={`p-3 ${row.changed ? 'font-semibold text-bronze-bright' : ''}`}>
                    {row.yours}
                    {row.changed && <span className="ml-1 text-xs text-blood-bright">changed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="reveal-title">
        <h2 id="reveal-title" className="mb-3 font-display text-lg">
          Every secret, revealed
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ending.reveal.map((r) => {
            const role = roleById[r.roleId];
            return (
              <li key={r.roleId} className="panel flex gap-3 p-4">
                <Medallion
                  name={r.name}
                  shortName={role?.shortName}
                  portraitKey={role?.portraitKey ?? r.roleId}
                  size={48}
                />
                <div className="min-w-0 text-sm">
                  <p className="font-display text-base">{r.name}</p>
                  <p className="text-marble-faint">
                    {r.playedBy ? `Played by ${r.playedBy}` : 'Played by AI'}
                  </p>
                  <p className="mt-2">
                    <span className="label text-[0.6rem]">Secret</span> {r.secret}
                  </p>
                  <p className="mt-1">
                    <span className="label text-[0.6rem]">Goal</span> {r.goal}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {ending.decisions.length > 0 && (
        <section aria-labelledby="choices-title">
          <h2 id="choices-title" className="mb-3 font-display text-lg">
            The choices that made this day
          </h2>
          <ol className="panel divide-y divide-ink-3">
            {ending.decisions.map((d) => (
              <li key={d.prompt} className="p-3">
                <span className="text-bronze">{roleById[d.roleId]?.shortName}</span> — {d.prompt}{' '}
                <span className="font-semibold">{d.choice}</span>
                <span className="text-sm text-marble-faint">
                  {d.by === 'timeout'
                    ? ' (time ran out — history chose)'
                    : d.by === 'ai'
                      ? ' (AI)'
                      : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={playAgain} disabled={busy} className="sm:flex-1">
          {busy ? 'Rewinding the day…' : 'Play again'}
        </Button>
        <Button variant="quiet" onClick={() => setTranscript((v) => !v)} className="sm:flex-1">
          {transcript ? 'Hide the transcript' : 'Read the transcript'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Leave
        </Button>
      </div>
      <ErrorText error={error} className="text-center" />
      <p className="-mt-4 text-center text-sm text-marble-faint">
        Play again keeps your roles. Every AI character gets a new personality.
      </p>

      {transcript && (
        <section
          className="panel flex max-h-[70vh] flex-col overflow-hidden"
          aria-label="Transcript"
        >
          <MessageList view={view} />
        </section>
      )}
    </main>
  );
}
