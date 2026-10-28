import { sounds, type Song } from '../../../shared/audio';
import type { SoundId } from './game/state';

/**
 * Lane Brawl's sound: a heroic march in D Dorian at 128 BPM, and its effects. The rules raise
 * `SoundEvent`s (`s.sounds`), which `GameScene.playSounds` drains and plays here when blue sees
 * them on screen; the player's own buttons play `sfx` straight from the scene.
 */

/**
 * The song. `pick`: the champion pick, calm. `lane`: the match, a march. `tense`: a blue tower,
 * inhibitor or Nexus under attack, or the guardian beast in a fight. Stings: `win`, `lose`, and
 * `end` for a watched match (either side's win).
 */
export const SONG: Song = {
  bpm: 128,
  mix: { lead: 0.15, harmony: 0.07, bass: 0.24, drums: 0.26 },
  parts: {
    pick: {
      lead:
        'd5 . . . f5 . a5 . g5 . f5 . e5 . d5 . | e5 . . . g5 . c6 . b5 . a5 . g5 . . . | ' +
        'b4 . d5 . g5 . . . a5 . b5 . a5 . g5 . | f5 . e5 . d5 . . . . . . . - - - -',
      harmony:
        'f4 . . . . . . . a4 . . . . . . . | e4 . . . . . . . g4 . . . . . . . | ' +
        'd4 . . . . . . . b4 . . . . . . . | f4 . . . . . . . a4 . . . . . . .',
      bass:
        'd3 . . . . . . . a2 . . . . . . . | c3 . . . . . . . g2 . . . . . . . | ' +
        'g2 . . . . . . . d3 . . . . . . . | d3 . . . . . . . a2 . . . . . . .',
      drums: 'k - - - h - - - k - - - h - h -',
    },
    lane: {
      lead:
        'd5 . a4 . d5 . e5 . f5 . . . e5 . d5 . | c5 . d5 . . . a4 . . . . . - - a4 b4 | ' +
        'c5 . . . e5 . g5 . . . e5 . c5 . e5 . | d5 . . . b4 . g4 . a4 . b4 . d5 . . . | ' +
        'f5 . . . e5 . f5 . a5 . . . g5 . f5 . | e5 . f5 . g5 . . . c6 . . . a5 . . . | ' +
        'b5 . a5 . g5 . . . f5 . g5 . a5 . b5 . | a5 . . . e5 . . . c5 . . . e5 . . .',
      harmony:
        '- - f4 - - - a4 - - - f4 - - - a4 - | - - f4 - - - a4 - - - f4 - - - a4 - | ' +
        '- - e4 - - - g4 - - - e4 - - - g4 - | - - d4 - - - b4 - - - d4 - - - b4 - | ' +
        '- - f4 - - - a4 - - - f4 - - - a4 - | - - a4 - - - c5 - - - a4 - - - c5 - | ' +
        '- - d4 - - - b4 - - - d4 - - - b4 - | - - c5 - - - e4 - - - c5 - - - e4 -',
      bass:
        'd2 . d3 . a2 . d3 . d2 . d3 . a2 . d3 . | d2 . d3 . a2 . d3 . d2 . d3 . a2 . d3 . | ' +
        'c2 . c3 . g2 . c3 . c2 . c3 . g2 . c3 . | g2 . g3 . d3 . g3 . g2 . g3 . d3 . g3 . | ' +
        'd2 . d3 . a2 . d3 . d2 . d3 . a2 . d3 . | f2 . f3 . c3 . f3 . f2 . f3 . c3 . f3 . | ' +
        'g2 . g3 . d3 . g3 . g2 . g3 . d3 . g3 . | a2 . a3 . e3 . a3 . a2 . a3 . e3 . a3 .',
      drums: 'k - h - s - h - k - k - s - h h | k - h - s - h - k - k - s - s h',
    },
    tense: {
      lead:
        'd5 a4 d5 a4 f5 a4 d5 a4 e5 a4 d5 a4 f5 a4 g5 a4 | a5 . g5 . f5 . e5 . d5 . . . c5 . d5 . | ' +
        'c5 g4 c5 g4 e5 g4 c5 g4 d5 g4 c5 g4 e5 g4 f5 g4 | g5 . f5 . e5 . d5 . e5 . . . a4 . b4 .',
      harmony:
        'f4 . . . . . . . . . . . . . . . | f4 . . . . . . . a4 . . . . . . . | ' +
        'e4 . . . . . . . . . . . . . . . | e4 . . . . . . . g4 . . . . . . .',
      bass:
        'd2 d2 d3 d2 d2 d2 d3 d2 d2 d2 d3 d2 d2 d2 d3 d2 | d2 d2 d3 d2 d2 d2 d3 d2 d2 d2 d3 d2 d2 d2 d3 d2 | ' +
        'c2 c2 c3 c2 c2 c2 c3 c2 c2 c2 c3 c2 c2 c2 c3 c2 | c2 c2 c3 c2 c2 c2 c3 c2 a2 a2 a3 a2 a2 a2 a3 a2',
      drums: 'k h s h k k s h k h s h k k s s',
    },
    win: {
      lead: 'a4 . d5 . f5 . a5 . g5 . a5 . b5 . . . | d6 . . . . . . . . . . . - - - -',
      harmony: 'f4 . a4 . d5 . f5 . e5 . f5 . g5 . . . | a5 . . . . . . . . . . . - - - -',
      bass: 'd3 . . . a2 . . . g2 . . . g3 . . . | d3 . . . . . . . d2 . . . - - - -',
      drums: 'k - - - s - - - k - k - s - s s | k - - - - - - - - - - - - - - -',
    },
    lose: {
      lead: 'a4 . . . g4 . . . f4 . . . e4 . . . | d4 . . . . . . . . . . . - - - -',
      harmony: 'f4 . . . e4 . . . d4 . . . c#4 . . . | a3 . . . . . . . . . . . - - - -',
      bass: 'd3 . . . c3 . . . bb2 . . . a2 . . . | d2 . . . . . . . . . . . - - - -',
      drums: 'k - - - - - - - k - - - - - - - | k - - - - - - - - - - - - - - -',
    },
    end: {
      lead: 'd5 . a4 . d5 . e5 . f5 . . . . . . . | a5 . . . . . . . - - - - - - - -',
      harmony: 'a4 . . . . . . . a4 . . . . . . . | d5 . . . . . . . - - - - - - - -',
      bass: 'd3 . . . a2 . . . d2 . . . . . . . | d3 . . . . . . . - - - - - - - -',
      drums: 'k - - - s - - - k - - - - - - - | k - - - - - - - - - - - - - - -',
    },
  },
};

