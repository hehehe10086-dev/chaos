// A decision point, for the player who must decide. Blood red = the moment matters.
// If the countdown runs out, history's choice is made for you (on the server).

import { useState } from 'react';
import { clockText } from '../lib/format.js';
import { ErrorText, Overlay } from './ui.jsx';

export function DecisionModal({ decision, t, onChoose }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const total = decision.deadline - decision.openedAt;
  const left = Math.max(0, decision.deadline - t);

  async function choose(optionId) {
    setBusy(optionId);
    setError(null);
    const result = await onChoose(decision.id, optionId);
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
    }
  }

  return (
    <Overlay label="Your decision" layer="z-45">
      <div className="w-[min(94vw,32rem)] animate-rise-in rounded-xl border-2 border-blood bg-ink-2 p-6 shadow-[0_0_60px_rgb(161_29_29/0.35)] sm:p-8">
        <div className="flex items-center justify-between">
          <p className="font-display text-xs tracking-[0.3em] text-blood-bright">YOU MUST DECIDE</p>
          <p className="font-display text-lg text-marble tabular-nums" aria-live="off">
            {clockText(left)}
          </p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded bg-ink-4" aria-hidden="true">
          <div
            className="h-full bg-blood transition-[width] duration-300 ease-linear"
            style={{ width: `${(left / total) * 100}%` }}
          />
        </div>
        <h2 className="mt-6 font-display text-2xl leading-snug">{decision.prompt}</h2>
        <div className="mt-6 flex flex-col gap-3">
          {decision.options.map((option) => (
            <button
              key={option.id}
              disabled={busy != null}
              onClick={() => choose(option.id)}
              className="min-h-14 rounded-lg border border-ink-4 bg-ink px-5 text-left text-lg transition-colors hover:border-blood-bright hover:bg-blood/15 disabled:opacity-50"
            >
              {busy === option.id ? 'Deciding…' : option.label}
            </button>
          ))}
        </div>
        <ErrorText error={error} className="mt-4" />
        <p className="mt-5 text-sm text-marble-faint">If time runs out, history decides for you.</p>
      </div>
    </Overlay>
  );
}
