import { sounds, type Song } from '../../../shared/audio';

/**
 * Space Wars' sound: a synth space opera in E minor at 120 BPM (`SONG`) and the battle's effects
 * (`sfx`). The scene plays all of it (`GameScene`); `World` only reports what happened.
 *
 * Parts: `menu` on the faction picker, `calm` (a half-time loop for the opening economy), `battle`
 * while an attack alert is live, `boss` once the rivals have signed the last-stand pact, and the
 * stings `win`, `lose` and `end` (the neutral one for a watched battle).
 */
export const SONG: Song = {
  bpm: 120,
  mix: { lead: 0.15, harmony: 0.07, bass: 0.17, drums: 0.28 },
  waves: { lead: 'pulse25', harmony: 'pulse12', bass: 'sawtooth' },
  parts: {
    menu: {
      lead:
        'e5 . . . g5 . . . b5 . . . . . a5 . | g5 . . . e5 . . . . . . . - - - - | ' +
        'a5 . . . g5 . . . e5 . . . c5 . . . | d#5 . . . . . . . f#5 . . . b4 . . .',
      harmony:
        'e4 g4 b4 d5 e4 g4 b4 d5 e4 g4 b4 d5 e4 g4 b4 d5 | c4 e4 g4 b4 c4 e4 g4 b4 c4 e4 g4 b4 c4 e4 g4 b4 | ' +
        'a3 c4 e4 g4 a3 c4 e4 g4 a3 c4 e4 g4 a3 c4 e4 g4 | b3 d#4 f#4 a4 b3 d#4 f#4 a4 b3 d#4 f#4 a4 b3 d#4 f#4 a4',
      bass:
        'e2 . . . . . . . e2 . . . b1 . . . | c2 . . . . . . . c2 . . . g2 . . . | ' +
        'a1 . . . . . . . a1 . . . e2 . . . | b1 . . . . . . . b1 . . . f#2 . . .',
      drums: 'k - - - - - h - - - - - k - h - | k - - - - - h - - - - - - - h h',
    },
    calm: {
      lead:
        'e5 . . . . . g5 . f#5 . . . e5 . . . | c5 . . . . . e5 . d5 . . . c5 . b4 . | ' +
        'd5 . . . . . g5 . b5 . . . a5 . g5 . | f#5 . . . . . . . a4 . . . - - - - | ' +
        'g5 . . . . . e5 . b5 . . . a5 . g5 . | e5 . . . . . c5 . g5 . . . f#5 . e5 . | ' +
        'c5 . . . e5 . . . a5 . . . g5 . e5 . | d#5 . . . . . . . f#5 . . . b4 . . .',
      harmony:
        'g4 . . . . . . . b4 . . . . . . . | e4 . . . . . . . g4 . . . . . . . | ' +
        'b4 . . . . . . . d5 . . . . . . . | a4 . . . . . . . f#4 . . . . . . . | ' +
        'g4 . . . . . . . b4 . . . . . . . | e4 . . . . . . . g4 . . . . . . . | ' +
        'c5 . . . . . . . e4 . . . . . . . | b4 . . . . . . . f#4 . . . . . . .',
      bass:
        'e2 . . . . . . . e3 . . . b2 . . . | c2 . . . . . . . c3 . . . g2 . . . | ' +
        'g2 . . . . . . . g3 . . . d3 . . . | d2 . . . . . . . d3 . . . a2 . . . | ' +
        'e2 . . . . . . . e3 . . . b2 . . . | c2 . . . . . . . c3 . . . g2 . . . | ' +
        'a2 . . . . . . . a3 . . . e3 . . . | b1 . . . . . . . b2 . . . f#2 . . .',
      drums: 'k - - - h - - - s - - - h - - h | k - - - h - k - s - - - h - h h',
    },
    battle: {
      lead:
        'e5 . . b4 e5 . g5 . f#5 . e5 . d5 . b4 . | c5 . . g4 c5 . e5 . d5 . c5 . b4 . g4 . | ' +
        'd5 . . a4 d5 . f#5 . a5 . g5 . f#5 . d5 . | d#5 . . . f#5 . . . b5 . a5 . f#5 . d#5 . | ' +
        'g5 . . e5 g5 . b5 . a5 . g5 . f#5 . e5 . | e5 . . c5 e5 . g5 . f#5 . e5 . d5 . c5 . | ' +
        'f#5 . . d5 f#5 . a5 . d6 . c6 . a5 . f#5 . | b5 . . . a5 . . . f#5 . d#5 . b4 . . .',
      harmony:
        'e4 g4 b4 g4 e4 g4 b4 g4 e4 g4 b4 g4 e4 g4 b4 g4 | c4 e4 g4 e4 c4 e4 g4 e4 c4 e4 g4 e4 c4 e4 g4 e4 | ' +
        'd4 f#4 a4 f#4 d4 f#4 a4 f#4 d4 f#4 a4 f#4 d4 f#4 a4 f#4 | b3 d#4 f#4 d#4 b3 d#4 f#4 d#4 b3 d#4 f#4 d#4 b3 d#4 f#4 d#4',
      bass:
        'e2 . e2 e3 e2 . e2 e3 e2 . e2 e3 e2 . e3 e2 | c2 . c2 c3 c2 . c2 c3 c2 . c2 c3 c2 . c3 c2 | ' +
        'd2 . d2 d3 d2 . d2 d3 d2 . d2 d3 d2 . d3 d2 | b1 . b1 b2 b1 . b1 b2 b1 . b1 b2 b1 . b2 f#2',
      drums: 'k - h k s - h - k - h k s - h h | k - h k s - h - k k h - s - s s',
    },
    boss: {
      lead:
        'b5 . a5 . g5 . f#5 . g5 . . . e5 . . . | f5 . e5 . d5 . c5 . a4 . . . c5 . f5 . | ' +
        'f#5 . e5 . d5 . a4 . d5 . e5 . f#5 . a5 . | b5 . . . a5 . f#5 . d#5 . . . b4 . . .',
      harmony:
        'e4 . . . b4 . . . e4 . . . b4 . . . | f4 . . . c5 . . . f4 . . . c5 . . . | ' +
        'd4 . . . a4 . . . d4 . . . a4 . . . | b3 . . . f#4 . . . b3 . . . f#4 . . .',
      bass:
        'e2 e2 e3 e2 e2 e2 e3 e2 e2 e2 e3 e2 e2 e3 e2 e3 | f2 f2 f3 f2 f2 f2 f3 f2 f2 f2 f3 f2 f2 f3 f2 f3 | ' +
        'd2 d2 d3 d2 d2 d2 d3 d2 d2 d2 d3 d2 d2 d3 d2 d3 | b1 b1 b2 b1 b1 b1 b2 b1 b1 b1 b2 b1 b1 b2 b1 b2',
      drums: 'k k s - k - s h k k s - k - s h | k k s - k - s h k k s - k s s s',
    },
    win: {
      lead: 'b4 . e5 . g5 . b5 . . . g5 . b5 . . . | e6 . . . . . . . . . . . - - - -',
      harmony: 'g4 . . . . . . . e4 . . . g4 . . . | g#4 . . . . . . . . . . . - - - -',
      bass: 'e2 . . . c3 . . . d3 . . . . . . . | e2 . . . . . . . . . . . - - - -',
      drums: 'k - - - k - - - k - s s s s s s | k - - - - - - - - - - - - - - -',
    },
    lose: {
      lead: 'b4 . . . g4 . . . f#4 . . . e4 . . . | . . . . . . . . - - - - - - - -',
      harmony: 'e4 . . . . . . . c4 . . . . . . . | b3 . . . . . . . - - - - - - - -',
      bass: 'e2 . . . . . . . c2 . . . . . . . | b1 . . . e1 . . . . . . . - - - -',
      drums: 'k - - - - - - - k - - - - - - - | k - - - - - - - - - - - - - - -',
    },
    end: {
      lead: 'e5 . b4 . e5 . g5 . b5 . . . . . . . | - - - - - - - -',
      harmony: 'b4 . . . . . . . d5 . . . . . . . | - - - - - - - -',
      bass: 'e2 . . . . . . . e3 . . . . . . . | - - - - - - - -',
      drums: 'k - - - s - - - k - - - - - - - | - - - - - - - -',
    },
  },
};

