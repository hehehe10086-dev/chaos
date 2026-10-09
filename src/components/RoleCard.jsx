// The private role card shown when a game starts: who you are, your secret, your goal.
// A player who takes a role over mid-game sees a recap instead ("Previously…", and the secret
// and goal in the light of what has happened).
// Kept compact on phones, so "I understand" is visible without scrolling.

import { Button, Overlay } from './ui.jsx';
import { Medallion } from './Medallion.jsx';

export function RoleCard({ role, shortName, portraitKey, onClose }) {
  const recap = role.recap;
  return (
    <Overlay label={recap ? 'You take over' : 'Your role'}>
      <div className="panel w-[min(94vw,30rem)] animate-rise-in p-5 sm:p-8">
        <p className="label text-center">
          {recap ? 'You take over — keep it secret' : 'Your role — keep it secret'}
        </p>
        <div className="mt-3 flex flex-col items-center text-center">
          <Medallion name={role.name} shortName={shortName} portraitKey={portraitKey} size={80} />
          <h2 className="mt-2 font-display text-2xl sm:text-3xl">{role.name}</h2>
          <p className="text-marble-dim">{role.publicIdentity}</p>
        </div>
        {recap && (
          <div className="mt-5 rounded-lg border border-bronze-dim/60 p-3 sm:p-4">
            <p className="label">Previously</p>
            <p className="mt-1">{recap.happened}</p>
          </div>
        )}
        <RoleSecrets
          role={recap ? { ...role, secret: recap.secret, goal: recap.goal } : role}
          className={recap ? 'mt-3' : 'mt-5'}
        />
        <p className="mt-4 text-center text-sm text-marble-dim">
          Type in plain English — the scribe turns it into the voice of the era. Name someone to
          talk to them.
        </p>
        <Button className="mt-4 w-full" onClick={onClose} autoFocus>
          I understand
        </Button>
      </div>
    </Overlay>
  );
}

export function RoleSecrets({ role, className = '' }) {
  return (
    <dl className={`space-y-3 ${className}`}>
      <div className="rounded-lg border border-porphyry bg-porphyry-deep/60 p-3 sm:p-4">
        <dt className="label">Your secret</dt>
        <dd className="mt-1">{role.secret}</dd>
      </div>
      <div className="rounded-lg border border-bronze-dim bg-ink p-3 sm:p-4">
        <dt className="label">Your goal</dt>
        <dd className="mt-1">{role.goal}</dd>
      </div>
      {role.facts.length > 0 && (
        <div className="rounded-lg border border-ink-4 p-3 sm:p-4">
          <dt className="label">Only you know</dt>
          {role.facts.map((fact) => (
            <dd key={fact} className="mt-1 text-marble-dim">
              {fact}
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
}
