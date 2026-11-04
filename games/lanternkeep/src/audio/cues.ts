import { playMusic, playSting, ui } from '../../../../shared/audio';
import type { GameEvent, GameState } from '../game/state';
import { SONG, sfx } from './sound';

/** Seconds of dusk left when the music turns to its `late` part. */
const LATE_MS = 10_000;

/**
 * What the scene's sounds compare a frame with: the state just before `tick`. The rules stay free
 * of sound; the scene takes a `Snapshot`, ticks, and hands both to `frameSounds`.
 */
export interface Snapshot {
  lit: boolean[];
  /** Each moth's task and target. */
  moths: { task: string; target: number }[];
  gust: boolean;
  owl: 'none' | 'warned' | 'flying';
  bats: number[];
  call: boolean;
  tide: 'none' | 'warned' | 'risen';
  ship: boolean;
}

export function snapshot(s: GameState): Snapshot {
  return {
    lit: s.lanterns.map((l) => l.lit),
    moths: s.moths.map((m) => ({ task: m.task, target: m.target })),
    gust: !!s.gust,
    owl: !s.owl ? 'none' : s.owl.x === null ? 'warned' : 'flying',
    bats: s.bats.map((b) => b.id),
    call: !!s.call,
    tide: !s.tide ? 'none' : s.tide.risen ? 'risen' : 'warned',
    ship: !!s.ship,
  };
}

/**
 * Plays the sounds of one dusk frame: the events `tick` pushed, and what changed since `before`
 * (a lantern lit or burnt out, a gust or the owl warned, a bat, a window's call, a tired moth).
 * Lanterns going dark at once (the owl, a double gust) make one fizzle.
 */
export function frameSounds(before: Snapshot, s: GameState, events: GameEvent[]) {
  let fizzle = false;
  const darkened = new Set<number>();
  const dried = new Set<number>();
  for (const e of events) {
    switch (e.type) {
      case 'closeCall':
        sfx('sparkle');
        ui('coin');
        break;
      case 'dry':
        sfx('clunk');
        dried.add(e.lantern);
        break;
      case 'gust':
        sfx('gust');
        if (e.shielded) sfx('ting');
        else {
          darkened.add(e.lantern);
          fizzle ||= !!before.lit[e.lantern];
        }
        break;
      case 'bat':
        if (e.snuffed) {
          darkened.add(e.lantern);
          fizzle = true;
        } else sfx('bounce');
        break;
      case 'chased':
        sfx('whoosh');
        sfx('squeak', { pitch: 1.2 });
        break;
      case 'owl':
        if (e.shielded) sfx('ting');
        else {
          darkened.add(e.lantern);
          fizzle = true;
        }
        break;
      case 'call':
        if (e.kept) {
          sfx('callKept');
          ui('coin');
        } else sfx('callLost');
        break;
      case 'ship':
        if (e.guided) {
          sfx('callKept');
          ui('coin');
        } else sfx('callLost');
        break;
      case 'tide':
        darkened.add(e.lantern);
        fizzle = true;
        break;
      case 'trait':
        sfx('bloom');
        break;
    }
  }
  // A lantern a moth just finished lighting or refilling (not one it left as it was, the cask dry).
  let lit = false;
  before.moths.forEach((was, i) => {
    const m = s.moths[i];
    if (was.task !== 'lighting' || !m || (m.task === 'lighting' && m.target === was.target)) return;
    if (s.lanterns[was.target]?.lit && !dried.has(was.target)) lit = true;
  });
  if (lit) {
    sfx('strike');
    sfx('fwoomp');
  }
  // A lantern that burnt out on its own.
  s.lanterns.forEach((l, i) => {
    if (before.lit[i] && !l.lit && !darkened.has(i)) fizzle = true;
  });
  if (fizzle) sfx('fizzle');
  if (!before.gust && s.gust) sfx('windSwell');
  const owl = !s.owl ? 'none' : s.owl.x === null ? 'warned' : 'flying';
  if (before.owl === 'none' && owl === 'warned') sfx('hoot');
  if (before.owl !== 'flying' && owl === 'flying') sfx('sweep');
  if (s.bats.some((b) => b.task === 'fly' && !before.bats.includes(b.id))) sfx('squeak');
  if (!before.call && s.call) sfx('chime');
  const tide = !s.tide ? 'none' : s.tide.risen ? 'risen' : 'warned';
  if (before.tide === 'none' && tide === 'warned') sfx('swellSea');
  if (before.tide !== 'risen' && tide === 'risen') sfx('wash');
  if (!before.ship && s.ship) sfx('horn');
  if (s.moths.some((m, i) => m.task === 'rest' && before.moths[i]?.task !== 'rest')) sfx('yawn');
}

/**
 * Nightfall's sounds, once `tick` has scored the dusk: the bell, then a coin for each lantern
 * still lit, rising; a lost hearth's thud; and the festival's or the game over's sting.
 * `later(ms, fn)` runs `fn` after `ms` on the scene's clock.
 */
export function nightfallSounds(s: GameState, later: (ms: number, fn: () => void) => void) {
  const r = s.report;
  sfx('toll');
  const lit = s.lanterns.filter((l) => l.lit).length;
  for (let k = 0; k < lit; k++) later(450 + k * 110, () => ui('coin', { pitch: 1 + k * 0.06 }));
  if (r?.lostHearth) {
    later(300, () => {
      sfx('thud');
      sfx('minor');
    });
  }
  if (s.phase === 'over') later(600, () => playSting(SONG, 'over'));
  else if (r?.festival) later(600, () => playSting(SONG, 'festival'));
}

/** The music part for the state: the night kind's tune through dusk, `late` near nightfall, the lullaby between nights. */
export function musicPart(s: GameState) {
  if (s.phase !== 'dusk') return 'lullaby';
  if (s.duskMs <= LATE_MS) return 'late';
  return s.kind === 'clear' ? 'dusk' : s.kind;
}

let playing = '';
/** Switches the music when the part the state asks for changes; `force` restarts the choice (a new keep). */
export function updateMusic(s: GameState, force = false) {
  const part = musicPart(s);
  if (part === playing && !force) return;
  playing = part;
  playMusic(SONG, part);
}