/** The battle's sound effects, all short and soft; the scene picks where each plays. */
export const sfx = sounds({
  /** One volley of laser fire on screen (one per frame at most); pitched by the faction that fired. */
  laser: { wave: 'square', freq: 1400, to: 480, length: 0.09, volume: 0.16, gap: 70, vary: 0.06 },
  /** A ship or building blown up on screen, a mine or a splash: noise and a thump. */
  boom: { wave: 'noise', freq: 1800, to: 160, length: 0.35, volume: 0.32, gap: 90, vary: 0.1 },
  /** A big wreck (a building, a heavy ship). */
  boomBig: { wave: 'noise', freq: 900, to: 70, length: 0.7, volume: 0.42, gap: 160, vary: 0.08 },
  /** A main hub falls, in sight: a rolling chain of blasts. */
  hubFalls: { wave: 'noise', freq: 700, to: 40, arp: [0, -7, 2, -10, -4, -14], arpStep: 0.18, length: 1.3, volume: 0.5, gap: 600 },
  /** A ship or a wing selected: two blips. */
  select: { wave: 'square', freq: 1175, arp: [0, 7], arpStep: 0.04, length: 0.08, volume: 0.18, gap: 60 },
  /** A move order: the "roger" chirp. */
  move: { wave: 'pulse25', freq: 660, arp: [0, 5], arpStep: 0.05, length: 0.11, volume: 0.22, gap: 80, vary: 0.03 },
  /** An attack order: an aggressive chirp. */
  attack: { wave: 'square', freq: 523, arp: [0, -5, 0], arpStep: 0.035, length: 0.12, volume: 0.2, gap: 80 },
  /** Fall back: a falling chirp. */
  fallBack: { wave: 'pulse25', freq: 900, to: 300, length: 0.18, volume: 0.22, gap: 120 },
  /** A building placed: a clank. */
  place: { wave: 'square', freq: 180, to: 90, arp: [0, 12, 0], arpStep: 0.03, length: 0.14, volume: 0.24, gap: 100 },
  /** A building of the player's finished: a chime. */
  built: { wave: 'triangle', freq: 784, arp: [0, 4, 7, 12], arpStep: 0.07, length: 0.36, volume: 0.34, gap: 200 },
  /** A unit or research queued, a flagship started. */
  queue: { wave: 'pulse25', freq: 880, length: 0.05, volume: 0.2, gap: 60 },
  /** A new ship of the player's warps in. */
  warpIn: { wave: 'sawtooth', freq: 200, to: 1600, length: 0.25, volume: 0.15, gap: 150 },
  /** Research done, or a ship ranks up to Veteran or Ace. */
  upgrade: { wave: 'square', freq: 523, arp: [0, 4, 7, 12, 16], arpStep: 0.06, length: 0.4, volume: 0.22, gap: 300 },
  /** Crystal gained: salvage, tribute, a contract's reward. */
  crystal: { wave: 'triangle', freq: 1568, arp: [0, 7, 12], arpStep: 0.04, length: 0.16, volume: 0.24, gap: 120, vary: 0.03 },
  /** A contract taken from the board: a stamp. */
  stamp: { wave: 'noise', freq: 1400, to: 200, length: 0.1, volume: 0.36, gap: 200 },
  /** A contract done: a jingle. */
  contractDone: { wave: 'pulse25', freq: 659, arp: [0, 3, 7, 12, 7, 12], arpStep: 0.07, length: 0.5, volume: 0.28, gap: 400 },
  /** A contract failed: an error tone. */
  contractFailed: { wave: 'square', freq: 330, arp: [0, -1, -6], arpStep: 0.12, length: 0.4, volume: 0.22, gap: 400 },
  /** The beacon or a derelict won, a turret hacked over to the player: a rising tone. */
  won: { wave: 'pulse25', freq: 440, to: 880, arp: [0, 7], arpStep: 0.15, length: 0.35, volume: 0.24, gap: 300 },
  /** The beacon or a derelict lost, a turret hacked away: a falling tone. */
  lost: { wave: 'pulse25', freq: 660, to: 330, length: 0.4, volume: 0.24, gap: 300 },
  /** A rival offers a truce: a bleep. */
  truceOffered: { wave: 'square', freq: 988, arp: [0, -12, 0], arpStep: 0.06, length: 0.2, volume: 0.18, gap: 300 },
  /** A truce made: a warm chord. */
  truceMade: { wave: 'triangle', freq: 523, arp: [0, 4, 7], arpStep: 0.09, length: 0.5, volume: 0.32, gap: 300 },
  /** A truce broken by the player, or run out: a short alarm. */
  truceBroken: { wave: 'square', freq: 880, arp: [0, -5, 0, -5], arpStep: 0.08, length: 0.34, volume: 0.2, gap: 300 },
  /** Tribute paid: coins going out. */
  tribute: { wave: 'square', freq: 1318, arp: [0, -5], arpStep: 0.06, length: 0.18, volume: 0.24, gap: 200 },
  /** The pact signed, a pact raid, the convoy hunted: a klaxon. */
  klaxon: { wave: 'square', freq: 392, arp: [0, -3, 0, -3], arpStep: 0.18, length: 0.75, volume: 0.2, gap: 1000 },
  /** A new attack alert: a two-tone alarm, once per alert. */
  alert: { wave: 'pulse25', freq: 1200, arp: [0, -7, 0, -7], arpStep: 0.07, length: 0.3, volume: 0.2, gap: 600 },
  /** The map jumps to an alert: a whoosh. */
  whoosh: { wave: 'noise', freq: 400, to: 6000, attack: 0.12, length: 0.3, volume: 0.22, gap: 150 },
  /** The rally point planted: a flag snapping up. */
  rally: { wave: 'pulse12', freq: 659, arp: [0, 7, 12], arpStep: 0.05, length: 0.2, volume: 0.24, gap: 120 },
  /** The rally point taken down. */
  rallyClear: { wave: 'pulse12', freq: 988, to: 494, length: 0.14, volume: 0.2, gap: 120 },
  /** The flagship unlocked: a brass chord. */
  flagshipReady: { wave: 'sawtooth', freq: 196, arp: [0, 4, 7, 12], arpStep: 0.1, length: 0.6, volume: 0.2, gap: 500 },
  /** The flagship launched: a deep roar. */
  flagshipLaunch: { wave: 'noise', freq: 220, to: 60, attack: 0.2, length: 0.9, volume: 0.42, gap: 500 },
  /** The flagship lost: a mournful horn. */
  flagshipLost: { wave: 'sawtooth', freq: 220, to: 165, attack: 0.1, length: 0.9, volume: 0.2, gap: 500 },
  /** Afterburners lit: a rising roar. */
  afterburner: { wave: 'noise', freq: 300, to: 4200, attack: 0.05, length: 0.35, volume: 0.26, gap: 150 },
  /** A missile salvo: three quick launches. */
  salvo: { wave: 'square', freq: 220, to: 1400, arp: [0, 5, 10], arpStep: 0.05, length: 0.18, volume: 0.2, gap: 150 },
  /** A point-defence screen raised: a bright shimmer. */
  screen: { wave: 'triangle', freq: 1046, arp: [0, 7, 12, 19], arpStep: 0.04, length: 0.3, volume: 0.22, gap: 200 },
  /** A home belt running low or dry: a falling two-note chime. */
  beltLow: { wave: 'triangle', freq: 784, arp: [0, -5, -12], arpStep: 0.14, length: 0.45, volume: 0.24, gap: 600 },
  /** A control group saved: a short double click. */
  group: { wave: 'pulse12', freq: 1318, arp: [0, 12], arpStep: 0.03, length: 0.07, volume: 0.18, gap: 60 },
});

export type Sfx = Parameters<typeof sfx>[0];

/** The laser's pitch for each faction (an index into FACTIONS), so each fleet sounds a little its own. */
export const LASER_PITCH = [1, 0.84, 1.16, 0.74, 1.3];
