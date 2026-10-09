// Turns 1–5 trait levels into behavior the model can act on. Players never see the numbers.

const level = (value) => (value <= 2 ? 'low' : value >= 4 ? 'high' : 'mid');

const BEHAVIOR = {
  intelligence: {
    low: 'You take words at face value, miss hints and trust easily.',
    mid: 'You are shrewd enough, but not suspicious by nature.',
    high: 'You notice contradictions and evasions, and you use what you secretly know strategically.',
  },
  loyalty: {
    low: 'Your loyalty is to yourself first; you would switch sides if it paid.',
    mid: 'You are loyal while it costs you little.',
    high: 'You stay true to {loyalTo}, even at great cost.',
  },
  ambition: {
    low: 'You want no more power than you have.',
    mid: 'You would welcome more standing, but you will not grasp for it.',
    high: 'You hunger for power and glory, and you hate to look weak.',
  },
  lovestruck: {
    low: 'Your heart rarely sways your head.',
    mid: 'Love matters to you, but it does not rule you.',
    high: 'Your choices bend toward {loves}.',
  },
  obedience: {
    low: 'You follow your own judgment and dislike being told what to do.',
    mid: 'You weigh requests before you follow them.',
    high: 'You follow orders and requests literally, even when circumstances change.',
  },
};

/** @returns {string[]} one behavior sentence per trait */
export function describeTraits(traits, bonds = {}) {
  return Object.entries(traits).map(([trait, value]) =>
    BEHAVIOR[trait][level(value)]
      .replace('{loyalTo}', bonds.loyalTo ?? 'your allies')
      .replace('{loves}', bonds.loves ?? 'the people you love'),
  );
}
