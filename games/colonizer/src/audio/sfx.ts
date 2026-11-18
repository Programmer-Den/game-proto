import { sounds } from '../../../../shared/audio';

/**
 * Colonizer's sound effects, synthesized by `shared/audio.ts`: wood and wool sounds for the
 * player's own clicks and orders, thread-thin clashes and arrows for what is on screen, and horns
 * and bells for the big moments. Where each one plays is listed in AGENTS.md (Sound).
 */
export const sfx = sounds({
  /** A unit or building selected: a dry wooden click. */
  select: { wave: 'triangle', freq: 520, to: 380, length: 0.045, volume: 0.3, gap: 60 },
  /** An order given: a two-note acknowledging blip. */
  order: { wave: 'pulse25', freq: 587, arp: [0, 5], arpStep: 0.04, length: 0.09, volume: 0.2, gap: 90, vary: 0.02 },
  /** A building site laid out: a hammer knock. */
  place: { wave: 'triangle', freq: 900, to: 260, length: 0.09, volume: 0.4, gap: 80 },
  /** One of the player's buildings finished: a rising chime. */
  built: { wave: 'pulse25', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.32, volume: 0.22, gap: 200 },
  /** A unit or a tech queued: a quill's scratch. */
  queue: { wave: 'pulse12', freq: 1400, to: 1900, length: 0.05, volume: 0.18, gap: 60 },
  /** A unit trained: a small trumpet pop. */
  trained: { wave: 'square', freq: 523, arp: [0, 7], arpStep: 0.07, length: 0.18, volume: 0.2, gap: 150 },
  /** A tech researched. */
  researched: { wave: 'triangle', freq: 659, arp: [0, 5, 9], arpStep: 0.07, length: 0.3, volume: 0.35, gap: 200 },
  /** The Age II boon or the Age III edge picked: a confirming chord. */
  pick: { wave: 'square', freq: 440, arp: [0, 4, 7], arpStep: 0.04, length: 0.24, volume: 0.22 },
  /** Wood dropped off: a knock. */
  dropWood: { wave: 'triangle', freq: 220, to: 150, length: 0.07, volume: 0.4, gap: 120, vary: 0.06 },
  /** Food dropped off: a pluck. */
  dropFood: { wave: 'pulse25', freq: 660, to: 620, length: 0.1, volume: 0.18, gap: 120, vary: 0.05 },
  /** Ore dropped off: a clink. */
  dropOre: { wave: 'square', freq: 1760, arp: [0, 7], arpStep: 0.03, length: 0.08, volume: 0.13, gap: 120, vary: 0.03 },
  /** A melee blow on screen. */
  clash: { wave: 'noise', freq: 6000, to: 2500, length: 0.07, volume: 0.22, gap: 90, vary: 0.1 },
  /** An arrow or sling stone on screen. */
  thwip: { wave: 'noise', freq: 3000, to: 11000, length: 0.06, volume: 0.13, gap: 100, vary: 0.08 },
  /** A tower or Town Centre volley on screen. */
  volley: { wave: 'noise', freq: 2500, to: 9000, length: 0.15, volume: 0.17, gap: 400 },
  /** The town bell rung. */
  bell: { wave: 'triangle', freq: 392, arp: [0, 12, 0], arpStep: 0.012, length: 1.1, volume: 0.45, gap: 600 },
  /** The town bell released: a lower toll. */
  bellLow: { wave: 'triangle', freq: 294, arp: [0, 12, 0], arpStep: 0.012, length: 0.9, volume: 0.4, gap: 600 },
  /** A new attack on the player's side: a short alarm horn. */
  alarm: { wave: 'sawtooth', freq: 330, arp: [0, 5, 0, 5], arpStep: 0.11, length: 0.46, volume: 0.17, gap: 1200 },
  /** The camera jumps to an alert or raid. */
  whoosh: { wave: 'noise', freq: 700, to: 5000, length: 0.18, attack: 0.07, volume: 0.18, gap: 150 },
  /** A rally flag planted: cloth flapping. */
  flag: { wave: 'noise', freq: 1300, to: 500, length: 0.12, attack: 0.02, volume: 0.22, gap: 120 },
  /** A rally flag taken down: a lower flap. */
  flagDown: { wave: 'noise', freq: 700, to: 250, length: 0.12, attack: 0.02, volume: 0.22, gap: 120 },
  /** A raid coming for the player: a war horn. */
  raidHorn: { wave: 'sawtooth', freq: 147, arp: [0, 0, 7], arpStep: 0.25, length: 0.95, attack: 0.05, volume: 0.22, gap: 3000 },
  /** A raid repelled: a triumphant horn. */
  repelled: { wave: 'square', freq: 294, arp: [0, 4, 7, 12], arpStep: 0.1, length: 0.6, volume: 0.22, gap: 2000 },
  /** A cache taken by the player. */
  cache: { wave: 'pulse25', freq: 880, arp: [0, 7, 12], arpStep: 0.06, length: 0.3, volume: 0.22, gap: 300 },
  /** A relic held by the player: a rising arpeggio. */
  relicGain: { wave: 'pulse25', freq: 440, arp: [0, 3, 7, 10, 12], arpStep: 0.07, length: 0.45, volume: 0.24, gap: 500 },
  /** A relic taken from the player: a falling one. */
  relicLost: { wave: 'pulse25', freq: 440, arp: [12, 10, 7, 3, 0], arpStep: 0.07, length: 0.45, volume: 0.22, gap: 500 },
  /** A Monument finished, anyone's: a solemn drone. */
  monument: { wave: 'triangle', freq: 147, arp: [0, 7, 12], arpStep: 0.3, length: 1.4, attack: 0.15, volume: 0.5, gap: 2000 },
  /** A building falls on screen (a Town Centre too). */
  crumble: { wave: 'noise', freq: 420, to: 70, length: 0.5, volume: 0.34, gap: 250 },
  /** A dry year or flood warned of, or come: a low roll of thunder. */
  thunder: { wave: 'noise', freq: 260, to: 60, length: 1.2, attack: 0.12, volume: 0.36, gap: 2000 },
});

export type SfxName = Parameters<typeof sfx>[0];
