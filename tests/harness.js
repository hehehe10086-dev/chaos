// Drives whole games headlessly: a fake clock, the real room API on the in-memory store,
// and the background AI worker awaited after every request.

import { createRoom, joinRoom, performAction, pollRoom } from '../server/rooms.js';
import { createMemoryStore } from '../server/store/memory.js';

export const TIME_SCALE = 0.02; // 600 scenario seconds = 12 real seconds of fake time

export function harness({ timeScale = TIME_SCALE, seed = 'test-seed' } = {}) {
  let now = 1_000_000_000;
  const background = [];
  const options = () => ({
    now,
    timeScale,
    seed,
    clock: () => now,
    background: (promise) => background.push(promise),
  });
  const settle = async () => {
    while (background.length) await background.shift();
  };

  return {
    get now() {
      return now;
    },
    /** Moves the fake clock forward by scenario seconds. */
    wait(seconds) {
      now += seconds * 1000 * timeScale;
    },
    waitMs(ms) {
      now += ms;
    },
    settle,
    async create(name) {
      const res = await createRoom(name, options());
      await settle();
      return res;
    },
    async join(code, name) {
      const res = await joinRoom(code, name, options());
      await settle();
      return res;
    },
    async act(code, token, action) {
      return (await this.actRaw(code, token, action)).view;
    },
    /** The whole response, e.g. { view, suggestions } for "suggest". */
    async actRaw(code, token, action) {
      const res = await performAction(code, token, action, options());
      await settle();
      return res;
    },
    async poll(code, token) {
      const res = await pollRoom(code, token, null, options());
      await settle();
      return res.view;
    },
  };
}

export async function resetStore() {
  await createMemoryStore().clear();
}

/**
 * Plays a full game. `humans` are seated in those roles (others are AI);
 * `choices` maps decisionId -> optionId for human deciders (missing = never answer).
 * Returns the final view of the first human plus every view seen, for assertions.
 */
export async function playthrough({
  humans = ['caesar', 'antony', 'brutus'],
  choices = {},
  step = 1,
} = {}) {
  const h = harness();
  const host = await h.create('Player 1');
  const seats = [host];
  for (let i = 1; i < humans.length; i++) seats.push(await h.join(host.code, `Player ${i + 1}`));
  for (let i = 0; i < humans.length; i++) {
    await h.act(host.code, seats[i].token, { type: 'pickRole', roleId: humans[i] });
  }
  await h.act(host.code, host.token, { type: 'start' });

  const decided = [];
  let finalView = null;
  for (let elapsed = 0; elapsed <= 700 && !finalView; elapsed += step) {
    h.wait(step);
    for (let i = 0; i < humans.length; i++) {
      let view = await h.poll(host.code, seats[i].token);
      const decision = view.game?.decision;
      if (decision && choices[decision.id]) {
        view = await h.act(host.code, seats[i].token, {
          type: 'decide',
          decisionId: decision.id,
          optionId: choices[decision.id],
        });
        decided.push(decision.id);
      }
      if (view.phase === 'ended' && i === 0) finalView = view;
    }
  }
  // Let the ending text arrive (the mock fills it on the next worker run).
  finalView = await h.poll(host.code, host.token);
  return { h, code: host.code, seats, finalView, decided };
}
