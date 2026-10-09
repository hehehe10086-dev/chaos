// "How to play" — the whole game in 30 seconds.

import { Button, Overlay } from './ui.jsx';

export const RULES = [
  [
    'Take a role',
    'You are one person on one fateful day. Your role card tells you your secret and your goal.',
  ],
  [
    'Talk',
    'Type in plain English. A scribe rewrites your words in the voice of the era. Name someone to speak to them.',
  ],
  [
    'History moves on',
    'Events arrive on a clock. Every character you do not play is AI, with a hidden personality.',
  ],
  [
    'Decide',
    'At key moments one character must choose. Only they see the choice. If time runs out, history chooses.',
  ],
  [
    'See your timeline',
    'After about ten minutes, the ending compares your day with the history books.',
  ],
];

export function RulesList() {
  return (
    <ol className="space-y-4">
      {RULES.map(([title, text], i) => (
        <li key={title} className="flex gap-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-bronze-dim font-display text-sm text-bronze">
            {i + 1}
          </span>
          <div>
            <p className="font-display text-sm tracking-[0.06em] text-marble">{title}</p>
            <p className="text-marble-dim">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RulesDialog({ onClose }) {
  return (
    <Overlay label="How to play" layer="z-50">
      <div className="panel w-[min(94vw,32rem)] animate-rise-in p-6 sm:p-8">
        <h2 className="font-display text-2xl">How to play</h2>
        <div className="mt-6">
          <RulesList />
        </div>
        <Button className="mt-8 w-full" onClick={onClose} autoFocus>
          Got it
        </Button>
      </div>
    </Overlay>
  );
}
