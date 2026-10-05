// The ONLY place that decides what a player is allowed to see.
// Build the view from an allowlist of fields — never send the raw state and delete secrets.

/**
 * @param {object} state  full room state
 * @param {number} version
 * @param {string} playerId  the player asking
 */
export function viewFor(state, version, playerId) {
  const me = state.players.find((p) => p.id === playerId);
  return {
    code: state.code,
    version,
    counter: state.counter,
    players: state.players.map((p) => ({ id: p.id, name: p.name })),
    messages: state.messages.map((m) => ({
      id: m.id,
      playerId: m.playerId,
      text: m.text,
      at: m.at,
    })),
    // Private to this player only.
    you: me ? { id: me.id, name: me.name, secret: me.secret } : null,
  };
}
