// For someone who joined after the day began: pick an AI character and play it from here on.
// The server writes a short recap of what you missed; it opens on your role card.

import { useState } from 'react';
import { Medallion } from './Medallion.jsx';
import { Button, ErrorText } from './ui.jsx';

export const TAKEOVER_LIST_ID = 'takeover-list';

export function TakeoverPanel({ view, act, onTakenOver }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const deciding = new Set(view.game.deciding.map((d) => d.roleId));
  const open = view.roles.filter((r) => r.controller === 'ai');

  async function takeOver(roleId) {
    setBusy(roleId);
    setError(null);
    const result = await act({ type: 'takeover', roleId });
    if (result.ok) {
      onTakenOver?.();
    } else {
      setError(result.error);
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="takeover-title">
      <h2 id="takeover-title" className="font-display text-lg">
        Join the story
      </h2>
      <p className="mt-1 text-marble-dim">
        The day has already begun. Take a character over from the AI — you get a short recap of what
        you missed, then play on.
      </p>
      {open.length > 0 ? (
        <ul id={TAKEOVER_LIST_ID} className="mt-4 flex flex-col gap-2">
          {open.map((role) => (
            <li
              key={role.id}
              className="flex items-center gap-3 rounded-lg border border-ink-4 bg-ink p-2"
            >
              <Medallion
                name={role.name}
                shortName={role.shortName}
                portraitKey={role.portraitKey}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm">{role.name}</p>
                <p className="truncate text-sm text-marble-faint">{role.publicIdentity}</p>
              </div>
              <Button
                variant="quiet"
                className="min-h-10 px-3"
                disabled={busy != null || deciding.has(role.id)}
                onClick={() => takeOver(role.id)}
              >
                {busy === role.id ? 'Joining…' : deciding.has(role.id) ? 'Deciding…' : 'Take over'}
                <span className="sr-only"> {role.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-marble-dim">
          Every character is played by a human. Watch along — every secret is revealed at the end.
        </p>
      )}
      <ErrorText error={error} className="mt-3" />
    </section>
  );
}
