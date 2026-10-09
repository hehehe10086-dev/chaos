import { useState } from 'react';
import { Composer, MessageList } from '../components/Chat.jsx';
import { Medallion } from '../components/Medallion.jsx';
import { RulesDialog } from '../components/RulesDialog.jsx';
import { Button, ErrorText } from '../components/ui.jsx';

export default function Lobby({ view, act, connection }) {
  const [rules, setRules] = useState(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const me = view.players.find((p) => p.id === view.you.id);
  const host = view.players.find((p) => p.id === view.hostId);
  const isHost = view.hostId === view.you.id;
  const canStart = isHost || !host?.online;

  async function pick(roleId) {
    setError(null);
    const result = await act({ type: 'pickRole', roleId });
    if (!result.ok) setError(result.error);
  }

  async function start() {
    setStarting(true);
    setError(null);
    const result = await act({ type: 'start' });
    if (!result.ok) {
      setError(result.error);
      setStarting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label">{view.scenario.setting}</p>
          <h1 className="font-display text-3xl sm:text-4xl">{view.scenario.title}</h1>
        </div>
        {/* On a phone the invite box takes the full width and "How to play" wraps below it. */}
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto">
          <InviteBox code={view.code} />
          <Button variant="ghost" onClick={() => setRules(true)}>
            How to play
          </Button>
        </div>
      </header>

      <p className="max-w-3xl text-lg text-marble-dim italic">{view.scenario.intro}</p>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-4 sm:p-6" aria-labelledby="roles-title">
          <h2 id="roles-title" className="font-display text-lg">
            Choose your role
          </h2>
          <p className="mt-1 text-marble-dim">
            Every role nobody picks is played by AI. You can play alone.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {view.roles.map((role) => {
              const mine = me?.pick === role.id;
              const taken = role.pickedBy && !mine;
              return (
                <li key={role.id}>
                  <button
                    onClick={() => pick(role.id)}
                    disabled={taken}
                    aria-pressed={mine}
                    className={`flex h-full w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      mine
                        ? 'border-bronze bg-bronze/10'
                        : 'border-ink-4 bg-ink hover:border-bronze-dim disabled:opacity-50 disabled:hover:border-ink-4'
                    }`}
                  >
                    <Medallion
                      name={role.name}
                      shortName={role.shortName}
                      portraitKey={role.portraitKey}
                      size={52}
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-sm">{role.name}</span>
                      <span className="block text-sm text-marble-dim">{role.publicIdentity}</span>
                      <span
                        className={`mt-1 block text-sm ${mine ? 'text-bronze-bright' : 'text-marble-faint'}`}
                      >
                        {mine ? 'Your role' : taken ? `Picked by ${role.pickedBy}` : 'Open'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                onClick={() => pick('random')}
                aria-pressed={me?.pick === 'random'}
                className={`flex h-full w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  me?.pick === 'random'
                    ? 'border-bronze bg-bronze/10'
                    : 'border-ink-4 bg-ink hover:border-bronze-dim'
                }`}
              >
                <span className="grid size-[52px] shrink-0 place-items-center rounded-full border border-dashed border-bronze-dim font-display text-xl text-bronze">
                  ?
                </span>
                <span>
                  <span className="block font-display text-sm">Random role</span>
                  <span className="block text-sm text-marble-dim">Let fate decide.</span>
                </span>
              </button>
            </li>
          </ul>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {canStart ? (
              <Button onClick={start} disabled={starting} className="sm:w-64">
                {starting ? 'Dawn breaks…' : 'Start the day'}
              </Button>
            ) : (
              <p className="text-marble-dim">Waiting for {host?.name ?? 'the host'} to start…</p>
            )}
            <p className="text-sm text-marble-faint">
              {view.players.length} of {view.roles.length} seats taken by humans
            </p>
          </div>
          <ErrorText error={error} className="mt-3" />
        </section>

        <section
          className="panel flex min-h-[22rem] flex-col overflow-hidden"
          aria-labelledby="players-title"
        >
          <div className="border-b border-ink-3 p-4">
            <h2 id="players-title" className="font-display text-lg">
              In the room
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {view.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded bg-ink-3 px-2 py-1 text-sm"
                >
                  <span
                    className={`size-2 rounded-full ${p.online ? 'bg-[#7fae6b]' : 'bg-marble-faint'}`}
                    aria-label={p.online ? 'online' : 'away'}
                  />
                  {p.name}
                  {p.id === view.hostId && <span className="text-bronze">· host</span>}
                  {p.id === view.you.id && <span className="text-marble-faint">· you</span>}
                </li>
              ))}
            </ul>
          </div>
          <MessageList view={view} />
          <Composer
            placeholder="Chat with the room…"
            onSend={(text) => act({ type: 'say', text })}
            hint={connection}
          />
        </section>
      </div>
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </main>
  );
}

function InviteBox({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const link = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this invite link:', link); // clipboard needs https; fallback for LAN
    }
  }
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-4 bg-ink-2 py-1 pr-1 pl-4 sm:w-auto">
      <div>
        <p className="label text-[0.6rem]">Room code</p>
        <p className="font-display text-2xl tracking-[0.25em] text-bronze-bright">{code}</p>
      </div>
      <Button variant="quiet" onClick={copy}>
        {copied ? 'Copied!' : 'Copy link'}
      </Button>
    </div>
  );
}
