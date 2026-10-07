import { useCallback, useEffect, useRef, useState } from 'react';
import { ActCard } from '../components/ActCard.jsx';
import { CharacterList } from '../components/CharacterList.jsx';
import { Composer, MessageList } from '../components/Chat.jsx';
import { DecisionModal } from '../components/DecisionModal.jsx';
import { RoleCard, RoleSecrets } from '../components/RoleCard.jsx';
import { RulesDialog } from '../components/RulesDialog.jsx';
import { TAKEOVER_LIST_ID, TakeoverPanel } from '../components/TakeoverPanel.jsx';
import { Button } from '../components/ui.jsx';
import { useGameClock } from '../hooks/useGameClock.js';
import { clockText, roman } from '../lib/format.js';

function useRoleCardSeen(code, gameId) {
  const key = `chaos:rolecard:${code}:${gameId}`;
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(key, '1');
    } catch {
      // storage blocked: the card simply shows again after a refresh
    }
  }, [key]);
  return [seen, markSeen];
}

/** Shows the act title card when a new act begins (and on load, if it just began). */
function useActCard(act, t) {
  const [shown, setShown] = useState(null);
  const lastId = useRef(null);
  useEffect(() => {
    if (!act) return;
    if (lastId.current === null) {
      lastId.current = act.id;
      if (t - act.startAt < 6) setShown(act);
    } else if (act.id !== lastId.current) {
      lastId.current = act.id;
      setShown(act);
    }
  }, [act, t]);
  return [shown, useCallback(() => setShown(null), [])];
}

export default function Game({ view, receivedAt, act, connection }) {
  const game = view.game;
  const t = useGameClock(game.clock, receivedAt);
  const [actCard, closeActCard] = useActCard(game.act, t);
  const [roleCardSeen, markRoleCardSeen] = useRoleCardSeen(view.code, game.id);
  const [showOriginal, setShowOriginal] = useState(false);
  const [rules, setRules] = useState(false);
  const [tab, setTab] = useState('story'); // phones: story | cast | role

  const myRole = game.myRole;
  const roleById = Object.fromEntries(view.roles.map((r) => [r.id, r]));
  const othersDeciding = game.deciding.filter((d) => d.roleId !== view.you.roleId);

  const decide = useCallback(
    (decisionId, optionId) => act({ type: 'decide', decisionId, optionId }),
    [act],
  );

  // Spectators: open the panel with the "Take over" buttons (a tab on phones) and focus it,
  // once React has shown it.
  const showTakeover = () => {
    setTab('role');
    setTimeout(() => document.querySelector(`#${TAKEOVER_LIST_ID} button:not(:disabled)`)?.focus());
  };

  const actLeft = game.act ? game.act.endsAt - t : 0;
  const dayLeft = game.clock.duration - t;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-ink-3 bg-ink-2/90 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="label truncate text-[0.62rem]">{view.scenario.title}</p>
          {game.act && (
            <p className="truncate font-display text-sm sm:text-base">
              <span className="text-bronze">Act {roman(game.act.number)}</span> · {game.act.title}
            </p>
          )}
        </div>
        <div className="text-right" aria-label={`${clockText(actLeft)} left in this act`}>
          <p className="font-display text-lg tabular-nums">{clockText(actLeft)}</p>
          <p className="text-xs text-marble-faint tabular-nums">day ends in {clockText(dayLeft)}</p>
        </div>
        <Button
          variant="quiet"
          className="min-h-10 px-3"
          onClick={() => setRules(true)}
          aria-label="How to play"
        >
          ?
        </Button>
      </header>

      <nav className="flex border-b border-ink-3 lg:hidden" aria-label="Game panels">
        {[
          ['story', 'Story'],
          ['cast', 'Cast'],
          ['role', myRole ? 'Your role' : 'Join'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`min-h-11 flex-1 font-display text-xs tracking-[0.12em] ${
              tab === id ? 'border-b-2 border-bronze text-marble' : 'text-marble-faint'
            }`}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`w-full overflow-y-auto p-3 lg:block lg:w-72 lg:border-r lg:border-ink-3 ${tab === 'cast' ? 'block' : 'hidden'}`}
        >
          <p className="label mb-3 px-2">The cast</p>
          <CharacterList view={view} />
        </aside>

        <main className={`min-h-0 flex-1 flex-col lg:flex ${tab === 'story' ? 'flex' : 'hidden'}`}>
          <MessageList view={view} showOriginal={showOriginal} />
          {othersDeciding.map((d) => (
            <p
              key={d.roleId}
              className="border-t border-blood/40 bg-blood/10 px-4 py-2 text-center text-sm"
              role="status"
            >
              <span className="text-blood-bright">{roleById[d.roleId]?.shortName} must decide</span>{' '}
              · {clockText(d.deadline - t)}
            </p>
          ))}
          <Composer
            disabled={!myRole}
            placeholder={
              myRole ? `Speak as ${roleById[myRole.id]?.shortName}…` : 'You are watching this game'
            }
            onSend={(text) => act({ type: 'say', text })}
            busyHint="The scribe is writing…"
            hint={
              connection ??
              (myRole ? (
                // Phones have no room for it; the role card says the same before the game.
                <span className="hidden sm:inline">
                  Plain English is fine. Name someone to talk to them.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={showTakeover}
                  className="min-h-10 text-bronze-bright underline underline-offset-4 hover:text-marble"
                >
                  Take over a character
                </button>
              ))
            }
            footer={
              myRole && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOriginal}
                    onChange={(e) => setShowOriginal(e.target.checked)}
                    className="size-4 accent-bronze"
                  />
                  Show what I typed
                </label>
              )
            }
          />
        </main>

        <aside
          className={`w-full overflow-y-auto p-4 lg:block lg:w-80 lg:border-l lg:border-ink-3 ${tab === 'role' ? 'block' : 'hidden'}`}
        >
          {myRole ? (
            <>
              <p className="label mb-1">You are</p>
              <p className="font-display text-xl">{myRole.name}</p>
              <p className="mb-4 text-marble-dim">{myRole.publicIdentity}</p>
              <RoleSecrets role={myRole} />
            </>
          ) : (
            <TakeoverPanel view={view} act={act} onTakenOver={() => setTab('story')} />
          )}
        </aside>
      </div>

      {myRole && !roleCardSeen && (
        <RoleCard
          role={myRole}
          shortName={roleById[myRole.id]?.shortName}
          portraitKey={roleById[myRole.id]?.portraitKey ?? myRole.id}
          onClose={markRoleCardSeen}
        />
      )}
      {game.decision && (
        <DecisionModal key={game.decision.id} decision={game.decision} t={t} onChoose={decide} />
      )}
      {actCard && <ActCard act={actCard} onDone={closeActCard} />}
      {rules && <RulesDialog onClose={() => setRules(false)} />}
    </div>
  );
}
