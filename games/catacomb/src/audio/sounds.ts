import { sounds } from '../../../../shared/audio';

/**
 * Catacomb's sound effects, synthesized by `shared/audio.ts`. Where each one plays is listed in
 * the game's `AGENTS.md` (Sound); most are started by `Cues` in `cues.ts` or by a tap handler in
 * `GameScene`.
 */
export const sfx = sounds({
  // The hero panel
  /** A hero picked: a firm low chord. */
  select: { wave: 'pulse25', freq: 196, arp: [0, 7, 12], arpStep: 0.05, length: 0.24, volume: 0.32 },
  /** The depth moved up or down: a ratchet click. */
  ratchet: { wave: 'noise', freq: 3200, to: 1400, length: 0.06, volume: 0.25, vary: 0.05 },

  // The map
  /** A footstep on the flagstones while walking to a room. */
  step: { wave: 'noise', freq: 900, to: 280, length: 0.06, volume: 0.2, vary: 0.15, gap: 120 },
  /** A door creaks open: the merchant, a mystery room or a treasure room. */
  door: { wave: 'sawtooth', freq: 130, to: 205, length: 0.36, attack: 0.06, volume: 0.13, vary: 0.05 },
  /** The campfire reached: a crackle. */
  fire: { wave: 'noise', freq: 2200, to: 500, length: 0.32, volume: 0.2 },
  /** Water dripping somewhere in the crypt, now and then on the map. */
  drip: { wave: 'sine', freq: 900, to: 1900, length: 0.08, volume: 0.12, vary: 0.15, gap: 500 },
  /** Going down the stair to the next act: a stony rumble. */
  descend: { wave: 'noise', freq: 120, to: 45, length: 0.8, attack: 0.1, volume: 0.4 },

  // Fights
  /** A fight starts: a drum hit. */
  fight: { wave: 'noise', freq: 320, to: 70, length: 0.28, volume: 0.45 },
  /** An elite or a boss: a dark diminished stab over the drum. */
  stab: { wave: 'sawtooth', freq: 220, arp: [0, 3, 6], arpStep: 0.04, length: 0.5, volume: 0.22 },
  /** Cards drawn into the hand: a paper flick. */
  draw: { wave: 'noise', freq: 5200, to: 2400, length: 0.04, volume: 0.14, vary: 0.1, gap: 60 },
  /** The discard pile shuffled into the draw pile: a riffle. */
  shuffle: { wave: 'noise', freq: 4200, to: 1400, length: 0.3, volume: 0.16 },
  /** An attack card played: a sword swish. */
  attack: { wave: 'noise', freq: 1100, to: 4200, length: 0.12, volume: 0.24, vary: 0.1 },
  /** A skill card played: a soft chime. */
  skill: { wave: 'triangle', freq: 880, arp: [0, 7], arpStep: 0.05, length: 0.16, volume: 0.26, vary: 0.02 },
  /** A power card played: a deep swell. */
  power: { wave: 'sawtooth', freq: 110, to: 220, length: 0.5, attack: 0.2, volume: 0.18 },
  /** A foe takes damage: a thwack. */
  hit: { wave: 'square', freq: 190, to: 60, length: 0.1, volume: 0.3, vary: 0.08, gap: 60 },
  /** A foe falls: crumbling bones. */
  die: { wave: 'noise', freq: 640, to: 60, length: 0.5, volume: 0.32, gap: 120 },
  /** The hero takes damage: a thud. */
  hurt: { wave: 'triangle', freq: 130, to: 40, length: 0.18, volume: 0.5, gap: 60 },
  /** A blow fully blocked, either way: a metallic clang. */
  clang: { wave: 'square', freq: 1400, to: 1250, length: 0.15, volume: 0.15, vary: 0.04, gap: 60 },
  /** Block gained: a shield clank (lower for a foe). */
  shield: { wave: 'pulse25', freq: 440, to: 540, length: 0.1, volume: 0.22, gap: 60 },
  /** A status put on a foe: a hiss. */
  status: { wave: 'noise', freq: 6000, to: 1800, length: 0.18, volume: 0.13, gap: 80 },
  /** Poison bites, on a foe or the hero: a sickly wobble. */
  poison: { wave: 'triangle', freq: 300, arp: [0, -1, 0, -1, -2], arpStep: 0.05, length: 0.26, volume: 0.25, gap: 80 },
  /** Health or strength gained: a soft rising arpeggio. */
  heal: { wave: 'pulse25', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.05, length: 0.28, volume: 0.22 },
  /** A foe grows stronger: a growl. */
  buff: { wave: 'sawtooth', freq: 85, to: 140, length: 0.3, volume: 0.2 },
  /** A foe puts Weak, Vulnerable or poison on the hero: a falling hex. */
  hex: { wave: 'square', freq: 330, arp: [0, -3, -6], arpStep: 0.06, length: 0.25, volume: 0.18 },
  /** A curse card joins the deck: an ominous diminished chord. */
  curse: { wave: 'sawtooth', freq: 147, arp: [0, 3, 6, 9], arpStep: 0.05, length: 0.6, volume: 0.2 },
  /** End turn: a tick-tock. */
  endTurn: { wave: 'square', freq: 1200, arp: [0, -5], arpStep: 0.08, length: 0.16, volume: 0.14 },
  /** A flask drunk: a glug and a sparkle. */
  flask: { wave: 'sine', freq: 220, arp: [0, 5, 0, 7, 12, 19], arpStep: 0.045, length: 0.3, volume: 0.35 },
  /** Two tonics combine in hand (the Alchemist): a bubbling rise. */
  brew: { wave: 'sine', freq: 330, arp: [0, 3, 7, 10, 15], arpStep: 0.04, length: 0.32, volume: 0.3 },
  /** The last foe fell: a short jingle. */
  cleared: { wave: 'pulse25', freq: 440, arp: [0, 4, 7, 12], arpStep: 0.08, length: 0.5, volume: 0.26 },

  // Rewards, the campfire, the merchant and mystery rooms
  /** A reward card taken. */
  pick: { wave: 'triangle', freq: 660, to: 990, length: 0.1, volume: 0.3 },
  /** Resting at the campfire: a warm chord. */
  rest: { wave: 'triangle', freq: 262, arp: [0, 4, 7, 12], arpStep: 0.1, length: 0.6, volume: 0.3 },
  /** A card tempered: an anvil ting. */
  temper: { wave: 'square', freq: 1760, to: 1700, length: 0.3, volume: 0.15 },
  /** A card burned at the campfire: a fire whoosh. */
  burn: { wave: 'noise', freq: 400, to: 3000, length: 0.4, attack: 0.1, volume: 0.24 },
  /** Something bought from the merchant: a ka-ching. */
  buy: { wave: 'pulse25', freq: 1318, arp: [0, 7, 12], arpStep: 0.05, length: 0.25, volume: 0.22 },
  /** A mystery room's choice taken: a mysterious chime. */
  mystery: { wave: 'sine', freq: 660, arp: [0, 4, 8, 12], arpStep: 0.08, length: 0.42, volume: 0.3 },
});

export type SoundName = Parameters<typeof sfx>[0];
