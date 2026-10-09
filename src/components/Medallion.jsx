// Character portrait: a Roman coin with the character's initial (no images needed).
// The metal is derived from the portrait key, so each character keeps its own coin.

import { useId } from 'react';

const METALS = [
  ['#ecd08a', '#b98f3e', '#6b4f1f'], // gold
  ['#d9ad74', '#9c7142', '#563b20'], // bronze
  ['#e6e2d9', '#aaa49a', '#5c574f'], // silver
  ['#e0a27a', '#a6623e', '#5a2f18'], // copper
  ['#b77aa0', '#74335f', '#3a1430'], // porphyry
];

function metalFor(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return METALS[h % METALS.length];
}

const BEADS = Array.from({ length: 40 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2;
  return [50 + Math.cos(a) * 44.5, 50 + Math.sin(a) * 44.5];
});

/**
 * @param {{name: string, shortName?: string, portraitKey: string, size?: number, dim?: boolean}} props
 */
export function Medallion({ name, shortName, portraitKey, size = 44, dim = false }) {
  const id = useId();
  const [light, mid, dark] = metalFor(portraitKey);
  const initial = (shortName ?? name).trim().charAt(0).toUpperCase();
  const showLegend = size >= 72;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${name} (portrait)`}
      className={`shrink-0 drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)] ${dim ? 'opacity-60 saturate-50' : ''}`}
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <path id={`${id}-legend`} d="M 50 50 m -35 0 a 35 35 0 1 1 70 0 a 35 35 0 1 1 -70 0" />
      </defs>
      <circle cx="50" cy="50" r="49" fill={dark} />
      {BEADS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill={light} opacity="0.85" />
      ))}
      <circle cx="50" cy="50" r="41.5" fill={`url(#${id}-face)`} />
      <circle
        cx="50"
        cy="50"
        r="33"
        fill="none"
        stroke={dark}
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      {showLegend && (
        <text
          aria-hidden="true"
          fontFamily="Cinzel, serif"
          fontSize="7.2"
          letterSpacing="2.4"
          fill={dark}
          opacity="0.75"
        >
          <textPath href={`#${id}-legend`} startOffset="25%" textAnchor="middle">
            {(shortName ?? name).toUpperCase()}
          </textPath>
        </text>
      )}
      <text
        aria-hidden="true"
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Cinzel, serif"
        fontWeight="700"
        fontSize={showLegend ? 30 : 38}
        fill={light}
        opacity="0.55"
        transform="translate(0.8 0.9)"
      >
        {initial}
      </text>
      <text
        aria-hidden="true"
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Cinzel, serif"
        fontWeight="700"
        fontSize={showLegend ? 30 : 38}
        fill={dark}
      >
        {initial}
      </text>
    </svg>
  );
}
