// The shared conversation. A reading game: comfortable line length, clear speakers,
// narrator lines centered and italic, private narrator lines marked as such.

import { useLayoutEffect, useRef, useState } from 'react';
import { Medallion } from './Medallion.jsx';
import { Button, ErrorText } from './ui.jsx';

export function MessageList({ view, showOriginal }) {
  const ref = useRef(null);
  const stick = useRef(true); // follow new messages unless the reader scrolled up
  const roleById = Object.fromEntries(view.roles.map((r) => [r.id, r]));
  const playerById = Object.fromEntries(view.players.map((p) => [p.id, p]));

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [view.messages.length, showOriginal]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      <ol className="mx-auto flex max-w-[42rem] flex-col gap-3">
        {view.messages.length === 0 && (
          <li className="py-10 text-center text-marble-faint italic">Nothing has been said yet.</li>
        )}
        {view.messages.map((m) => (
          <Message
            key={m.id}
            message={m}
            role={roleById[m.roleId]}
            to={roleById[m.to]}
            player={playerById[m.playerId]}
            mine={m.playerId === view.you.id || (m.roleId && m.roleId === view.you.roleId)}
            showOriginal={showOriginal}
          />
        ))}
      </ol>
    </div>
  );
}

function Message({ message: m, role, to, player, mine, showOriginal }) {
  if (m.kind === 'act') {
    return (
      <li className="my-3 flex items-center gap-3 text-bronze" aria-label={m.text}>
        <span className="h-px flex-1 bg-bronze-dim/60" />
        <span className="font-display text-xs tracking-[0.3em]">{m.text.toUpperCase()}</span>
        <span className="h-px flex-1 bg-bronze-dim/60" />
      </li>
    );
  }
  if (m.kind === 'narration') {
    return (
      <li className="animate-fade-in px-2 text-center">
        {m.private && <p className="label mb-1 text-porphyry brightness-200">Only you know</p>}
        <p
          className={`text-[1.05rem] italic ${m.private ? 'text-[#d9b3cc]' : 'text-bronze-bright'}`}
        >
          {m.text}
        </p>
      </li>
    );
  }
  if (m.kind === 'system') {
    return <li className="text-center text-sm text-marble-faint">{m.text}</li>;
  }
  if (m.kind === 'chat') {
    return (
      <li className="animate-fade-in">
        <span className="font-semibold text-bronze-bright">{player?.name ?? 'Someone'}:</span>{' '}
        {m.text}
      </li>
    );
  }

  // In-character speech.
  return (
    <li
      className={`flex animate-rise-in gap-3 rounded-lg p-2 ${mine ? 'bg-porphyry-deep/45' : ''}`}
    >
      {role && (
        <Medallion
          name={role.name}
          shortName={role.shortName}
          portraitKey={role.portraitKey}
          size={38}
        />
      )}
      <div className="min-w-0">
        <p className="font-display text-[0.8rem] tracking-[0.08em] text-bronze">
          {role?.shortName ?? '?'}
          {to && <span className="text-marble-faint"> → {to.shortName}</span>}
          {mine && <span className="text-marble-faint"> · you</span>}
        </p>
        <p className="text-[1.08rem] leading-relaxed">{m.text}</p>
        {showOriginal && m.original && (
          <p className="mt-1 text-sm text-marble-faint">
            <span className="label text-[0.6rem] text-marble-faint">You typed</span> {m.original}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * The input row. It never grabs focus on its own (on a phone that would pop up the keyboard
 * over the screen); after a send it keeps focus, so you can type the next line.
 * busyHint: shown while a line is being sent (e.g. "The scribe is writing…").
 */
export function Composer({ onSend, placeholder, disabled, hint, footer, busyHint }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSend(value);
    setBusy(false);
    if (result.ok) setText('');
    else setError(result.error);
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-ink-3 bg-ink-2/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto flex max-w-[42rem] gap-2">
        <label className="sr-only" htmlFor="composer">
          Say something
        </label>
        <input
          id="composer"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          autoComplete="off"
          disabled={disabled}
          readOnly={busy}
          placeholder={placeholder}
          className="min-h-12 w-full min-w-0 rounded-lg border border-ink-4 bg-ink px-4 text-[17px] text-marble placeholder:text-marble-faint read-only:text-marble-dim focus:border-bronze focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" disabled={disabled || busy || !text.trim()}>
          Send
        </Button>
      </div>
      <div className="mx-auto mt-2 flex max-w-[42rem] flex-wrap items-center justify-between gap-2 text-sm text-marble-faint">
        <span>
          {busy && busyHint ? <span className="text-bronze-bright italic">{busyHint}</span> : hint}
        </span>
        {footer}
      </div>
      <ErrorText error={error} className="mx-auto mt-1 max-w-[42rem]" />
    </form>
  );
}
