import { byDifficulty } from '../../../../shared/settings';
import { ENEMIES, type EnemyKind } from './enemies';
import { FRONTIERS, type FrontierId } from './frontier';
import { heatRules } from './heat';
import { roadEffects, type RoadId } from './roads';

/** Every tenth wave brings a boss. */
export const BOSS_EVERY = 10;
/** Pause before each wave, with its banner. The first wave waits a little less. */
export const BREAK_MS = 3_000;
export const FIRST_BREAK_MS = 2_000;

export const isBossWave = (wave: number) => wave % BOSS_EVERY === 0;

/** The vale's bosses at the end of each road of ten waves, in turn (the frozen pass has its own, see frontier.ts). */
export const BOSSES: EnemyKind[] = FRONTIERS.vale.bosses;

/** The boss that closes the road `wave` is on, in the vale or on the frozen pass. */
export const bossOf = (wave: number, frontier: FrontierId = 'vale') => {
  const bosses = FRONTIERS[frontier].bosses;
  return bosses[Math.floor((wave - 1) / BOSS_EVERY) % bosses.length];
};

/**
 * The road of ten waves `wave` is on, shown as a track under the top bar: its first wave, its last
 * (the boss's, with the relic chest after it), the boss and how far along the hero is.
 */
export function waveTrack(wave: number, frontier: FrontierId = 'vale') {
  const first = Math.floor((wave - 1) / BOSS_EVERY) * BOSS_EVERY + 1;
  return { first, last: first + BOSS_EVERY - 1, boss: bossOf(wave, frontier), step: wave - first + 1 };
}

/** How much more health foes have in a wave than in wave 1. */
export const hpScale = (wave: number) => 1 + 0.18 * (wave - 1) + 0.012 * (wave - 1) ** 2;

/** How many health bars a wave's boss has: three on wave 10, one more every ten waves after, and one more from Heat 2. */
export const bossBars = (wave: number, heat = 0) => 2 + Math.floor(wave / BOSS_EVERY) + heatRules(heat).bossBars;

/** Time between two foes coming on, in milliseconds; shorter from Heat 1. */
export const spawnInterval = (wave: number, heat = 0) => Math.max(320, 1_300 - 45 * wave) * heatRules(heat).spawnGap;

/**
 * The foes of a wave in the order they come on. More come every wave; orcs join from the start,
 * harpies from wave 3, dark knights from wave 4, shield bearers from wave 5, shamans from wave 7,
 * and a boss closes every tenth wave. A Crowded Road brings 40% more of each. On the frozen pass
 * frost wolves come from the start and ice wisps from wave 3 too; the vale has none.
 */
export function waveFoes(wave: number, road: RoadId | null = null, frontier: FrontierId = 'vale'): EnemyKind[] {
  const more = roadEffects(road).foes;
  const n = (count: number) => Math.floor(count * more);
  const goblins = n(2 + Math.floor(wave * 1.2));
  const orcs = n(3 + Math.floor(wave * 0.9));
  const knights = n(wave >= 4 ? Math.floor((wave - 2) / 2) : 0);
  const harpies = n(wave >= 3 ? Math.floor((wave - 1) / 2) : 0);
  const bearers = n(wave >= 5 ? Math.floor((wave - 3) / 2) : 0);
  const shamans = n(wave >= 7 ? Math.floor((wave - 3) / 4) : 0);
  const pass = frontier === 'pass';
  const wolves = n(pass ? 2 + Math.floor(wave * 0.6) : 0);
  const wisps = n(pass && wave >= 3 ? Math.floor((wave - 1) / 3) : 0);
  const foes: EnemyKind[] = [
    ...Array<EnemyKind>(goblins).fill('goblin'),
    ...Array<EnemyKind>(orcs).fill('orc'),
    ...Array<EnemyKind>(knights).fill('knight'),
    ...Array<EnemyKind>(harpies).fill('harpy'),
    ...Array<EnemyKind>(bearers).fill('bearer'),
    ...Array<EnemyKind>(shamans).fill('shaman'),
    ...Array<EnemyKind>(wolves).fill('wolf'),
    ...Array<EnemyKind>(wisps).fill('wisp'),
  ];
  // Shuffled so the kinds come mixed, but the first foe of a wave is always an orc.
  for (let i = foes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [foes[i], foes[j]] = [foes[j], foes[i]];
  }
  foes.splice(foes.indexOf('orc'), 1);
  foes.unshift('orc');
  if (isBossWave(wave)) foes.push(bossOf(wave, frontier));
  return foes;
}

/**
 * A foe's full health in a wave, scaled by the hub's difficulty and the road's twist (on the frozen
 * pass as ten waves further on); a boss's is spread over its bars.
 */
export function foeHp(kind: EnemyKind, wave: number, road: RoadId | null = null, heat = 0, frontier: FrontierId = 'vale') {
  const type = ENEMIES[kind];
  const hp = Math.round(type.hp * hpScale(wave + FRONTIERS[frontier].hpWaves) * roadEffects(road).hp * byDifficulty(0.75, 1, 1.3));
  return type.boss ? hp * bossBars(wave, heat) : hp;
}
