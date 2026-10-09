// The one memorable moment: each act opens on a carved-stone inscription, with the act's mark
// (起 承 转 合) as a small red seal. Shows for ~3 seconds; tap to dismiss early.

import { useEffect } from 'react';
import { roman } from '../lib/format.js';

const SHOW_MS = 3200;

export function ActCard({ act, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(id);
  }, [act.id, onDone]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Act ${act.number}: ${act.title}`}
      className="fixed inset-0 z-50 grid animate-fade-in cursor-pointer place-items-center bg-ink/90 p-4 backdrop-blur-sm"
      onClick={onDone}
    >
      <div className="marble relative w-[min(92vw,34rem)] animate-act-in rounded-[3px] px-6 pt-12 pb-10 text-center shadow-[0_30px_80px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.4),inset_0_0_40px_rgb(0_0_0/0.12)] sm:px-12">
        <div className="seal absolute top-4 right-4 grid size-14 rotate-[-7deg] place-items-center rounded-[4px] text-[1.9rem] leading-none">
          {act.mark}
        </div>
        <p className="engraved font-display text-sm tracking-[0.45em]">ACTUS {roman(act.number)}</p>
        <h2 className="engraved mt-3 font-display text-4xl font-bold tracking-[0.06em] sm:text-5xl">
          {act.title.toUpperCase()}
        </h2>
        <div
          className="mx-auto my-6 flex w-40 items-center gap-2 text-[#8a7e72]"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-current" />
          <span className="text-xs">◆</span>
          <span className="h-px flex-1 bg-current" />
        </div>
        <p className="engraved text-xl leading-relaxed italic">
          {act.poem[0]}
          <br />
          {act.poem[1]}
        </p>
      </div>
      <p className="sr-only">Tap to continue.</p>
    </div>
  );
}
