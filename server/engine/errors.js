/** An expected, user-facing failure (bad input, wrong phase, not your turn). */
export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