/** The game's effects: the rules' sounds (`SoundId`) plus the scene's own for the player's buttons. */
export type SfxName = SoundId | 'pick' | 'upgrade' | 'recall';

export const sfx = sounds<SfxName>({
  // Picking a champion: a rising arpeggio.
  pick: { wave: 'pulse25', freq: 587, arp: [0, 5, 7, 12], arpStep: 0.06, length: 0.3, volume: 0.3 },
  // Attacks, by champions, towers and the beast (minions and camps stay quiet).
  swing: { wave: 'noise', freq: 3000, to: 800, length: 0.09, volume: 0.22, gap: 70, vary: 0.1 },
  shot: { wave: 'pulse12', freq: 1400, to: 600, length: 0.08, volume: 0.17, gap: 70, vary: 0.08 },
  crit: { wave: 'sawtooth', freq: 260, to: 80, length: 0.13, volume: 0.28, gap: 100, vary: 0.05 },
  towerShot: { wave: 'triangle', freq: 700, to: 250, length: 0.18, volume: 0.3, gap: 250 },
  beastClaw: { wave: 'noise', freq: 600, to: 150, length: 0.22, volume: 0.32, gap: 300 },
  // Ability casts, by the ability's kind.
  burst: { wave: 'noise', freq: 400, to: 60, length: 0.25, volume: 0.38, gap: 90, vary: 0.05 },
  bolt: { wave: 'square', freq: 1200, to: 300, length: 0.14, volume: 0.2, gap: 90, vary: 0.05 },
  dash: { wave: 'noise', freq: 800, to: 3000, attack: 0.06, length: 0.22, volume: 0.25, gap: 90 },
  ally: { wave: 'sine', freq: 880, arp: [0, 4, 7], arpStep: 0.05, length: 0.22, volume: 0.28, gap: 90 },
  buff: { wave: 'triangle', freq: 330, to: 660, attack: 0.03, length: 0.25, volume: 0.3, gap: 90 },
  zone: { wave: 'sine', freq: 200, arp: [0, 5, 0, 7, 3], arpStep: 0.04, length: 0.24, volume: 0.32, gap: 90 },
  impact: { wave: 'noise', freq: 2500, to: 1200, length: 0.06, volume: 0.18, gap: 60, vary: 0.1 },
  // Kills and falls.
  lastHit: { wave: 'square', freq: 1319, arp: [0, 7], arpStep: 0.05, length: 0.14, volume: 0.22, gap: 60 },
  slain: { wave: 'square', freq: 600, to: 120, length: 0.4, volume: 0.28, gap: 150 },
  youDie: { wave: 'sawtooth', freq: 300, to: 55, length: 0.8, volume: 0.32 },
  streak: { wave: 'pulse25', freq: 523, arp: [0, 0, 7, 12], arpStep: 0.07, length: 0.4, volume: 0.3, gap: 400 },
  crash: { wave: 'noise', freq: 300, to: 40, length: 0.7, volume: 0.45, gap: 300 },
  nexus: { wave: 'noise', freq: 180, to: 25, length: 1.4, volume: 0.5 },
  wardBreak: { wave: 'square', freq: 1000, to: 400, length: 0.08, volume: 0.2 },
  // The player's champion.
  levelUp: { wave: 'pulse25', freq: 587, arp: [0, 4, 7, 12], arpStep: 0.06, length: 0.32, volume: 0.3 },
  upgrade: { wave: 'square', freq: 784, arp: [0, 7], arpStep: 0.06, length: 0.14, volume: 0.26 },
  flask: { wave: 'sine', freq: 260, arp: [0, -3, 2, -1], arpStep: 0.05, length: 0.22, volume: 0.32 },
  blink: { wave: 'noise', freq: 1200, to: 4000, attack: 0.04, length: 0.18, volume: 0.25 },
  ward: { wave: 'triangle', freq: 1760, length: 0.1, volume: 0.25 },
  recall: { wave: 'sine', freq: 660, arp: [0, 12, 0, 12, 0, 12, 0, 12], arpStep: 0.05, attack: 0.1, length: 0.45, volume: 0.2, gap: 300 },
  recallHome: { wave: 'sine', freq: 1047, arp: [0, 4, 7, 12], arpStep: 0.05, length: 0.3, volume: 0.25 },
  respawn: { wave: 'square', freq: 220, to: 880, length: 0.15, volume: 0.24 },
  buyBack: { wave: 'square', freq: 988, arp: [0, 5, 12], arpStep: 0.04, length: 0.2, volume: 0.28 },
  // The match around the player.
  wave: { wave: 'pulse25', freq: 220, arp: [0, 5], arpStep: 0.25, attack: 0.08, length: 0.55, volume: 0.16 },
  ping: { wave: 'sine', freq: 1319, arp: [0, 7], arpStep: 0.07, length: 0.2, volume: 0.24, gap: 250 },
  spell: { wave: 'triangle', freq: 523, arp: [0, 7, 12], arpStep: 0.04, length: 0.22, volume: 0.3 },
  firstBlood: { wave: 'square', freq: 440, arp: [0, 3, 7, 12, 15], arpStep: 0.06, length: 0.5, volume: 0.3 },
  nightfall: { wave: 'triangle', freq: 392, to: 196, attack: 0.1, length: 0.9, volume: 0.2, gap: 1000 },
  daybreak: { wave: 'triangle', freq: 262, arp: [0, 4, 7, 12], arpStep: 0.12, length: 0.7, volume: 0.2, gap: 1000 },
  plate: { wave: 'square', freq: 880, to: 660, length: 0.12, volume: 0.22, gap: 120 },
  drake: { wave: 'pulse25', freq: 330, arp: [0, 7, 12, 19], arpStep: 0.08, length: 0.55, volume: 0.3 },
  drakeWakes: { wave: 'sawtooth', freq: 180, to: 90, attack: 0.06, length: 0.6, volume: 0.24, gap: 500 },
  mercs: { wave: 'pulse25', freq: 392, arp: [0, 4, 7, 4, 12], arpStep: 0.07, length: 0.45, volume: 0.28 },
  rune: { wave: 'sine', freq: 1568, arp: [0, 5, 12], arpStep: 0.08, length: 0.4, volume: 0.22 },
  runeTaken: { wave: 'triangle', freq: 784, to: 1568, length: 0.25, volume: 0.28 },
  watchstone: { wave: 'triangle', freq: 1175, arp: [0, 7], arpStep: 0.12, length: 0.6, volume: 0.3 },
  growl: { wave: 'sawtooth', freq: 110, to: 55, attack: 0.05, length: 0.7, volume: 0.28, gap: 500 },
  beastSlain: { wave: 'square', freq: 330, arp: [0, -5, -12], arpStep: 0.1, length: 0.5, volume: 0.28 },
  brute: { wave: 'triangle', freq: 440, to: 880, length: 0.3, volume: 0.3 },
  objective: { wave: 'pulse25', freq: 587, arp: [0, 4, 7, 12, 7, 12], arpStep: 0.07, length: 0.5, volume: 0.3 },
  objectiveMissed: { wave: 'triangle', freq: 392, arp: [0, -3], arpStep: 0.15, length: 0.35, volume: 0.3 },
});

/** Sounds too frequent for a watched match, where nothing is the player's own. */
export const BUSY: ReadonlySet<SfxName> = new Set<SfxName>(['swing', 'shot', 'crit', 'towerShot', 'beastClaw', 'impact']);
