import { sounds } from '../../../../shared/audio';

/**
 * Riftblade's sound effects, synthesized by `shared/audio.ts`. Up to 250 foes means a lot of
 * things happen at once, so most sounds have a gap that drops repeats and `SoundCues` plays at
 * most one of each per frame.
 */
export const sfx = sounds({
  // The heroes' weapons, one sound per trigger pull or swing.
  /** Captain Rook's twin pistols. */
  pistol: { wave: 'pulse25', freq: 1400, to: 600, length: 0.06, volume: 0.16, gap: 70, vary: 0.05 },
  /** TR-9's carbine. */
  carbine: { wave: 'square', freq: 950, to: 320, length: 0.07, volume: 0.14, gap: 80, vary: 0.04 },
  /** Bram-17's spread gun. */
  spread: { wave: 'sawtooth', freq: 620, to: 160, length: 0.09, volume: 0.13, gap: 90, vary: 0.05 },
  /** A heavy bolt (Marksman, Longshot). */
  heavy: { wave: 'square', freq: 500, to: 120, length: 0.16, volume: 0.2, gap: 150 },
  /** Mini rockets. */
  rocket: { wave: 'noise', freq: 900, to: 2600, length: 0.18, volume: 0.12, gap: 200 },
  /** Elara Voss's blaster. */
  blaster: { wave: 'pulse12', freq: 1700, to: 700, length: 0.07, volume: 0.15, gap: 80, vary: 0.05 },
  /** Triad-77's bots, and drones. */
  botShot: { wave: 'pulse25', freq: 700, to: 280, length: 0.06, volume: 0.13, gap: 80, vary: 0.06 },
  /** Kael's saber, and the knights' other slashes. */
  saber: { wave: 'noise', freq: 5000, to: 1500, length: 0.11, volume: 0.15, gap: 90, vary: 0.08 },
  /** Lord Vharn's thrown blade. */
  boomerang: { wave: 'triangle', freq: 260, to: 520, length: 0.28, volume: 0.22, gap: 200 },
  /** Master Oom's Current ripple. */
  ripple: { wave: 'sine', freq: 180, to: 420, length: 0.3, attack: 0.06, volume: 0.3, gap: 200 },
  /** Elder Corvin's spin. */
  spinHum: { wave: 'triangle', freq: 520, to: 260, length: 0.22, volume: 0.2, gap: 150 },
  /** Regent Veyl's chain lightning. */
  crackle: { wave: 'noise', freq: 9000, to: 4000, length: 0.14, volume: 0.15, gap: 100, vary: 0.1 },
  /** Kresh's orbiting staff. */
  whir: { wave: 'triangle', freq: 330, to: 420, length: 0.18, attack: 0.03, volume: 0.15, gap: 300, vary: 0.05 },
  /** Master Joren's four-way flurry, and the ping on every tenth. */
  flurry: { wave: 'pulse12', freq: 2200, to: 1600, length: 0.035, volume: 0.13, gap: 60 },
  ping: { wave: 'sine', freq: 1760, arp: [0, 7], arpStep: 0.05, length: 0.25, volume: 0.2, gap: 400 },

  // Signature moves.
  sigHorn: { wave: 'square', freq: 392, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.4, volume: 0.28, gap: 500 },
  sigPulse: { wave: 'sine', freq: 140, to: 50, length: 0.4, volume: 0.45, gap: 500 },
  sigToss: { wave: 'noise', freq: 600, to: 2000, length: 0.2, volume: 0.15, gap: 300 },
  sigSlam: { wave: 'square', freq: 220, to: 55, length: 0.3, volume: 0.32, gap: 300 },
  sigForce: { wave: 'sawtooth', freq: 70, to: 160, length: 0.5, attack: 0.1, volume: 0.25, gap: 500 },
  sigDash: { wave: 'noise', freq: 1500, to: 6000, length: 0.22, volume: 0.18, gap: 300 },
  sigRing: { wave: 'sine', freq: 1320, arp: [0, 7, 12], arpStep: 0.06, length: 0.4, volume: 0.22, gap: 500 },
  sigStorm: { wave: 'noise', freq: 3000, to: 300, length: 0.6, volume: 0.28, gap: 500 },
  sigFlare: { wave: 'pulse25', freq: 600, to: 1800, length: 0.4, volume: 0.2, gap: 500 },
  sigShift: { wave: 'square', freq: 440, arp: [0, 5], arpStep: 0.05, length: 0.12, volume: 0.16, gap: 300 },

  // Pool skills and blasts.
  /** A grenade or frag thrown. */
  toss: { wave: 'noise', freq: 1200, to: 600, length: 0.12, volume: 0.1, gap: 150 },
  /** A call-in, orbital drop or carpet strike falling. */
  whistle: { wave: 'sine', freq: 1800, to: 500, length: 0.7, volume: 0.13, gap: 600 },
  /** A timed charge set down. */
  charge: { wave: 'square', freq: 1200, length: 0.05, volume: 0.12, gap: 300 },
  /** A big blast, and a small one. */
  boom: { wave: 'noise', freq: 140, to: 40, length: 0.45, volume: 0.45, gap: 90, vary: 0.08 },
  pop: { wave: 'noise', freq: 400, to: 90, length: 0.22, volume: 0.28, gap: 70, vary: 0.1 },

  // Combat.
  /** A foe killed (pitch varies), an elite killed, a hit on the boss. */
  kill: { wave: 'square', freq: 520, to: 180, length: 0.05, volume: 0.1, gap: 45, vary: 0.15 },
  eliteKill: { wave: 'noise', freq: 300, to: 60, length: 0.3, volume: 0.35, gap: 150 },
  bossHit: { wave: 'square', freq: 160, to: 120, length: 0.04, volume: 0.12, gap: 140 },
  hurt: { wave: 'square', freq: 330, to: 110, length: 0.14, volume: 0.3, gap: 200 },
  dodge: { wave: 'noise', freq: 2500, to: 6000, length: 0.12, volume: 0.14, gap: 200 },
  barrier: { wave: 'sine', freq: 2400, arp: [0, 7], arpStep: 0.04, length: 0.12, volume: 0.18, gap: 200 },
  heal: { wave: 'triangle', freq: 660, arp: [0, 4, 7], arpStep: 0.06, length: 0.24, volume: 0.25, gap: 300 },
  /** A lumen shard; the scene raises its pitch while shards keep coming. */
  shard: { wave: 'pulse25', freq: 1320, length: 0.05, volume: 0.11, gap: 40 },

  // Level-ups and cards.
  levelUp: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.055, length: 0.36, volume: 0.25, gap: 300 },
  card: { wave: 'pulse25', freq: 880, arp: [0, 7], arpStep: 0.05, length: 0.12, volume: 0.22, gap: 80 },
  capstone: { wave: 'square', freq: 784, arp: [0, 4, 7, 12, 7, 12], arpStep: 0.07, length: 0.5, volume: 0.28, gap: 400 },
  crossover: { wave: 'triangle', freq: 1046, arp: [0, 3, 7, 10, 14], arpStep: 0.06, length: 0.45, volume: 0.28, gap: 400 },
  /** A card banished at a level-up. */
  banish: { wave: 'sawtooth', freq: 700, to: 140, length: 0.22, volume: 0.16, gap: 150 },
  chest: { wave: 'pulse25', freq: 1046, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.3, volume: 0.24, gap: 200 },

  // Foes and the field.
  eliteHorn: { wave: 'sawtooth', freq: 196, to: 185, length: 0.5, attack: 0.04, volume: 0.2, gap: 1000 },
  siren: { wave: 'square', freq: 500, to: 950, length: 0.9, attack: 0.1, volume: 0.15, gap: 2000 },
  /** A pair of rift altars rising, and a pact taken at one. */
  altar: { wave: 'triangle', freq: 220, arp: [0, 7, 12], arpStep: 0.12, length: 0.6, attack: 0.05, volume: 0.24, gap: 1000 },
  pact: { wave: 'sawtooth', freq: 110, arp: [0, 6, 12], arpStep: 0.08, length: 0.5, volume: 0.24, gap: 600 },
  warn: { wave: 'pulse25', freq: 600, to: 1000, length: 0.2, volume: 0.13, gap: 150 },
  stomp: { wave: 'sine', freq: 90, to: 40, length: 0.3, volume: 0.42, gap: 300 },
  enemyShot: { wave: 'square', freq: 300, to: 140, length: 0.08, volume: 0.1, gap: 120, vary: 0.1 },
  enemyVolley: { wave: 'sawtooth', freq: 220, to: 110, length: 0.1, volume: 0.12, gap: 200 },
  glob: { wave: 'sine', freq: 300, to: 120, length: 0.12, volume: 0.16, gap: 150 },
  fireRing: { wave: 'noise', freq: 600, to: 200, length: 0.5, attack: 0.1, volume: 0.2, gap: 500 },
  bossStab: { wave: 'sawtooth', freq: 98, to: 73, length: 0.9, attack: 0.02, volume: 0.3, gap: 2000 },
  bossDown: { wave: 'noise', freq: 100, to: 30, length: 1, volume: 0.5, gap: 1000 },

  // Between fights.
  node: { wave: 'pulse25', freq: 660, arp: [0, 5], arpStep: 0.05, length: 0.12, volume: 0.2, gap: 80 },
  reroll: { wave: 'square', freq: 300, to: 1200, length: 0.18, volume: 0.16, gap: 150 },
  event: { wave: 'sine', freq: 880, arp: [0, 4, 7], arpStep: 0.07, length: 0.3, volume: 0.22, gap: 200 },
  warp: { wave: 'noise', freq: 200, to: 3000, length: 0.8, attack: 0.2, volume: 0.16, gap: 1000 },
});

export type SfxName = Parameters<typeof sfx>[0];
