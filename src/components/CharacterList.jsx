// Who is in the story: portrait, name, and whether a human or the AI plays them.

import { Medallion } from './Medallion.jsx';
import { Badge } from './ui.jsx';

export function CharacterList({ view }) {
  const deciding = new Set((view.game?.deciding ?? []).map((d) => d.roleId));
  return (
    <ul className="flex flex-col gap-2">
      {view.roles.map((role) => {
        const you = role.id === view.you.roleId;
        return (
          <li
            key={role.id}
            className={`flex items-center gap-3 rounded-lg p-2 ${you ? 'bg-porphyry-deep/60 ring-1 ring-porphyry' : ''}`}
          >
            <Medallion
              name={role.name}
              shortName={role.shortName}
              portraitKey={role.portraitKey}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm">{role.name}</span>
                {role.controller && <Badge kind={role.controller} />}
              </p>
              <p className="truncate text-sm text-marble-faint">
                {you
                  ? 'You'
                  : role.playerName
                    ? `Played by ${role.playerName}`
                    : role.publicIdentity}
              </p>
              {deciding.has(role.id) && <p className="text-sm text-blood-bright">Deciding…</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
