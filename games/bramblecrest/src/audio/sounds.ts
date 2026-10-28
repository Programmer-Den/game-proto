// Bramblecrest's sound effects, synthesized by shared/audio.ts. GameScene plays them for the
// knight's own actions and what happens in view; nothing plays while a map is built or a save loads.

import { sounds } from '../../../../shared/audio';

export const sfx = sounds({
  /** The sword's swing. */
  swing: { wave: 'noise', freq: 2600, to: 7000, length: 0.09, volume: 0.16, gap: 90, vary: 0.08 },
  /** A bush or thorns cut. */
  cut: { wave: 'noise', freq: 1600, to: 500, length: 0.15, volume: 0.3, gap: 80, vary: 0.1 },
  /** The roll. */
  roll: { wave: 'noise', freq: 500, to: 1600, length: 0.2, attack: 0.05, volume: 0.2, gap: 150 },
  /** The hookvine flies out. */
  vine: { wave: 'pulse12', freq: 300, to: 900, length: 0.14, volume: 0.18, gap: 120 },
  /** The hookvine catches a post, a bulb or a foe. */
  latch: { wave: 'square', freq: 240, to: 110, length: 0.08, volume: 0.3, gap: 80 },
  /** The knight pulled along the vine to a post. */
  pull: { wave: 'triangle', freq: 300, to: 720, length: 0.32, volume: 0.3, gap: 200 },
  /** A bellseed planted. */
  plant: { wave: 'sine', freq: 520, to: 200, length: 0.1, volume: 0.4, gap: 80 },
  /** A bellseed's fuse ticking, faster at the end. */
  tick: { wave: 'pulse12', freq: 1200, length: 0.03, volume: 0.1, gap: 50 },
  /** A bellseed bursts. */
  boom: { wave: 'noise', freq: 420, to: 50, length: 0.55, volume: 0.55, gap: 120 },
  /** A boulder or cracked wall breaks. */
  crumble: { wave: 'noise', freq: 800, to: 140, length: 0.38, volume: 0.36, gap: 140, vary: 0.06 },
  /** A block pushed one tile. */
  scrape: { wave: 'noise', freq: 260, to: 170, length: 0.22, volume: 0.3, gap: 150 },
  /** A puzzle solved: the plate pressed, the bells' tune. */
  chime: { wave: 'triangle', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.1, length: 0.7, volume: 0.35, gap: 300 },
  /** A key door unlocked. */
  unlock: { wave: 'square', freq: 1320, arp: [0, 7, -5], arpStep: 0.05, length: 0.2, volume: 0.22, gap: 200 },
  /** A room's door shutting behind the knight or opening again. */
  door: { wave: 'noise', freq: 180, to: 80, length: 0.25, volume: 0.4, gap: 200 },
  /** A chest's lid creaks open; the item sting follows. */
  creak: { wave: 'sawtooth', freq: 170, to: 260, length: 0.25, volume: 0.16, gap: 200 },
  /** A moonstone found. */
  stone: { wave: 'pulse12', freq: 1047, arp: [0, 4, 7, 12, 16], arpStep: 0.07, length: 0.5, volume: 0.28, gap: 300 },
  /** A glint where a buried moonstone was dug up. */
  glint: { wave: 'pulse12', freq: 1760, arp: [0, 7], arpStep: 0.06, length: 0.18, volume: 0.18, gap: 200 },
  /** A heart picked up. */
  heart: { wave: 'triangle', freq: 1318, arp: [0, 5], arpStep: 0.06, length: 0.2, volume: 0.3, gap: 80 },
  /** A seed pod picked up. */
  pod: { wave: 'triangle', freq: 880, arp: [0, 7], arpStep: 0.05, length: 0.16, volume: 0.28, gap: 80 },
  /** A line of talk; its pitch is the speaker's. */
  blip: { wave: 'pulse25', freq: 620, arp: [0, 4, 2], arpStep: 0.035, length: 0.11, volume: 0.14, gap: 60 },
  /** A belfry bell rung (its pitch is the bell's), and the Bellwraith's bell struck while it is down. */
  bell: { wave: 'triangle', freq: 523, length: 1.2, attack: 0.002, volume: 0.42, gap: 120 },
  /** The wrong bell: the tune starts over. */
  wrong: { wave: 'square', freq: 233, arp: [0, 1, 0, 1], arpStep: 0.07, length: 0.32, volume: 0.16, gap: 300 },
  /** A foe hit by the knight. */
  hit: { wave: 'square', freq: 320, to: 120, length: 0.08, volume: 0.28, gap: 60, vary: 0.1 },
  /** The sword glancing off a beetle's shell. */
  tink: { wave: 'triangle', freq: 1320, to: 1050, length: 0.12, volume: 0.24, gap: 100 },
  /** A beetle flipped or a lantern moth brought down. */
  thud: { wave: 'noise', freq: 500, to: 120, length: 0.16, volume: 0.3, gap: 100 },
  /** A foe beaten. */
  pop: { wave: 'noise', freq: 1400, to: 300, length: 0.2, volume: 0.32, gap: 60, vary: 0.1 },
  /** The knight hurt. */
  hurt: { wave: 'square', freq: 900, to: 260, length: 0.16, volume: 0.32, gap: 200 },
  /** The knight wakes at the spawn after a fall. */
  wake: { wave: 'triangle', freq: 523, arp: [0, 4, 7], arpStep: 0.12, length: 0.5, volume: 0.3, gap: 300 },
  /** A thornling spits a seed. */
  spit: { wave: 'sine', freq: 700, to: 330, length: 0.07, volume: 0.2, gap: 120, vary: 0.08 },
  /** The Thornmother's ring of thorns. */
  volley: { wave: 'noise', freq: 2400, to: 900, length: 0.22, volume: 0.24, gap: 300 },
  /** A bulb yanked down by the hookvine. */
  twang: { wave: 'pulse25', freq: 180, to: 520, length: 0.22, volume: 0.28, gap: 200 },
  /** A bulb struck with the sword. */
  squelch: { wave: 'noise', freq: 600, to: 180, length: 0.16, volume: 0.36, gap: 80, vary: 0.08 },
  /** The Bellwraith's bell shudders before it drops. */
  rattle: { wave: 'square', freq: 70, to: 90, length: 0.5, volume: 0.12, gap: 400 },
  /** The Bellwraith's bell slams down. */
  clang: { wave: 'triangle', freq: 196, to: 186, length: 1.4, attack: 0.002, volume: 0.55, gap: 400 },
  /** The bell tipped over by a burst. */
  topple: { wave: 'triangle', freq: 262, to: 131, length: 0.9, volume: 0.45, gap: 400 },
  /** The wraith struck while its bell is tipped. */
  wail: { wave: 'sine', freq: 760, to: 300, length: 0.7, attack: 0.04, volume: 0.32, gap: 300, vary: 0.04 },
  /** The wisp hops on ahead. */
  wisp: { wave: 'sine', freq: 1100, to: 1700, length: 0.25, attack: 0.03, volume: 0.18, gap: 300 },
  /** Walking into another map. */
  swell: { wave: 'sine', freq: 220, to: 440, length: 0.6, attack: 0.3, volume: 0.2, gap: 400 },
});

export type SoundName = Parameters<typeof sfx>[0];
