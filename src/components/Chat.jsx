// The shared conversation. A reading game: comfortable line length, clear speakers,
// narrator lines centered and italic, private narrator lines marked as such.

import { useId, useLayoutEffect, useRef, useState } from 'react';
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

const TOOL_BUTTON =
  'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-ink-4 bg-ink-3 px-3 font-display text-xs tracking-[0.08em] text-marble transition-colors hover:bg-ink-4 disabled:cursor-not-allowed disabled:opacity-45 aria-expanded:border-bronze aria-pressed:border-blood-bright';

function QuillIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M20 4c-6 1-11 6-13 12l-2 4 4-2c6-2 11-7 12-13Z"
      />
      <path strokeWidth="1.6" strokeLinecap="round" d="M7 16c3-3 6-6 9-8" />
    </svg>
  );
}

/**
 * The input row. It never grabs focus on its own (on a phone that would pop up the keyboard
 * over the screen); after a send it keeps focus, so you can type the next line.
 * busyHint: shown while a line is being sent (e.g. "The scribe is writing…").
 * assist: Tab assist — { request(text) -> {ok, lines}, send(index) -> {ok} }. Tab (or "Ideas")
 *   shows three lines to say, or three ways to say what you typed; click or Enter says one.
 */
export function Composer({ onSend, placeholder, disabled, hint, footer, busyHint, assist }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ideas, setIdeas] = useState(null); // null | { loading, lines, intent, active }
  const inputRef = useRef(null);
  const request = useRef(0); // the latest suggestion request; older answers are dropped
  const tabMovesOn = useRef(false); // after Esc, Tab leaves the input as usual (no keyboard trap)
  const listId = useId();

  async function run(send) {
    setBusy(true);
    setError(null);
    const result = await send();
    setBusy(false);
    if (result.ok) {
      setText('');
      closeIdeas();
    } else {
      setError(result.error);
    }
    inputRef.current?.focus({ preventScroll: true });
  }

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (value && !busy) run(() => onSend(value));
  }

  async function openIdeas() {
    if (!assist || busy || disabled) return;
    const intent = text.trim();
    const id = ++request.current;
    setError(null);
    setIdeas({ loading: true, lines: [], intent, active: 0 });
    const result = await assist.request(intent);
    if (id !== request.current) return; // closed or asked again meanwhile
    if (result.ok) {
      setIdeas({ loading: false, lines: result.lines, intent, active: 0 });
    } else {
      setIdeas(null);
      setError(result.error);
    }
  }

  function closeIdeas() {
    request.current += 1;
    setIdeas(null);
  }

  const setActive = (i) => setIdeas((s) => (s && !s.loading ? { ...s, active: i } : s));
  const move = (step) =>
    setIdeas((s) =>
      s && !s.loading ? { ...s, active: (s.active + step + s.lines.length) % s.lines.length } : s,
    );

  function onKeyDown(e) {
    if (!assist || e.nativeEvent.isComposing) return;
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (ideas) {
        e.preventDefault();
        move(e.shiftKey ? -1 : 1);
      } else if (!e.shiftKey && !tabMovesOn.current) {
        e.preventDefault();
        openIdeas();
      }
      return;
    }
    if (!ideas) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      tabMovesOn.current = true;
      closeIdeas();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // say the highlighted line, not what is typed
      if (!ideas.loading && !busy) run(() => assist.send(ideas.active));
    }
  }

  const listShown = ideas && !ideas.loading;

  return (
    <form
      onSubmit={submit}
      className="relative border-t border-ink-3 bg-ink-2/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      {ideas && (
        <div className="absolute inset-x-3 bottom-full mb-2 sm:inset-x-6">
          <div className="panel mx-auto max-w-[42rem] bg-ink-2 p-2 shadow-[0_-8px_30px_rgb(0_0_0/0.45)]">
            <div className="flex items-center justify-between gap-2 pl-2">
              <p className="label truncate">
                {ideas.intent ? `Ways to say “${ideas.intent}”` : 'Ideas for your next line'}
              </p>
              <button
                type="button"
                onClick={closeIdeas}
                aria-label="Close the suggestions"
                className="grid size-9 shrink-0 place-items-center rounded text-xl text-marble-dim hover:text-marble"
              >
                ×
              </button>
            </div>
            {ideas.loading ? (
              <p className="px-2 pb-2 text-marble-dim italic" role="status">
                The scribe is thinking…
              </p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Suggested lines" className="space-y-1">
                {ideas.lines.map((line, i) => (
                  <li
                    key={line}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === ideas.active}
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                    onMouseEnter={() => setActive(i)}
                    onClick={() => !busy && run(() => assist.send(i))}
                    className={`min-h-11 cursor-pointer rounded-md px-3 py-2 leading-snug ${
                      i === ideas.active
                        ? 'bg-porphyry-deep/80 ring-1 ring-porphyry'
                        : 'hover:bg-ink-3'
                    }`}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
            <p className="hidden px-2 pt-1 text-xs text-marble-faint sm:block">
              Tab or ↑ ↓ to choose · Enter to say it · Esc to close
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-[42rem] gap-2">
        <label className="sr-only" htmlFor="composer">
          Say something
        </label>
        <input
          id="composer"
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            tabMovesOn.current = false;
            if (ideas) closeIdeas(); // what you typed changed: the ideas are stale
          }}
          onFocus={() => (tabMovesOn.current = false)}
          onKeyDown={onKeyDown}
          maxLength={200}
          autoComplete="off"
          disabled={disabled}
          readOnly={busy}
          placeholder={placeholder}
          role={assist ? 'combobox' : undefined}
          aria-autocomplete={assist ? 'list' : undefined}
          aria-expanded={assist ? Boolean(ideas) : undefined}
          aria-controls={listShown ? listId : undefined}
          aria-activedescendant={listShown ? `${listId}-${ideas.active}` : undefined}
          className="min-h-12 w-full min-w-0 rounded-lg border border-ink-4 bg-ink px-4 text-[17px] text-marble placeholder:text-marble-faint read-only:text-marble-dim focus:border-bronze focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" disabled={disabled || busy || !text.trim()}>
          Send
        </Button>
      </div>
      <div className="mx-auto mt-2 flex max-w-[42rem] flex-wrap items-center justify-between gap-2 text-sm text-marble-faint">
        <div className="flex min-w-0 items-center gap-2">
          {assist && (
            <button
              type="button"
              className={TOOL_BUTTON}
              onClick={() => (ideas ? closeIdeas() : openIdeas())}
              disabled={disabled || busy}
              aria-expanded={Boolean(ideas)}
            >
              <QuillIcon />
              Ideas
              <kbd className="hidden rounded border border-ink-4 px-1 font-body text-[0.7rem] tracking-normal text-marble-faint sm:inline">
                Tab
              </kbd>
            </button>
          )}
          <span className="min-w-0">
            {busy && busyHint ? (
              <span className="text-bronze-bright italic">{busyHint}</span>
            ) : (
              hint
            )}
          </span>
        </div>
        {footer}
      </div>
      <ErrorText error={error} className="mx-auto mt-1 max-w-[42rem]" />
    </form>
  );
}
