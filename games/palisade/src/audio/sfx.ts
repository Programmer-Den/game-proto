import { sounds } from '../../../../shared/audio';

/**
 * Palisade's sound effects, synthesized by `shared/audio.ts`. The scene plays them (`BattleSounds`
 * for what happens in the battle, `GameScene` and the panels for the player's taps); the rules in
 * `src/game/` stay free of sound.
 */
export const sfx = sounds({
  /** The ranger's volley: one soft "thwip" however many arrows it has. */
  bow: { wave: 'triangle', freq: 1100, to: 320, length: 0.07, volume: 0.22, gap: 90, vary: 0.06 },
  /** An arrow striking a foe. */
  hit: { wave: 'square', freq: 340, to: 170, length: 0.04, volume: 0.13, gap: 60, vary: 0.12 },
  /** A critical hit: a bright ping. */
  crit: { wave: 'pulse25', freq: 1760, to: 1480, length: 0.12, volume: 0.2, gap: 80, vary: 0.04 },
  /** An arrow glancing off a shield. */
  clank: { wave: 'square', freq: 1350, arp: [0, 1, 0, 1], arpStep: 0.018, length: 0.1, volume: 0.17, gap: 90, vary: 0.05 },
  /** An arrow's powder burst. */
  blast: { wave: 'noise', freq: 1400, to: 220, length: 0.18, volume: 0.24, gap: 90, vary: 0.08 },
  /** A fireball or the oil pot going up. */
  boom: { wave: 'noise', freq: 900, to: 70, length: 0.42, volume: 0.36, gap: 140, vary: 0.06 },
  /** Something heavy thrown: a fireball leaving the bow, the Troll King's rock. */
  whoosh: { wave: 'noise', freq: 1300, to: 420, length: 0.24, attack: 0.08, volume: 0.17, gap: 150, vary: 0.08 },
  /** Chain lightning: a crackly zap. */
  zap: { wave: 'noise', freq: 5200, to: 1400, length: 0.2, volume: 0.24, gap: 120, vary: 0.06 },
  /** A spearman's thrust. */
  stab: { wave: 'triangle', freq: 190, to: 70, length: 0.1, volume: 0.32, gap: 110, vary: 0.08 },
  /** A mage's bolt leaving the staff. */
  magic: { wave: 'sine', freq: 660, to: 1320, length: 0.14, volume: 0.16, gap: 120, vary: 0.05 },
  /** The bolt's arcane burst: a sparkle. */
  arcane: { wave: 'pulse25', freq: 1320, arp: [0, 7, 12, 19], arpStep: 0.03, length: 0.16, volume: 0.15, gap: 120 },
  /** A foe falls; played lower for a big one. */
  pop: { wave: 'square', freq: 520, to: 170, length: 0.09, volume: 0.22, gap: 50, vary: 0.08 },
  /** A boss falls. */
  bossDown: { wave: 'noise', freq: 620, to: 40, length: 0.9, volume: 0.42, gap: 500 },
  /** A Splitting elite falls apart into goblins. */
  split: { wave: 'square', freq: 300, arp: [0, 5, 10], arpStep: 0.03, length: 0.12, volume: 0.2, gap: 100 },
  /** Experience from a kill: a blip, pitched up as the streak grows. */
  xp: { wave: 'pulse25', freq: 880, to: 1100, length: 0.05, volume: 0.11, gap: 60 },
  /** A level up: a rising arpeggio. */
  levelUp: { wave: 'pulse25', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.07, length: 0.42, volume: 0.28, gap: 300 },
  /** A card or a road taken. */
  pick: { wave: 'square', freq: 660, arp: [0, 7], arpStep: 0.06, length: 0.14, volume: 0.22, gap: 100 },
  /** Arrow Rain loosed: a rising whoosh. */
  rainLoose: { wave: 'noise', freq: 2600, to: 8000, length: 0.3, attack: 0.1, volume: 0.2, gap: 200 },
  /** Arrow Rain coming down: a patter. */
  rainLand: { wave: 'noise', freq: 5000, to: 1400, length: 0.42, volume: 0.3, gap: 150 },
  /** Caltrops strewn: a metallic jingle. */
  caltrops: { wave: 'pulse12', freq: 2200, arp: [0, 3, -2, 5, 1], arpStep: 0.035, length: 0.2, volume: 0.16, gap: 200 },
  /** Arrow Rain or the caltrops charged and ready. */
  ready: { wave: 'triangle', freq: 1047, arp: [0, 7], arpStep: 0.08, length: 0.24, volume: 0.24, gap: 400 },
  /** Foes hacking at the barricade (or the stake line), on a timer while they do. */
  chop: { wave: 'noise', freq: 900, to: 300, length: 0.07, volume: 0.22, gap: 250, vary: 0.12 },
  /** The barricade (or the stake line) breaking. */
  crash: { wave: 'noise', freq: 700, to: 50, length: 0.75, volume: 0.42, gap: 500 },
  /** Hammering something up: a guard hired or trained, a fortification, a repair. */
  build: { wave: 'triangle', freq: 420, to: 150, length: 0.12, volume: 0.32, gap: 100, vary: 0.05 },
  /** An omen accepted: an ominous chord. */
  omen: { wave: 'sawtooth', freq: 110, arp: [0, 3, 6], arpStep: 0.12, length: 0.6, attack: 0.05, volume: 0.18, gap: 400 },
  /** A boss's rock (or throw) landing. */
  thud: { wave: 'noise', freq: 480, to: 60, length: 0.3, volume: 0.38, gap: 150 },
  /** The war horn at a wave's start, and the Ogre Warlord calling his goblins. */
  horn: { wave: 'sawtooth', freq: 147, arp: [0, 0, 7], arpStep: 0.16, length: 0.62, attack: 0.05, volume: 0.17, gap: 500 },
  /** The Frost Giant's roar: a low growl. */
  roar: { wave: 'noise', freq: 260, to: 110, length: 0.8, attack: 0.1, volume: 0.38, gap: 500 },
  /** A shaman's healing: a rising shimmer. */
  heal: { wave: 'sine', freq: 600, to: 1000, arp: [0, 4, 7], arpStep: 0.08, length: 0.3, volume: 0.15, gap: 300 },
  /** A wave cleared: a short fanfare. */
  cleared: { wave: 'pulse25', freq: 440, arp: [0, 4, 7, 12], arpStep: 0.09, length: 0.5, volume: 0.26, gap: 500 },
  /** The ballista loosing its lance: a deep twang. */
  twang: { wave: 'triangle', freq: 220, to: 90, length: 0.22, volume: 0.3, gap: 200, vary: 0.05 },
  /** The warden's shield slam: a heavy, low knock. */
  slam: { wave: 'noise', freq: 380, to: 90, length: 0.18, volume: 0.34, gap: 160, vary: 0.08 },
  /** A hound's bite: a short snap. */
  bite: { wave: 'square', freq: 760, to: 260, length: 0.06, volume: 0.18, gap: 120, vary: 0.1 },
  /** A relic from the chest: a sparkle. */
  relic: { wave: 'pulse12', freq: 1568, arp: [0, 4, 7, 12, 16, 19], arpStep: 0.05, length: 0.36, volume: 0.18, gap: 400 },
});

export type SfxName = Parameters<typeof sfx>[0];
