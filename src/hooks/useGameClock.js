// The game clock on screen: the server's time at the last update, plus time since then.

import { useEffect, useState } from 'react';

export function useGameClock(clock, receivedAt) {
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(clock?.running);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  if (!clock) return 0;
  if (!running) return clock.t;
  const elapsed = Math.max(0, now - receivedAt) / 1000 / clock.scale;
  return Math.min(clock.duration, clock.t + elapsed);
}
